<?php

namespace Database\Factories;

use App\Models\CameraChannel;
use App\Models\DvrDevice;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<CameraChannel>
 */
class CameraChannelFactory extends Factory
{
    protected $model = CameraChannel::class;

    public function definition(): array
    {
        $channelNumber = fake()->unique()->numberBetween(1, 16);

        return [
            'dvr_device_id' => DvrDevice::factory(),
            'channel_number' => $channelNumber,
            'camera_name' => 'Camera ' . $channelNumber,
            'location' => fake()->randomElement([
                'Main Entrance', 'Parking Lot', 'Reception', 'Warehouse',
                'Back Gate', 'Corridor', 'Rooftop', 'Site Office',
            ]),
            'stream_path' => 'cam-' . Str::random(10),
            'stream_subtype' => CameraChannel::QUALITY_SUB,
            'status' => CameraChannel::STATUS_UNKNOWN,
            'is_active' => true,
        ];
    }

    public function online(): static
    {
        return $this->state(fn () => ['status' => CameraChannel::STATUS_ONLINE, 'last_seen_at' => now()]);
    }

    public function offline(): static
    {
        return $this->state(fn () => ['status' => CameraChannel::STATUS_OFFLINE]);
    }
}
