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
// active participancy. Broadcast::channel callbacks are Reverb/Pusher's own
// authorization mechanism — they never go through Laravel's Gate at all, so
// Gate::before's super_admin bypass does NOT apply here automatically; it's
// checked explicitly. 'admin' gets no bypass here (or in ConversationPolicy)
// — see that policy's docblock for why chat visibility was tightened to
// super_admin only.
Broadcast::channel('chat.conversation.{conversationId}', function ($user, $conversationId) {
    $conversation = Conversation::find($conversationId);
    if (!$conversation) {
        return false;
    }

    if ($user->hasRole('super_admin')) {
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
// someone who isn't currently subscribed). Same super_admin-only bypass as
// the conversation channel above, for the same reason — an 'admin' with no
// real reason to be in this project's chat shouldn't see who's active in it
// either, even though this channel carries presence, not message content.
Broadcast::channel('chat.project.{projectId}', function ($user, $projectId) {
    $project = Project::find($projectId);
    if (!$project) {
        return false;
    }

    if (!$user->hasRole('super_admin') && !$user->projects->contains((int) $projectId)) {
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
