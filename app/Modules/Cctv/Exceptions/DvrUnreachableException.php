<?php

namespace App\Modules\Cctv\Exceptions;

use App\Modules\Cctv\Support\CctvErrorCode;
use Throwable;

class DvrUnreachableException extends CctvException
{
    public function __construct(string $userMessage = 'Cannot reach the recorder. Check that it is powered on and reachable from the server network.', ?Throwable $previous = null)
    {
        parent::__construct(CctvErrorCode::DEVICE_UNREACHABLE, $userMessage, $previous);
    }
}
