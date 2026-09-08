<?php

use App\Console\Commands\PollCctvHealth;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'role' => \Spatie\Permission\Middleware\RoleMiddleware::class,
            'permission' => \Spatie\Permission\Middleware\PermissionMiddleware::class,
            'role_or_permission' => \Spatie\Permission\Middleware\RoleOrPermissionMiddleware::class,
        ]);
    })
    ->withSchedule(function (Schedule $schedule): void {
        // Requires the Laravel scheduler cron entry to actually run in
        // production: `* * * * * php artisan schedule:run` (see deployment docs).
        $schedule->command(PollCctvHealth::class)->everyFiveMinutes()->withoutOverlapping();
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // Ensures every API error response is a clean, friendly JSON message
        // — never a raw PHP stack trace — regardless of APP_DEBUG. Without
        // this, an unexpected server-side failure (a bug, a DB hiccup, a
        // third-party call blowing up) would leak file paths, class names,
        // and the full trace directly to the browser whenever debug mode is
        // left on, which is exactly the kind of thing a real deployment can
        // forget to flip off. Laravel's own reporting/logging pipeline is
        // untouched by this — every exception is still logged server-side
        // exactly as before; only what gets shown to the client changes.
        $exceptions->render(function (Throwable $e, Request $request) {
            if (!$request->expectsJson()) {
                return null;
            }

            // These already render clean, specific, friendly JSON on their
            // own (field-level validation errors, "Unauthenticated.", policy
            // denial messages) — don't touch them.
            if ($e instanceof ValidationException
                || $e instanceof AuthenticationException
                || $e instanceof AuthorizationException) {
                return null;
            }

            if ($e instanceof ModelNotFoundException) {
                return response()->json(['message' => 'The requested item could not be found.'], 404);
            }

            if ($e instanceof HttpExceptionInterface) {
                $status = $e->getStatusCode();
                $message = match ($status) {
                    404 => 'The requested resource does not exist.',
                    405 => 'This action is not supported.',
                    429 => 'Too many requests — please slow down and try again shortly.',
                    default => $e->getMessage() ?: 'The request could not be completed.',
                };

                return response()->json(['message' => $message], $status);
            }

            // Anything else is a genuinely unexpected failure — never expose
            // its class name, file path, or trace to the client.
            return response()->json([
                'message' => 'Something went wrong on our end. Please try again, and contact support if the problem continues.',
            ], 500);
        });
    })->create();
