<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}" class="dark">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Bag E Rahmat Holdings ERP</title>

        <!-- Google Fonts: Space Grotesk & DM Sans -->
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&family=Space+Grotesk:wght@300..700&display=swap" rel="stylesheet">

        @if (!app()->environment('testing') || file_exists(public_path('build/manifest.json')))
            @viteReactRefresh
            @vite(['resources/css/app.css', 'resources/js/app.tsx'])
        @endif
    </head>
    <body class="bg-background text-foreground antialiased selection:bg-gold/40 selection:text-foreground">
        <div id="root"></div>
    </body>
</html>
