<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Project;
use App\Models\Budget;
use App\Models\Revenue;
use App\Models\Expense;
use App\Models\OwnerPayment;
use App\Models\Shareholder;
use App\Models\ShareholderInvestment;
use Illuminate\Foundation\Testing\RefreshDatabase;

class ErpApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    public function test_auth_login(): void
    {
        $response = $this->postJson('/api/v1/auth/login', [
            'email' => 'admin@bage-rahmat.com',
            'password' => 'BagERahmat#2026!Admin',
        ]);

        $response->assertStatus(200)
            ->assertJsonStructure(['user' => ['id', 'name', 'email', 'roles'], 'token']);
    }

    public function test_dashboard_totals(): void
    {
        $user = User::where('email', 'admin@bage-rahmat.com')->first();

        $response = $this->actingAs($user, 'sanctum')
            ->getJson('/api/v1/dashboard/totals');

        $response->assertStatus(200)
            ->assertJsonStructure(['budget', 'revenue', 'expenses', 'payments', 'investments', 'recentLogs']);
    }

    public function test_projects_list(): void
    {
        $user = User::where('email', 'admin@bage-rahmat.com')->first();

        $response = $this->actingAs($user, 'sanctum')
            ->getJson('/api/v1/projects');

        $response->assertStatus(200)
            ->assertJsonCount(2);
    }

    public function test_financial_formulas_and_reports(): void
    {
        $user = User::where('email', 'admin@bage-rahmat.com')->first();
        $project = Project::first();

        $response = $this->actingAs($user, 'sanctum')
            ->getJson("/api/v1/projects/{$project->id}/report");

        $response->assertStatus(200)
            ->assertJsonStructure([
                'budgets',
                'revenues',
                'expenses',
                'ownerPayments',
                'shareholderInvestments',
                'shareholders',
                'logs',
            ]);
    }
}
