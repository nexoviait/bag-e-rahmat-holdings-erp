<?php

namespace App\Modules\Chat\Http\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;

/**
 * Module-local base controller — the shared app\Http\Controllers\Controller is
 * a bare abstract class with no AuthorizesRequests trait (Laravel 12's skeleton
 * dropped it), so $this->authorize() would fatal without adding it here. Same
 * reasoning as App\Modules\Cctv\Http\Controllers\CctvController.
 */
abstract class ChatController extends Controller
{
    use AuthorizesRequests;
}
