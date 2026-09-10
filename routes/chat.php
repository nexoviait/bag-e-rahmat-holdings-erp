<?php

use App\Modules\Chat\Http\Controllers\CallController;
use App\Modules\Chat\Http\Controllers\ConversationController;
use App\Modules\Chat\Http\Controllers\MessageController;
use Illuminate\Support\Facades\Route;

/**
 * Chat & calling routes — required from routes/api.php from INSIDE its
 * existing `Route::prefix('v1')->middleware('auth:sanctum')->group(...)`
 * closure, so every route below inherits that prefix + middleware exactly
 * like every other route in api.php. Split into its own file (the first in
 * this app) purely because of volume — ~15 routes and a genuinely new URL
 * namespace, not an extension of an existing resource.
 */
Route::get('/projects/{id}/chat/members', [ConversationController::class, 'members']);
Route::get('/projects/{id}/chat/conversations', [ConversationController::class, 'index']);
Route::post('/projects/{id}/chat/conversations', [ConversationController::class, 'store']);

Route::get('/chat/conversations/{id}', [ConversationController::class, 'show']);
Route::put('/chat/conversations/{id}', [ConversationController::class, 'update']);
Route::get('/chat/conversations/{id}/members', [ConversationController::class, 'participants']);
Route::post('/chat/conversations/{id}/members', [ConversationController::class, 'addMembers']);
Route::delete('/chat/conversations/{id}/members/{userId}', [ConversationController::class, 'removeMember']);
Route::post('/chat/conversations/{id}/leave', [ConversationController::class, 'leave']);

Route::get('/chat/conversations/{id}/messages', [MessageController::class, 'index']);
Route::post('/chat/conversations/{id}/messages', [MessageController::class, 'store']);
Route::post('/chat/conversations/{id}/read', [MessageController::class, 'markRead']);
Route::get('/chat/messages/{id}/attachment', [MessageController::class, 'attachment']);

Route::post('/chat/conversations/{id}/calls', [CallController::class, 'store']);
Route::get('/chat/calls/{id}', [CallController::class, 'show']);
Route::post('/chat/calls/{id}/accept', [CallController::class, 'accept']);
Route::post('/chat/calls/{id}/decline', [CallController::class, 'decline']);
Route::post('/chat/calls/{id}/end', [CallController::class, 'end']);
