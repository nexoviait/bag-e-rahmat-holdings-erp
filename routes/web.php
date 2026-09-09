<?php

use Illuminate\Support\Facades\Route;

// a clean, catchable error.
Route::get('/{any?}', function () {
    return view('welcome');
})->where('any', '^(?!api|clear-cache|optimize-clear).*$');
