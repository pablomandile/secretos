<?php

namespace App\Http\Requests;

use App\Rules\CipherString;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class FolderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $userId = $this->user()->id;
        $folderId = $this->route('folder'); // string id (resuelto a mano en el controlador)

        return [
            'name' => ['required', new CipherString],
            'position' => ['integer', 'min:0'],
            'parent_id' => [
                'nullable',
                // No puede ser su propio padre y debe pertenecer al usuario.
                Rule::exists('folders', 'id')->where('user_id', $userId),
                Rule::notIn($folderId ? [$folderId] : []),
            ],
        ];
    }
}
