<?php

namespace App\Modules\Cctv\Exceptions;

use App\Modules\Cctv\Support\CctvErrorCode;
use Throwable;

class MediaMtxRejectedException extends CctvException
{
    public function __construct(string $userMessage = 'The streaming server rejected the request.', ?Throwable $previous = null)
    {
        parent::__construct(CctvErrorCode::MEDIAMTX_REJECTED, $userMessage, $previous);
    }
}
