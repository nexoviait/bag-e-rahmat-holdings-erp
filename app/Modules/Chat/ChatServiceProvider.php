<?php

namespace App\Modules\Chat;

use App\Models\Call;
use App\Models\Conversation;
use App\Models\ProjectAssignment;
use App\Modules\Chat\Contracts\CallRepositoryInterface;
use App\Modules\Chat\Contracts\ConversationRepositoryInterface;
use App\Modules\Chat\Contracts\MessageRepositoryInterface;
use App\Modules\Chat\Policies\CallPolicy;
use App\Modules\Chat\Policies\ConversationPolicy;
use App\Modules\Chat\Repositories\EloquentCallRepository;
use App\Modules\Chat\Repositories\EloquentConversationRepository;
use App\Modules\Chat\Repositories\EloquentMessageRepository;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

/**
 * Wires this module's Repository interfaces to their Eloquent implementations
 * and registers its Policy — same reasoning as CctvServiceProvider/
 * SiteTrackingServiceProvider: the app has no AuthServiceProvider, so policy
 * auto-discovery would never find a policy living inside App\Modules\...,
 * explicit registration is required.
 */
class ChatServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(ConversationRepositoryInterface::class, EloquentConversationRepository::class);
        $this->app->bind(MessageRepositoryInterface::class, EloquentMessageRepository::class);
        $this->app->bind(CallRepositoryInterface::class, EloquentCallRepository::class);
    }

    public function boot(): void
    {
        Gate::policy(Conversation::class, ConversationPolicy::class);
        Gate::policy(Call::class, CallPolicy::class);

        // The moment a user is unassigned from a project, they must stop
        // seeing (and being able to post into) that project's conversations —
        // a soft-leave (left_at set), not a hard delete, so "X left" history
        // and everyone else's read watermarks stay intact.
        ProjectAssignment::deleted(function (ProjectAssignment $assignment) {
            Conversation::where('project_id', $assignment->project_id)
                ->whereHas('activeParticipants', fn ($q) => $q->where('user_id', $assignment->user_id))
                ->each(function (Conversation $conversation) use ($assignment) {
                    $conversation->participants()
                        ->where('user_id', $assignment->user_id)
                        ->whereNull('left_at')
                        ->update(['left_at' => now()]);
                });
        });
    }
}
