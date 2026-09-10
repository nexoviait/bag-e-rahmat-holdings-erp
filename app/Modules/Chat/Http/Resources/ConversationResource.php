<?php

namespace App\Modules\Chat\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ConversationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $authUserId = $request->user()?->id;

        // NOTE: whenLoaded() returns a MissingValue sentinel object (always
        // truthy) when the relation isn't loaded — checking relationLoaded()
        // directly here, rather than trusting the truthiness of whenLoaded()'s
        // return value, is required before calling Collection methods on it.
        $participantsLoaded = $this->relationLoaded('activeParticipants');
        $participants = $participantsLoaded ? $this->activeParticipants : null;

        // A direct conversation has no name of its own — the UI shows the
        // OTHER participant's name/avatar, mirroring how every DM app works.
        // Falls back to the conversation's own (null) name/avatar for a group,
        // or when participants weren't eager-loaded (e.g. a bare create() response).
        $otherParticipant = null;
        if ($this->type === 'direct' && $participants) {
            $otherParticipant = $participants->firstWhere('user_id', '!=', $authUserId);
        }

        $displayName = $this->name;
        $displayAvatar = $this->avatar_path;
        if ($otherParticipant && $otherParticipant->relationLoaded('user') && $otherParticipant->user) {
            $displayName = $otherParticipant->user->name;
            $displayAvatar = $otherParticipant->user->avatar_path;
        }

        $myParticipant = $participants
            ? $participants->firstWhere('user_id', $authUserId)
            : null;

        $latestMessageLoaded = $this->relationLoaded('latestMessage');
        $latestMessage = $latestMessageLoaded ? $this->latestMessage : null;

        return [
            'id' => $this->id,
            'project_id' => $this->project_id,
            'type' => $this->type,
            'name' => $displayName,
            'avatar_path' => $displayAvatar,
            'direct_key' => $this->direct_key,
            'participants' => $participants
                ? ConversationParticipantResource::collection($participants)
                : null,
            'latest_message' => $latestMessage ? new MessageResource($latestMessage) : null,
            // Present only when the requesting user is an active participant
            // (e.g. an admin viewing a DM they aren't part of has no watermark)
            // — see EloquentConversationRepository::listForProjectAndUser()'s
            // per-user correlated-subquery withCount for how this is computed.
            'my_last_read_message_id' => $myParticipant?->last_read_message_id,
            'unread_count' => $this->when(isset($this->unread_count), fn () => (int) $this->unread_count),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
