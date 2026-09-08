<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\ProjectController;
use App\Http\Controllers\Api\AssignmentController;
use App\Http\Controllers\Api\FinancialController;
use App\Http\Controllers\Api\ShareholderController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\RoleController;
use App\Http\Controllers\Api\SettingController;
use App\Http\Controllers\Api\ProjectDocumentController;
use App\Http\Controllers\Api\DocumentTypeController;
use App\Modules\Cctv\Http\Controllers\DeviceController as CctvDeviceController;
use App\Modules\Cctv\Http\Controllers\CameraController as CctvCameraController;
use App\Modules\Cctv\Http\Controllers\CameraAccessController as CctvCameraAccessController;
use App\Modules\Cctv\Http\Controllers\CameraLogController as CctvCameraLogController;
use App\Modules\Cctv\Http\Controllers\StatusController as CctvStatusController;
use App\Modules\Cctv\Http\Controllers\StreamController as CctvStreamController;
use App\Modules\Cctv\Http\Controllers\MediaMtxAuthController;
use App\Modules\Cctv\Http\Controllers\PtzController as CctvPtzController;
use App\Http\Controllers\Api\NotificationController;

Route::prefix('v1')->group(function () {
    // System Settings (Public)
    Route::get('/settings', [SettingController::class, 'index']);

    // Auth Routes
    Route::post('/auth/login', [AuthController::class, 'login']);
    Route::post('/auth/register', [AuthController::class, 'register']);

    // MediaMTX authHTTPAddress webhook — MediaMTX isn't a logged-in user, so
    // this sits outside auth:sanctum entirely. Protected instead by a shared
    // secret baked into the webhook URL configured server-side on MediaMTX
    // (see MediaMtxAuthController), plus throttling since it's the one CCTV
    // endpoint not behind Sanctum.
    Route::middleware('throttle:120,1')->post('/cctv/mediamtx/auth', MediaMtxAuthController::class);

    Route::middleware('auth:sanctum')->group(function () {
        Route::get('/auth/me', [AuthController::class, 'me']);
        Route::put('/auth/profile', [AuthController::class, 'updateProfile']);
        Route::post('/auth/logout', [AuthController::class, 'logout']);

        // Dashboard & Overview Totals
        Route::get('/dashboard/totals', [ReportController::class, 'dashboardTotals']);

        // Projects API
        Route::get('/projects', [ProjectController::class, 'index']);
        Route::post('/projects', [ProjectController::class, 'store']);
        Route::get('/projects/{id}', [ProjectController::class, 'show']);
        Route::put('/projects/{id}', [ProjectController::class, 'update']);
        Route::delete('/projects/{id}', [ProjectController::class, 'destroy']);

        // Project Summary, Reports & Activity
        Route::get('/projects/{id}/summary', [ReportController::class, 'projectSummary']);
        Route::get('/projects/{id}/report', [ReportController::class, 'projectReport']);
        Route::get('/projects/{id}/recent', [ReportController::class, 'projectRecent']);

        // Project Documents
        Route::get('/projects/{id}/documents', [ProjectDocumentController::class, 'index']);
        Route::get('/projects/{id}/documents/assignable-users', [ProjectDocumentController::class, 'assignableUsers']);
        Route::post('/projects/{id}/documents', [ProjectDocumentController::class, 'store']);
        Route::get('/projects/{id}/documents/{docId}/download', [ProjectDocumentController::class, 'download']);
        Route::put('/projects/{id}/documents/{docId}', [ProjectDocumentController::class, 'update']);
        Route::delete('/projects/{id}/documents/{docId}', [ProjectDocumentController::class, 'destroy']);

        // Document Types (dynamic, shared across projects)
        Route::get('/document-types', [DocumentTypeController::class, 'index']);
        Route::post('/document-types', [DocumentTypeController::class, 'store']);

        // CCTV Monitoring — Devices
        Route::get('/cctv/devices', [CctvDeviceController::class, 'index']);
        Route::post('/cctv/devices', [CctvDeviceController::class, 'store']);
        Route::get('/cctv/devices/{id}', [CctvDeviceController::class, 'show']);
        Route::put('/cctv/devices/{id}', [CctvDeviceController::class, 'update']);
        Route::delete('/cctv/devices/{id}', [CctvDeviceController::class, 'destroy']);
        Route::post('/cctv/devices/{id}/test', [CctvDeviceController::class, 'test']);
        Route::get('/cctv/devices/{id}/channels', [CctvDeviceController::class, 'channels']);
        Route::post('/cctv/devices/{id}/sync', [CctvDeviceController::class, 'sync']);

        // CCTV Monitoring — Cameras
        Route::get('/cctv/cameras', [CctvCameraController::class, 'index']);
        Route::get('/cctv/cameras/{id}', [CctvCameraController::class, 'show']);
        Route::put('/cctv/cameras/{id}', [CctvCameraController::class, 'update']);
        Route::get('/cctv/cameras/{id}/logs', [CctvCameraLogController::class, 'index']);
        Route::get('/cctv/cameras/{id}/assignments', [CctvCameraAccessController::class, 'index']);
        Route::post('/cctv/cameras/{id}/assignments', [CctvCameraAccessController::class, 'sync']);
        Route::get('/cctv/cameras/{id}/assignable-users', [CctvCameraAccessController::class, 'assignableUsers']);

        // CCTV Monitoring — Live streaming (MediaMTX-backed) & snapshots
        Route::post('/cctv/live/{id}', [CctvStreamController::class, 'mint']);
        Route::get('/cctv/snapshot/{id}', [CctvStreamController::class, 'snapshot']);

        // CCTV Monitoring — PTZ & Events
        Route::post('/cctv/cameras/{id}/ptz', [CctvPtzController::class, 'command']);
        Route::get('/cctv/events', [CctvCameraLogController::class, 'events']);

        // CCTV Monitoring — Status
        Route::get('/cctv/projects', [CctvStatusController::class, 'projects']);
        Route::get('/cctv/status', CctvStatusController::class);

        // Notifications (generic — not Cctv-specific; camera-offline alerts are
        // just today's only producer of the shared Laravel notifications table)
        Route::get('/notifications', [NotificationController::class, 'index']);
        Route::post('/notifications/{id}/read', [NotificationController::class, 'markRead']);
        Route::post('/notifications/read-all', [NotificationController::class, 'markAllRead']);

        // Financial Modules (budgets, revenues, expenses, owner_payments)
        Route::get('/financials/{type}', [FinancialController::class, 'index']);
        Route::post('/financials/{type}', [FinancialController::class, 'store']);
        Route::put('/financials/{type}/{id}', [FinancialController::class, 'update']);
        Route::delete('/financials/{type}/{id}', [FinancialController::class, 'destroy']);

        // Shareholders & Investments
        Route::get('/shareholders', [ShareholderController::class, 'index']);
        Route::post('/shareholders', [ShareholderController::class, 'store']);
        Route::put('/shareholders/{id}', [ShareholderController::class, 'update']);
        Route::delete('/shareholders/{id}', [ShareholderController::class, 'destroy']);

        Route::get('/shareholder-investments', [ShareholderController::class, 'investments']);
        Route::post('/shareholder-investments', [ShareholderController::class, 'storeInvestment']);
        Route::put('/shareholder-investments/{id}', [ShareholderController::class, 'updateInvestment']);
        Route::delete('/shareholder-investments/{id}', [ShareholderController::class, 'destroyInvestment']);

        // Admin-only Routes
        Route::middleware('role:super_admin|admin')->group(function () {
            Route::get('/admin/users', [UserController::class, 'index']);
            Route::post('/admin/users', [UserController::class, 'store']);
            Route::put('/admin/users/{id}', [UserController::class, 'update']);
            Route::delete('/admin/users/{id}', [UserController::class, 'destroy']);
            Route::post('/admin/users/role', [UserController::class, 'toggleRole']);
            Route::post('/admin/users/status', [UserController::class, 'toggleStatus']);

            Route::get('/admin/assignments', [AssignmentController::class, 'index']);
            Route::post('/admin/assignments/toggle', [AssignmentController::class, 'toggle']);

            // Roles & Permissions Management
            Route::get('/admin/roles', [RoleController::class, 'index']);
            Route::get('/admin/permissions', [RoleController::class, 'permissions']);
            Route::post('/admin/roles', [RoleController::class, 'store']);
            Route::put('/admin/roles/{id}', [RoleController::class, 'update']);
            Route::delete('/admin/roles/{id}', [RoleController::class, 'destroy']);
            Route::post('/admin/roles/permissions', [RoleController::class, 'togglePermission']);

            // System Settings Update & Activity Logs
            Route::post('/admin/settings', [SettingController::class, 'update']);
            Route::get('/admin/activity-logs', [SettingController::class, 'activityLogs']);
        });
    });
});
