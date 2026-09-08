<?php

namespace App\Modules\Cctv\Exceptions;

use App\Modules\Cctv\Support\CctvErrorCode;
use Exception;
use Throwable;

/**
 * Base exception for all CCTV-module failures that should surface as a typed,
 * friendly API error rather than a generic 500. Controllers catch this once
 * and translate it into {message, code} — see CctvController::errorResponse().
 */
class CctvException extends Exception
{
    public function __construct(
        private readonly CctvErrorCode $errorCode,
        private readonly string $userMessage,
        ?Throwable $previous = null,
    ) {
        parent::__construct($userMessage, 0, $previous);
    }

    public function errorCode(): CctvErrorCode
    {
        return $this->errorCode;
    }

    public function userMessage(): string
    {
        return $this->userMessage;
    }

    public function httpStatus(): int
    {
        return $this->errorCode->httpStatus();
    }
}
