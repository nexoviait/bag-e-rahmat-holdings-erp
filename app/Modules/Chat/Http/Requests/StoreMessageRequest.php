<?php

namespace App\Modules\Chat\Http\Requests;

use App\Modules\Chat\Support\ChatAttachmentRules;
use Illuminate\Foundation\Http\FormRequest;

class StoreMessageRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            // 'type' is client-supplied ONLY to disambiguate a voice-note
            // recording from a picked file when both arrive as the same
            // container extension (see ChatAttachmentRules::typeForExtension) —
            // the actual persisted type is still derived server-side from the
            // upload's real extension, never trusted verbatim from the client.
            'type' => ['nullable', 'in:text,image,video,file,voice_note'],
            // A message needs a body OR an attachment — never neither.
            'body' => ['required_without:attachment', 'nullable', 'string', 'max:8000'],
            'attachment' => [
                'required_without:body',
                'nullable',
                'file',
                'max:' . (ChatAttachmentRules::MAX_SIZE_BYTES / 1024),
            ],
            'attachment_duration_ms' => ['nullable', 'integer', 'min:0'],
            'reply_to_message_id' => ['nullable', 'integer', 'exists:messages,id'],
        ];
    }
}
