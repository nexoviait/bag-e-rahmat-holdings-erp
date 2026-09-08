<?php

namespace Database\Factories;

use App\Models\Project;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Project>
 */
class ProjectFactory extends Factory
{
    protected $model = Project::class;

    public function definition(): array
    {
        return [
            'name' => fake()->company() . ' ' . fake()->randomElement(['Tower', 'Residency', 'Heights', 'Complex']),
            'code' => 'PRJ-' . fake()->unique()->numberBetween(100, 999),
            'description' => fake()->sentence(),
            'status' => fake()->randomElement(['planning', 'active', 'on_hold', 'completed', 'cancelled']),
            'total_shareholder_project_price' => fake()->randomFloat(2, 1000000, 500000000),
            'total_shareholders' => fake()->numberBetween(1, 30),
            'start_date' => fake()->dateTimeBetween('-2 years', 'now'),
            'end_date' => fake()->dateTimeBetween('now', '+2 years'),
            'created_by' => User::factory(),
        ];
    }
}
