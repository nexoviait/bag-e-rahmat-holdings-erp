<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    // CCTV Monitoring module — swaps DvrGatewayInterface between the real Dahua
    // HTTP gateway ('live', default) and a deterministic fake ('fake') with zero
    // code changes elsewhere. Lets the whole module — including every error
    // state — be built, tested, and demoed without real DVR hardware reachable.
    'cctv' => [
        'driver' => env('CCTV_DRIVER', 'live'),
    ],

    // CCTV Monitoring module — MediaMTX streaming server.
    // api_url is server-side only (never internet-reachable); webrtc_url/hls_url
    // must be reachable BY THE BROWSER (see Phase 3 of the module plan for why
    // these three are deliberately separate config values).
    'mediamtx' => [
        'api_url' => env('MEDIAMTX_API_URL', 'http://127.0.0.1:9997'),
        'api_version' => env('MEDIAMTX_API_VERSION', 'v3'),
        'api_user' => env('MEDIAMTX_API_USER'),
        'api_pass' => env('MEDIAMTX_API_PASS'),
        'webrtc_url' => env('MEDIAMTX_WEBRTC_URL', 'http://127.0.0.1:8889'),
        'hls_url' => env('MEDIAMTX_HLS_URL', 'http://127.0.0.1:8888'),
        'auth_secret' => env('MEDIAMTX_AUTH_SECRET'),
        'timeout' => env('MEDIAMTX_TIMEOUT', 5),
    ],

];
