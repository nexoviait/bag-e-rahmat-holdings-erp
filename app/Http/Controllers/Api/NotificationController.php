<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Throwable;

/**
 * Generic — reads the app-wide Laravel notifications table (via the
 * Notifiable trait already on User) rather than anything Cctv-specific.
 * Camera-offline alerts are today's only producer; this controller doesn't
 * know or care what type a notification is.
 */
class NotificationController extends Controller
{
    /** Latest 20 notifications plus the unread count, for the AppShell alerts bell. */
    public function index(Request $request)
    {
        try {
            $user = $request->user();

            return response()->json([
                'data' => $user->notifications()->limit(20)->get(),
                'unread_count' => $user->unreadNotifications()->count(),
            ]);
        } catch (Throwable) {
            return response()->json(['message' => 'Failed to load notifications.'], 500);
        }
    }

    public function markRead(Request $request, string $id)
    {
        try {
            $notification = $request->user()->notifications()->where('id', $id)->first();

            if (!$notification) {
                return response()->json(['message' => 'Notification not found.'], 404);
            }

            $notification->markAsRead();

            return response()->json(['message' => 'Marked as read.']);
        } catch (Throwable) {
            return response()->json(['message' => 'Failed to update notification.'], 500);
        }
    }

    public function markAllRead(Request $request)
    {
        try {
            $request->user()->unreadNotifications()->update(['read_at' => now()]);

            return response()->json(['message' => 'All notifications marked as read.']);
        } catch (Throwable) {
            return response()->json(['message' => 'Failed to update notifications.'], 500);
        }
    }
}
