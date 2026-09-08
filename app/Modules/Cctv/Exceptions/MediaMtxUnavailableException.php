<?php

namespace App\Modules\Cctv\Exceptions;

use App\Modules\Cctv\Support\CctvErrorCode;
use Throwable;

class MediaMtxUnavailableException extends CctvException
{
    public function __construct(string $userMessage = 'The streaming server is unreachable. Try again shortly.', ?Throwable $previous = null)
    {
        parent::__construct(CctvErrorCode::MEDIAMTX_UNAVAILABLE, $userMessage, $previous);
    }
}
