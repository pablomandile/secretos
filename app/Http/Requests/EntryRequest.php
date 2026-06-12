<?php

namespace App\Http\Requests;

use App\Rules\CipherString;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Validación de store/update de entradas. Todos los campos sensibles deben
 * llegar ya cifrados; folder_id y tag_ids deben pertenecer al usuario.
 */
class EntryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $userId = $this->user()->id;
        $cipher = new CipherString;

        return [
            'folder_id' => [
                'nullable',
                Rule::exists('folders', 'id')->where('user_id', $userId),
            ],
            'type' => ['required', 'integer', 'in:1'],
            'title' => ['required', $cipher],
            'username' => ['nullable', $cipher],
            'password' => ['nullable', $cipher],
            'url' => ['nullable', $cipher],
            'notes' => ['nullable', $cipher],
            'favorite' => ['boolean'],

            'custom_fields' => ['array'],
            'custom_fields.*.label' => ['required', $cipher],
            'custom_fields.*.value' => ['required', $cipher],
            'custom_fields.*.type' => ['required', 'integer', 'in:1,2,3'],
            'custom_fields.*.protected' => ['boolean'],
            'custom_fields.*.position' => ['integer', 'min:0'],

            'tag_ids' => ['array'],
            'tag_ids.*' => [Rule::exists('tags', 'id')->where('user_id', $userId)],
        ];
    }
}
