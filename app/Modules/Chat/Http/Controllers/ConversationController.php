<?php

namespace App\Modules\Chat\Http\Controllers;

use App\Models\Conversation;
use App\Modules\Chat\DTO\ConversationData;
use App\Modules\Chat\Http\Requests\StoreConversationRequest;
use App\Modules\Chat\Http\Requests\UpdateConversationRequest;
use App\Modules\Chat\Http\Resources\ConversationParticipantResource;
use App\Modules\Chat\Http\Resources\ConversationResource;
use App\Modules\Chat\Services\ConversationService;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Throwable;

class ConversationController extends ChatController
{
    public function __construct(
        private readonly ConversationService $conversations,
    ) {}

    public function index(Request $request, $projectId)
    {
        try {
            $this->authorize('viewAny', [Conversation::class, (int) $projectId]);

            $conversations = $this->conversations->listForProject((int) $projectId, $request->user());

            return response()->json(ConversationResource::collection($conversations));
        } catch (AuthorizationException) {
            return response()->json(['message' => 'You do not have permission to view this project\'s chat.'], 403);
        } catch (Throwable $e) {
            report($e);
            return response()->json(['message' => 'Failed to load conversations.'], 500);
        }
    }

    public function members(Request $request, $projectId)
    {
        try {
            $this->authorize('viewAny', [Conversation::class, (int) $projectId]);

            $members = $this->conversations->getMembers((int) $projectId)
                ->map(fn ($u) => [
                    'id' => $u->id,
                    'name' => $u->name,
                    'email' => $u->email,
                    'avatar_path' => $u->avatar_path,
                    'last_seen_at' => $u->last_seen_at,
                ])
                ->values();

            return response()->json($members);
        } catch (AuthorizationException) {
            return response()->json(['message' => 'You do not have permission to view this project\'s chat.'], 403);
        } catch (Throwable $e) {
            report($e);
            return response()->json(['message' => 'Failed to load project members.'], 500);
        }
    }

    public function store(StoreConversationRequest $request, $projectId)
    {
        try {
            $data = ConversationData::fromArray([...$request->validated(), 'project_id' => $projectId]);

            if ($data->type === 'group') {
                $this->authorize('createGroup', [Conversation::class, $data->projectId]);
                $conversation = $this->conversations->createGroup($data, $request->user());
            } else {
                $this->authorize('createDirect', [Conversation::class, $data->projectId]);
                if (count($data->memberUserIds) !== 1) {
                    return response()->json(['message' => 'A direct conversation needs exactly one other member.'], 422);
                }
                $conversation = $this->conversations->createDirect($data->projectId, $request->user(), $data->memberUserIds[0]);
            }

            $conversation->load([
                'activeParticipants.user:id,name,email,avatar_path,last_seen_at',
                'latestMessage.sender:id,name',
            ]);

            return response()->json(new ConversationResource($conversation), 201);
        } catch (ValidationException $e) {
            return response()->json(['message' => $e->getMessage(), 'errors' => $e->errors()], 422);
        } catch (AuthorizationException) {
            return response()->json(['message' => 'You do not have permission to start this conversation.'], 403);
        } catch (Throwable $e) {
            report($e);
            return response()->json(['message' => 'Failed to start conversation.'], 500);
        }
    }

    public function show(Request $request, $id)
    {
        try {
            $conversation = $this->conversations->find((int) $id);
            $this->authorize('view', $conversation);

            $conversation->load([
                'activeParticipants.user:id,name,email,avatar_path,last_seen_at',
                'latestMessage.sender:id,name',
            ]);

            return response()->json(new ConversationResource($conversation));
        } catch (ModelNotFoundException) {
            return response()->json(['message' => 'Conversation not found.'], 404);
        } catch (AuthorizationException) {
            return response()->json(['message' => 'You do not have permission to view this conversation.'], 403);
        } catch (Throwable $e) {
            report($e);
            return response()->json(['message' => 'Failed to load conversation.'], 500);
        }
    }

    public function update(UpdateConversationRequest $request, $id)
    {
        try {
            $conversation = $this->conversations->find((int) $id);
            $this->authorize('manageMembers', $conversation);

            $conversation = $this->conversations->rename($conversation, $request->validated('name'));

            return response()->json(new ConversationResource($conversation));
        } catch (ModelNotFoundException) {
            return response()->json(['message' => 'Conversation not found.'], 404);
        } catch (AuthorizationException) {
            return response()->json(['message' => 'You do not have permission to rename this group.'], 403);
        } catch (Throwable $e) {
            report($e);
            return response()->json(['message' => 'Failed to update conversation.'], 500);
        }
    }

    public function participants(Request $request, $id)
    {
        try {
            $conversation = $this->conversations->find((int) $id);
            $this->authorize('view', $conversation);

            $conversation->load('activeParticipants.user:id,name,email,avatar_path,last_seen_at');

            return response()->json(ConversationParticipantResource::collection($conversation->activeParticipants));
        } catch (ModelNotFoundException) {
            return response()->json(['message' => 'Conversation not found.'], 404);
        } catch (AuthorizationException) {
            return response()->json(['message' => 'You do not have permission to view this conversation.'], 403);
        } catch (Throwable $e) {
            report($e);
            return response()->json(['message' => 'Failed to load participants.'], 500);
        }
    }

    public function addMembers(Request $request, $id)
    {
        try {
            $conversation = $this->conversations->find((int) $id);
            $this->authorize('manageMembers', $conversation);

            $request->validate([
                'member_user_ids' => ['required', 'array', 'min:1'],
                'member_user_ids.*' => ['integer', 'exists:users,id'],
            ]);

            $this->conversations->addMembers($conversation, $request->input('member_user_ids'), $request->user());

            $conversation->load('activeParticipants.user:id,name,email,avatar_path,last_seen_at');

            return response()->json(new ConversationResource($conversation));
        } catch (ModelNotFoundException) {
            return response()->json(['message' => 'Conversation not found.'], 404);
        } catch (ValidationException $e) {
            return response()->json(['message' => $e->getMessage(), 'errors' => $e->errors()], 422);
        } catch (AuthorizationException) {
            return response()->json(['message' => 'You do not have permission to manage this group.'], 403);
        } catch (Throwable $e) {
            report($e);
            return response()->json(['message' => 'Failed to add members.'], 500);
        }
    }

    public function removeMember(Request $request, $id, $userId)
    {
        try {
            $conversation = $this->conversations->find((int) $id);
            $this->authorize('manageMembers', $conversation);

            $this->conversations->removeMember($conversation, (int) $userId);

            return response()->json(['message' => 'Member removed.']);
        } catch (ModelNotFoundException) {
            return response()->json(['message' => 'Conversation not found.'], 404);
        } catch (AuthorizationException) {
            return response()->json(['message' => 'You do not have permission to manage this group.'], 403);
        } catch (Throwable $e) {
            report($e);
            return response()->json(['message' => 'Failed to remove member.'], 500);
        }
    }

    public function leave(Request $request, $id)
    {
        try {
            $conversation = $this->conversations->find((int) $id);
            $this->authorize('leave', $conversation);

            $this->conversations->leave($conversation, $request->user());

            return response()->json(['message' => 'You left the conversation.']);
        } catch (ModelNotFoundException) {
            return response()->json(['message' => 'Conversation not found.'], 404);
        } catch (AuthorizationException) {
            return response()->json(['message' => 'You do not have permission to leave this conversation.'], 403);
        } catch (Throwable $e) {
            report($e);
            return response()->json(['message' => 'Failed to leave conversation.'], 500);
        }
    }
}
