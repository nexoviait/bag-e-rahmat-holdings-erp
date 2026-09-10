<?php

namespace App\Modules\Chat\Services;

use App\Models\Call;
use App\Models\Conversation;
use App\Models\User;
use App\Modules\Chat\Contracts\CallRepositoryInterface;
use App\Modules\Chat\Contracts\ConversationRepositoryInterface;
use App\Modules\Chat\Events\CallRinging;
use App\Modules\Chat\Events\CallStatusUpdated;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class CallService
{
    // Mesh WebRTC (every participant connects directly to every other) —
    // quality degrades badly beyond this, and there's no SFU/media-server in
    // budget to do better. A real, disclosed limitation, not silently ignored.
    public const MAX_PARTICIPANTS = 6;

    public function __construct(
        private readonly CallRepositoryInterface $calls,
        private readonly ConversationRepositoryInterface $conversations,
    ) {}

    public function find(int $id): Call
    {
        return $this->calls->findOrFail($id)->load(['participants.user', 'initiator']);
    }

    public function initiate(Conversation $conversation, User $initiator, string $type): Call
    {
        // Idempotent — a second "start call" click (or a race between two
        // tabs) just returns the call already ringing/ongoing rather than
        // spawning a duplicate.
        $existing = $this->calls->findActiveForConversation($conversation->id);
        if ($existing) {
            return $existing->load(['participants.user', 'initiator']);
        }

        $activeParticipantIds = $this->conversations->activeParticipantIds($conversation);

        if (count($activeParticipantIds) > self::MAX_PARTICIPANTS) {
            throw ValidationException::withMessages([
                'type' => 'Group calls support up to '.self::MAX_PARTICIPANTS.' participants — this conversation has more members than that.',
            ]);
        }

        $call = DB::transaction(function () use ($conversation, $initiator, $type, $activeParticipantIds) {
            $call = $this->calls->create([
                'project_id' => $conversation->project_id,
                'conversation_id' => $conversation->id,
                'type' => $type,
                'status' => 'ringing',
                'initiated_by' => $initiator->id,
            ]);

            foreach ($activeParticipantIds as $userId) {
                $this->calls->addParticipant($call, $userId, $userId === $initiator->id ? 'joined' : 'ringing');
            }

            return $call;
        });

        $recipientIds = array_values(array_diff($activeParticipantIds, [$initiator->id]));
        $call = $call->load(['participants.user', 'initiator']);

        broadcast(new CallRinging($call, $recipientIds))->toOthers();

        return $call;
    }

    public function accept(Call $call, User $user): Call
    {
        $this->calls->updateParticipant($call, $user->id, [
            'status' => 'joined',
            'joined_at' => now(),
        ]);

        if ($call->status === 'ringing') {
            $call = $this->calls->update($call, [
                'status' => 'ongoing',
                'started_at' => $call->started_at ?? now(),
            ]);
        }

        $call = $call->fresh(['participants.user', 'initiator']);
        broadcast(new CallStatusUpdated($call))->toOthers();

        return $call;
    }

    public function decline(Call $call, User $user): Call
    {
        $this->calls->updateParticipant($call, $user->id, ['status' => 'declined']);

        $stillActive = count($this->calls->activeParticipantIds($call->fresh()));

        // Nobody left who could possibly still answer/continue — the call is over.
        if ($stillActive <= 1) {
            $call = $this->calls->update($call, [
                'status' => $call->status === 'ringing' ? 'declined' : 'ended',
                'ended_at' => now(),
                'end_reason' => 'declined',
            ]);
        }

        $call = $call->fresh(['participants.user', 'initiator']);
        broadcast(new CallStatusUpdated($call))->toOthers();

        return $call;
    }

    /** Hangs up for $user — covers both "leave an ongoing call" and "cancel a call I started before anyone answered". */
    public function end(Call $call, User $user): Call
    {
        $this->calls->updateParticipant($call, $user->id, [
            'status' => 'left',
            'left_at' => now(),
        ]);

        $joinedCount = count($this->calls->joinedParticipantIds($call->fresh()));

        // A "call" needs at least 2 people actually on it — one person left
        // alone (or the initiator cancelling solo before anyone answers,
        // where joinedCount is 1: just themselves) means it's over, not
        // ongoing-with-an-audience-of-one.
        if ($joinedCount <= 1) {
            // Sweep anyone still shown as 'ringing' to 'missed' so their
            // incoming-call UI dismisses too, whether this was the last
            // person leaving an ongoing call or the initiator cancelling
            // before anyone ever answered. Anyone left dangling as 'joined'
            // (the one person now "alone" on the call) is closed out too —
            // the call as a whole is ending regardless of whether they
            // personally clicked hang up.
            $call->participants()->where('status', 'ringing')->update(['status' => 'missed']);
            $call->participants()->where('status', 'joined')->update(['status' => 'left', 'left_at' => now()]);
            $call = $this->calls->update($call, [
                'status' => 'ended',
                'ended_at' => now(),
                'end_reason' => $call->status === 'ringing' ? 'cancelled' : 'hangup',
            ]);
        }

        $call = $call->fresh(['participants.user', 'initiator']);
        broadcast(new CallStatusUpdated($call))->toOthers();

        return $call;
    }

    /** Called from the scheduled MarkStaleCallsAsMissed command — no HTTP request/socket to exclude, so a plain broadcast(). */
    public function markStaleAsMissed(int $olderThanSeconds = 60): int
    {
        $staleCalls = $this->calls->findStaleRinging($olderThanSeconds);

        foreach ($staleCalls as $call) {
            $call->participants()->where('status', 'ringing')->update(['status' => 'missed']);
            $call = $this->calls->update($call, [
                'status' => 'missed',
                'ended_at' => now(),
                'end_reason' => 'no_answer',
            ]);
            broadcast(new CallStatusUpdated($call->fresh(['participants.user', 'initiator'])));
        }

        return $staleCalls->count();
    }
}
