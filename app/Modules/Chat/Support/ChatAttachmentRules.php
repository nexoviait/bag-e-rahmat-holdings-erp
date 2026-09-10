<?php

namespace App\Modules\Chat\Support;

/**
 * Single source of truth for what a chat message attachment is allowed to
 * be, and which `messages.type` it maps to. Extension-allowlist checked
 * directly against the upload's original filename — same reasoning as
 * FinancialController::handleReceiptUpload() and ProjectDocumentController:
 * the `mimes` validation rule's MIME-sniffing is unreliable for some
 * real-world phone-camera files, so a plain extension check is both simpler
 * and more predictable.
 */
final class ChatAttachmentRules
{
    private const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    private const VIDEO_EXTENSIONS = ['mp4', 'mov', 'webm'];
    private const VOICE_NOTE_EXTENSIONS = ['webm', 'ogg', 'mp3', 'm4a', 'wav'];
    private const FILE_EXTENSIONS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'zip', 'csv'];

    // 50MB — generous enough for a longer voice note or a phone video clip,
    // without letting chat become a bulk file-storage channel. Requires
    // upload_max_filesize/post_max_size in php.ini to be at least this large
    // too, or the upload never reaches this validation at all.
    public const MAX_SIZE_BYTES = 50 * 1024 * 1024;

    public static function allExtensions(): array
    {
        return [
            ...self::IMAGE_EXTENSIONS,
            ...self::VIDEO_EXTENSIONS,
            ...self::VOICE_NOTE_EXTENSIONS,
            ...self::FILE_EXTENSIONS,
        ];
    }

    /**
     * Derives the `messages.type` enum value from an uploaded file's
     * extension. $isVoiceNote disambiguates audio uploads (webm/ogg/etc.
     * are shared between "video" and "voice_note" extension lists) — the
     * composer sends this flag explicitly since a MediaRecorder voice note
     * and a picked video file can share a container format.
     */
    public static function typeForExtension(string $extension, bool $isVoiceNote = false): ?string
    {
        $ext = strtolower($extension);

        if ($isVoiceNote && in_array($ext, self::VOICE_NOTE_EXTENSIONS, true)) {
            return 'voice_note';
        }
        if (in_array($ext, self::IMAGE_EXTENSIONS, true)) {
            return 'image';
        }
        if (in_array($ext, self::VIDEO_EXTENSIONS, true)) {
            return 'video';
        }
        if (in_array($ext, self::FILE_EXTENSIONS, true) || in_array($ext, self::VOICE_NOTE_EXTENSIONS, true)) {
            return 'file';
        }

        return null;
    }
}
