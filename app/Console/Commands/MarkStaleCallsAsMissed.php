<?php

namespace App\Console\Commands;

use App\Modules\Chat\Services\CallService;
use Illuminate\Console\Command;

/**
 * Sweeps calls stuck in 'ringing' for too long — someone whose device never
 * actually delivered the CallRinging push (app closed, notification missed),
 * or who just never picked up. Without this, an unanswered call would sit
 * "ringing" forever in the caller's own UI with no resolution.
 */
class MarkStaleCallsAsMissed extends Command
{
    protected $signature = 'chat:mark-stale-calls-missed';

    protected $description = 'Marks calls that have been ringing too long as missed.';

    public function __construct(
        private readonly CallService $calls,
    ) {
        parent::__construct();
    }

    public function handle(): int
    {
        $count = $this->calls->markStaleAsMissed(60);

        if ($count > 0) {
            $this->info("Marked {$count} stale call(s) as missed.");
        }

        return self::SUCCESS;
    }
}
