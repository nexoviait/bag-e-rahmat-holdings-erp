<?php

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Route;

Route::get('/clear-cache', function () {
    Artisan::call('config:clear');
    Artisan::call('cache:clear');
    Artisan::call('route:clear');
    Artisan::call('view:clear');

    return response()->json([
        'status' => 'success',
        'message' => 'Cache cleared successfully! (config, cache, route, view cleared)',
    ]);
});

Route::get('/optimize-clear', function () {
    Artisan::call('optimize:clear');

    return response()->json([
        'status' => 'success',
        'message' => 'Optimization cache cleared successfully!',
    ]);
});

// SPA catch-all — deliberately excludes anything starting with "api" (the
// negative lookahead below) so a mistyped/nonexistent /api/... endpoint
// returns a real JSON 404 instead of silently serving this HTML shell with
// an HTTP 200. Without this, a broken frontend API call would look like a
// "successful" request that happens to return unparseable HTML, instead of
// a clean, catchable error.
Route::get('/{any?}', function () {
    return view('welcome');
})->where('any', '^(?!api|clear-cache|optimize-clear).*$');
