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

Route::prefix('v1')->group(function () {
    // System Settings (Public)
    Route::get('/settings', [SettingController::class, 'index']);

    // Auth Routes
    Route::post('/auth/login', [AuthController::class, 'login']);
    Route::post('/auth/register', [AuthController::class, 'register']);

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
