<?php

namespace App\Modules\Chat\Http\Controllers;

use App\Modules\Chat\DTO\MessageData;
use App\Modules\Chat\Http\Requests\StoreMessageRequest;
use App\Modules\Chat\Http\Resources\MessageResource;
use App\Modules\Chat\Services\ConversationService;
use App\Modules\Chat\Services\MessageService;
use App\Modules\Chat\Support\ChatAttachmentRules;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Throwable;

class MessageController extends ChatController
{
    public function __construct(
        private readonly MessageService $messages,
        private readonly ConversationService $conversations,
    ) {}

    public function index(Request $request, $id)
    {
        try {
            $conversation = $this->conversations->find((int) $id);
            $this->authorize('view', $conversation);

            $beforeId = $request->query('before_id') ? (int) $request->query('before_id') : null;
            $limit = min(max((int) $request->query('limit', 30), 1), 100);

            $messages = $this->messages->listForConversation((int) $id, $beforeId, $limit);

            return response()->json(MessageResource::collection($messages));
        } catch (ModelNotFoundException) {
            return response()->json(['message' => 'Conversation not found.'], 404);
        } catch (AuthorizationException) {
            return response()->json(['message' => 'You do not have permission to view this conversation.'], 403);
        } catch (Throwable $e) {
            report($e);
            return response()->json(['message' => 'Failed to load messages.'], 500);
        }
    }

    public function store(StoreMessageRequest $request, $id)
    {
        try {
            $conversation = $this->conversations->find((int) $id);
            $this->authorize('sendMessage', $conversation);

            $data = MessageData::fromArray([...$request->validated(), 'conversation_id' => $id]);

            if ($request->hasFile('attachment')) {
                $data = $data->withAttachment(
                    $this->handleAttachmentUpload($request, (int) $id)
                );
            }

            $message = $this->messages->send($conversation, $request->user(), $data);

            return response()->json(new MessageResource($message), 201);
        } catch (ModelNotFoundException) {
            return response()->json(['message' => 'Conversation not found.'], 404);
        } catch (ValidationException $e) {
            return response()->json(['message' => $e->getMessage(), 'errors' => $e->errors()], 422);
        } catch (AuthorizationException) {
            return response()->json(['message' => 'You do not have permission to send messages in this conversation.'], 403);
        } catch (Throwable $e) {
            report($e);
            return response()->json(['message' => 'Failed to send message.'], 500);
        }
    }

    public function markRead(Request $request, $id)
    {
        try {
            $conversation = $this->conversations->find((int) $id);
            $this->authorize('markRead', $conversation);

            $latest = $this->messages->markRead($conversation, $request->user());

            return response()->json(['last_read_message_id' => $latest?->id]);
        } catch (ModelNotFoundException) {
            return response()->json(['message' => 'Conversation not found.'], 404);
        } catch (AuthorizationException) {
            return response()->json(['message' => 'You do not have permission to update this conversation.'], 403);
        } catch (Throwable $e) {
            report($e);
            return response()->json(['message' => 'Failed to mark conversation as read.'], 500);
        }
    }

    /**
     * Authenticated-proxy download/inline-preview — same shape as
     * FinancialController::receipt() and every other file-serving endpoint
     * in this app. Never the public disk; gated by the same 'view' ability
     * as reading the conversation at all (an admin auditing a project can
     * open an attachment in a DM they aren't part of; a non-participant,
     * non-admin stranger gets the same 403 they'd get from the message list).
     */
    public function attachment(Request $request, $id)
    {
        try {
            $message = $this->messages->find((int) $id);
            $this->authorize('view', $message->conversation);

            if (!$message->attachment_path || !Storage::disk('local')->exists($message->attachment_path)) {
                return response()->json(['message' => 'Attachment not found.'], 404);
            }

            return Storage::disk('local')->response(
                $message->attachment_path,
                $message->attachment_name,
                ['Content-Type' => $message->attachment_mime ?? 'application/octet-stream']
            );
        } catch (ModelNotFoundException) {
            return response()->json(['message' => 'Message not found.'], 404);
        } catch (AuthorizationException) {
            return response()->json(['message' => 'You do not have permission to view this attachment.'], 403);
        } catch (Throwable $e) {
            report($e);
            return response()->json(['message' => 'Failed to load attachment.'], 500);
        }
    }

    private function handleAttachmentUpload(Request $request, int $conversationId): array
    {
        $file = $request->file('attachment');
        $ext = strtolower($file->getClientOriginalExtension());

        // 'type' from the request only disambiguates voice_note vs. video for
        // a shared container extension (webm) — see ChatAttachmentRules.
        $isVoiceNote = $request->input('type') === 'voice_note';
        $type = ChatAttachmentRules::typeForExtension($ext, $isVoiceNote);

        if (!$type) {
            throw ValidationException::withMessages([
                'attachment' => ['Unsupported file type. Allowed: ' . implode(', ', ChatAttachmentRules::allExtensions()) . '.'],
            ]);
        }

        $storedName = Str::uuid() . '.' . $ext;
        $path = $file->storeAs("chat-attachments/{$conversationId}", $storedName, 'local');

        return [
            'type' => $type,
            'attachment_path' => $path,
            'attachment_name' => $file->getClientOriginalName(),
            'attachment_mime' => $file->getClientMimeType(),
            'attachment_size' => $file->getSize(),
            'attachment_duration_ms' => $request->input('attachment_duration_ms'),
        ];
    }
}
