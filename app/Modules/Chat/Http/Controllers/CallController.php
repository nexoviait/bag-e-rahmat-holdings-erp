<?php

namespace App\Modules\Chat\Http\Controllers;

use App\Modules\Chat\Http\Resources\CallResource;
use App\Modules\Chat\Services\CallService;
use App\Modules\Chat\Services\ConversationService;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Throwable;

class CallController extends ChatController
{
    public function __construct(
        private readonly CallService $calls,
        private readonly ConversationService $conversations,
    ) {}

    public function store(Request $request, $conversationId)
    {
        try {
            $conversation = $this->conversations->find((int) $conversationId);
            $this->authorize('initiateCall', $conversation);

            $validated = $request->validate([
                'type' => ['required', 'in:audio,video'],
            ]);

            $call = $this->calls->initiate($conversation, $request->user(), $validated['type']);

            return response()->json(new CallResource($call), 201);
        } catch (ModelNotFoundException) {
            return response()->json(['message' => 'Conversation not found.'], 404);
        } catch (ValidationException $e) {
            return response()->json(['message' => $e->getMessage(), 'errors' => $e->errors()], 422);
        } catch (AuthorizationException) {
            return response()->json(['message' => 'You do not have permission to start a call here.'], 403);
        } catch (Throwable $e) {
            report($e);
            return response()->json(['message' => 'Failed to start call.'], 500);
        }
    }

    public function show(Request $request, $id)
    {
        try {
            $call = $this->calls->find((int) $id);
            $this->authorize('view', $call);

            return response()->json(new CallResource($call));
        } catch (ModelNotFoundException) {
            return response()->json(['message' => 'Call not found.'], 404);
        } catch (AuthorizationException) {
            return response()->json(['message' => 'You do not have permission to view this call.'], 403);
        } catch (Throwable $e) {
            report($e);
            return response()->json(['message' => 'Failed to load call.'], 500);
        }
    }

    public function accept(Request $request, $id)
    {
        try {
            $call = $this->calls->find((int) $id);
            $this->authorize('respond', $call);

            $call = $this->calls->accept($call, $request->user());

            return response()->json(new CallResource($call));
        } catch (ModelNotFoundException) {
            return response()->json(['message' => 'Call not found.'], 404);
        } catch (AuthorizationException) {
            return response()->json(['message' => 'This call is no longer ringing for you.'], 403);
        } catch (Throwable $e) {
            report($e);
            return response()->json(['message' => 'Failed to accept call.'], 500);
        }
    }

    public function decline(Request $request, $id)
    {
        try {
            $call = $this->calls->find((int) $id);
            $this->authorize('respond', $call);

            $call = $this->calls->decline($call, $request->user());

            return response()->json(new CallResource($call));
        } catch (ModelNotFoundException) {
            return response()->json(['message' => 'Call not found.'], 404);
        } catch (AuthorizationException) {
            return response()->json(['message' => 'This call is no longer ringing for you.'], 403);
        } catch (Throwable $e) {
            report($e);
            return response()->json(['message' => 'Failed to decline call.'], 500);
        }
    }

    public function end(Request $request, $id)
    {
        try {
            $call = $this->calls->find((int) $id);
            $this->authorize('end', $call);

            $call = $this->calls->end($call, $request->user());

            return response()->json(new CallResource($call));
        } catch (ModelNotFoundException) {
            return response()->json(['message' => 'Call not found.'], 404);
        } catch (AuthorizationException) {
            return response()->json(['message' => 'You are not part of this call.'], 403);
        } catch (Throwable $e) {
            report($e);
            return response()->json(['message' => 'Failed to end call.'], 500);
        }
    }
}
