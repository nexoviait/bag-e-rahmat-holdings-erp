<?php

namespace App\Modules\Cctv\Contracts;

use App\Models\DvrDevice;
use App\Models\User;
use App\Modules\Cctv\DTO\DvrDeviceData;
use Illuminate\Database\Eloquent\Collection;

interface DvrDeviceRepositoryInterface
{
    public function findOrFail(int $id): DvrDevice;

    /**
     * @return Collection<int, DvrDevice>
     */
    public function listVisibleTo(User $user, ?int $projectId = null): Collection;

    public function create(DvrDeviceData $data): DvrDevice;

    public function update(DvrDevice $device, DvrDeviceData $data): DvrDevice;

    public function delete(DvrDevice $device): void;

    public function updateStatus(DvrDevice $device, string $status, ?string $error = null): DvrDevice;

    /** Project membership check used by CameraAccessService when validating assignees. */
    public function projectMemberIds(DvrDevice $device): array;
}
