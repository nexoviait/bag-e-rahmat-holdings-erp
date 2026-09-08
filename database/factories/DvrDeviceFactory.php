<?php

namespace Database\Factories;

use App\Models\DvrDevice;
use App\Models\Project;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<DvrDevice>
 */
class DvrDeviceFactory extends Factory
{
    protected $model = DvrDevice::class;

    public function definition(): array
    {
        return [
            'project_id' => Project::factory(),
            'device_name' => fake()->words(2, true) . ' DVR',
            'brand' => 'Dahua',
            'model' => 'DH-XVR1B16H-I',
            'ip_address' => fake()->localIpv4(),
            'http_port' => 80,
            'rtsp_port' => 554,
            'username' => 'admin',
            'password' => fake()->password(10, 20),
            'serial_number' => strtoupper(fake()->unique()->bothify('??########')),
            'channel_count' => 16,
            'visibility' => DvrDevice::VISIBILITY_ALL,
            'status' => DvrDevice::STATUS_UNKNOWN,
            'is_active' => true,
            'created_by' => User::factory(),
        ];
    }

    public function online(): static
    {
        return $this->state(fn () => ['status' => DvrDevice::STATUS_ONLINE, 'last_seen_at' => now()]);
    }

    public function offline(): static
    {
        return $this->state(fn () => ['status' => DvrDevice::STATUS_OFFLINE]);
    }

    public function unauthorized(): static
    {
        return $this->state(fn () => [
            'status' => DvrDevice::STATUS_UNAUTHORIZED,
            'last_error' => 'The recorder rejected the saved username or password.',
        ]);
    }
}
