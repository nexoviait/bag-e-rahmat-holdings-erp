<?php

namespace App\Modules\Cctv\Exceptions;

use App\Modules\Cctv\Support\CctvErrorCode;
use Throwable;

class DvrUnauthorizedException extends CctvException
{
    public function __construct(string $userMessage = 'The recorder rejected the saved username or password.', ?Throwable $previous = null)
    {
        parent::__construct(CctvErrorCode::DEVICE_UNAUTHORIZED, $userMessage, $previous);
    }
}
