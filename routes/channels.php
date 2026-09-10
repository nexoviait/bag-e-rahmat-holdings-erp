<?php

use App\Models\Call;
use App\Models\Conversation;
use App\Models\Project;
use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('App.Models.User.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});

// Personal channel — subscribed once globally in AppShell.tsx (not scoped to
// the Chat tab). Carries ConversationCreated (new DM/group appears in the
// list live) and, in Phase C, CallRinging (so an incoming call can ring from
// anywhere in the app, not just while the Chat tab happens to be open).
Broadcast::channel('chat.user.{userId}', function ($user, $userId) {
    return (int) $user->id === (int) $userId;
});

// Per-conversation channel — message delivery, read receipts, and (as
// whispers only, never a real broadcast event) typing indicators. Gated on
// active participancy, with the same admin-sees-everything bypass as
// ConversationPolicy — an admin auditing a project's chat can still open a
// thread and watch it live, matching the confirmed CCTV/Documents-style
// oversight model, even without their own participant row.
Broadcast::channel('chat.conversation.{conversationId}', function ($user, $conversationId) {
    $conversation = Conversation::find($conversationId);
    if (!$conversation) {
        return false;
    }

    if ($user->hasAnyRole(['super_admin', 'admin'])) {
        return true;
    }

    return $conversation->participants()
        ->where('user_id', $user->id)
        ->whereNull('left_at')
        ->exists();
});

// Presence channel — one per open Chat tab, gated on project membership. The
// "green dot" online signal, separate from and complementary to
// users.last_seen_at (which covers the "last seen at HH:MM" fallback for
// someone who isn't currently subscribed).
Broadcast::channel('chat.project.{projectId}', function ($user, $projectId) {
    $project = Project::find($projectId);
    if (!$project) {
        return false;
    }

    if (!$user->hasAnyRole(['super_admin', 'admin']) && !$user->projects->contains((int) $projectId)) {
        return false;
    }

    return ['id' => $user->id, 'name' => $user->name, 'avatar_path' => $user->avatar_path];
});

// Per-call channel — WebRTC SDP/ICE signaling as whispers (never touches
// Laravel/the DB/the queue — a dozen+ ICE candidates per peer pair would
// otherwise mean that many HTTP round-trips) plus CallStatusUpdated
// lifecycle broadcasts. No admin bypass, unlike the conversation/presence
// channels above — a live call is not something oversight needs to audit,
// and Gate::before already covers the one role (super_admin) that gets a
// blanket exception everywhere else in this app.
Broadcast::channel('chat.call.{callId}', function ($user, $callId) {
    $call = Call::find($callId);
    if (!$call) {
        return false;
    }

    return $call->participants()->where('user_id', $user->id)->exists();
});
