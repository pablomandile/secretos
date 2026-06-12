import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';

import api from '@/services/api';
import { useKeychainStore } from '@/stores/keychain';

export interface DecryptedCustomField {
    label: string;
    value: string;
    type: number;
    protected: boolean;
    position: number;
}

export interface DecryptedEntry {
    id: string;
    type: number;
    folderId: string | null;
    title: string;
    username: string;
    password: string;
    url: string;
    notes: string;
    favorite: boolean;
    customFields: DecryptedCustomField[];
    tagIds: string[];
    createdAt: string;
    updatedAt: string;
}

export interface DecryptedFolder {
    id: string;
    parentId: string | null;
    name: string;
    position: number;
}

export interface DecryptedTag {
    id: string;
    name: string;
    color: string | null;
}

/** Datos en claro de una entrada al crear/editar (antes de cifrar). */
export interface EntryInput {
    folderId: string | null;
    type: number;
    title: string;
    username: string;
    password: string;
    url: string;
    notes: string;
    favorite: boolean;
    customFields: Omit<DecryptedCustomField, 'position'>[];
    tagIds: string[];
}

export type VaultFilter =
    | { type: 'all' }
    | { type: 'favorites' }
    | { type: 'unfiled' }
    | { type: 'folder'; id: string }
    | { type: 'tag'; id: string };

export const useVaultStore = defineStore('vault', () => {
    const keychain = useKeychainStore();

    const entries = ref<DecryptedEntry[]>([]);
    const trashed = ref<DecryptedEntry[]>([]);
    const folders = ref<DecryptedFolder[]>([]);
    const tags = ref<DecryptedTag[]>([]);
    const loaded = ref(false);

    const query = ref('');
    const filter = ref<VaultFilter>({ type: 'all' });
    const selectedId = ref<string | null>(null);

    // Si la bóveda se bloquea, descartamos TODO el texto descifrado de memoria.
    watch(
        () => keychain.isLocked,
        (locked) => {
            if (locked) reset();
        },
    );

    function reset(): void {
        entries.value = [];
        trashed.value = [];
        folders.value = [];
        tags.value = [];
        loaded.value = false;
        query.value = '';
        filter.value = { type: 'all' };
        selectedId.value = null;
    }

    const dec = (cs: string) => keychain.decrypt(cs);
    const enc = (plain: string) => keychain.encrypt(plain);

    async function decryptEntry(raw: any): Promise<DecryptedEntry> {
        return {
            id: raw.id,
            type: raw.type,
            folderId: raw.folder_id,
            title: await dec(raw.title),
            username: raw.username ? await dec(raw.username) : '',
            password: raw.password ? await dec(raw.password) : '',
            url: raw.url ? await dec(raw.url) : '',
            notes: raw.notes ? await dec(raw.notes) : '',
            favorite: raw.favorite,
            customFields: await Promise.all(
                (raw.custom_fields ?? []).map(async (f: any) => ({
                    label: await dec(f.label),
                    value: await dec(f.value),
                    type: f.type,
                    protected: f.protected,
                    position: f.position,
                })),
            ),
            tagIds: raw.tag_ids ?? [],
            createdAt: raw.created_at,
            updatedAt: raw.updated_at,
        };
    }

    async function encryptEntryPayload(input: EntryInput): Promise<Record<string, unknown>> {
        const optional = async (v: string) => (v ? await enc(v) : null);
        return {
            folder_id: input.folderId,
            type: input.type,
            title: await enc(input.title),
            username: await optional(input.username),
            password: await optional(input.password),
            url: await optional(input.url),
            notes: await optional(input.notes),
            favorite: input.favorite,
            custom_fields: await Promise.all(
                input.customFields.map(async (f, index) => ({
                    label: await enc(f.label),
                    value: await enc(f.value),
                    type: f.type,
                    protected: f.protected,
                    position: index,
                })),
            ),
            tag_ids: input.tagIds,
        };
    }

    async function load(): Promise<void> {
        const { data } = await api.get('/vault');
        folders.value = (data.folders as any[]).map((f) => ({
            id: f.id,
            parentId: f.parent_id,
            name: '', // se completa abajo
            position: f.position,
        }));
        // Descifrado en paralelo.
        await Promise.all([
            ...data.folders.map(async (f: any, i: number) => {
                folders.value[i].name = await dec(f.name);
            }),
        ]);
        tags.value = await Promise.all(
            (data.tags as any[]).map(async (t) => ({
                id: t.id,
                name: await dec(t.name),
                color: t.color,
            })),
        );
        entries.value = await Promise.all((data.entries as any[]).map((e) => decryptEntry(e)));
        loaded.value = true;
    }

    function upsertEntry(entry: DecryptedEntry): void {
        const index = entries.value.findIndex((e) => e.id === entry.id);
        if (index >= 0) entries.value[index] = entry;
        else entries.value.push(entry);
    }

    async function createEntry(input: EntryInput): Promise<DecryptedEntry> {
        const { data } = await api.post('/entries', await encryptEntryPayload(input));
        const entry = await decryptEntry(data.data);
        upsertEntry(entry);
        return entry;
    }

    async function updateEntry(id: string, input: EntryInput): Promise<DecryptedEntry> {
        const { data } = await api.put(`/entries/${id}`, await encryptEntryPayload(input));
        const entry = await decryptEntry(data.data);
        upsertEntry(entry);
        return entry;
    }

    async function toggleFavorite(id: string): Promise<void> {
        const entry = entries.value.find((e) => e.id === id);
        if (!entry) return;
        const { data } = await api.patch(`/entries/${id}`, { favorite: !entry.favorite });
        entry.favorite = data.data.favorite;
    }

    async function deleteEntry(id: string): Promise<void> {
        await api.delete(`/entries/${id}`);
        entries.value = entries.value.filter((e) => e.id !== id);
        if (selectedId.value === id) selectedId.value = null;
    }

    async function createFolder(name: string, parentId: string | null = null): Promise<void> {
        const { data } = await api.post('/folders', { name: await enc(name), parent_id: parentId });
        folders.value.push({ id: data.data.id, parentId: data.data.parent_id, name, position: data.data.position });
    }

    async function renameFolder(id: string, name: string): Promise<void> {
        await api.put(`/folders/${id}`, { name: await enc(name) });
        const folder = folders.value.find((f) => f.id === id);
        if (folder) folder.name = name;
    }

    async function deleteFolder(id: string): Promise<void> {
        await api.delete(`/folders/${id}`);
        folders.value = folders.value.filter((f) => f.id !== id);
        // Las entradas de esa carpeta quedaron sin carpeta (nullOnDelete en el server).
        entries.value.forEach((e) => {
            if (e.folderId === id) e.folderId = null;
        });
        if (filter.value.type === 'folder' && filter.value.id === id) filter.value = { type: 'all' };
    }

    async function createTag(name: string, color: string | null = null): Promise<DecryptedTag> {
        const { data } = await api.post('/tags', { name: await enc(name), color });
        const tag = { id: data.data.id, name, color: data.data.color };
        tags.value.push(tag);
        return tag;
    }

    async function deleteTag(id: string): Promise<void> {
        await api.delete(`/tags/${id}`);
        tags.value = tags.value.filter((t) => t.id !== id);
        entries.value.forEach((e) => {
            e.tagIds = e.tagIds.filter((t) => t !== id);
        });
        if (filter.value.type === 'tag' && filter.value.id === id) filter.value = { type: 'all' };
    }

    // --- Papelera ---
    async function loadTrash(): Promise<void> {
        const { data } = await api.get('/trash');
        trashed.value = await Promise.all((data.entries as any[]).map((e) => decryptEntry(e)));
    }

    async function restoreEntry(id: string): Promise<void> {
        await api.post(`/entries/${id}/restore`);
        const index = trashed.value.findIndex((e) => e.id === id);
        if (index >= 0) {
            const [entry] = trashed.value.splice(index, 1);
            entries.value.push(entry);
        }
    }

    async function purgeEntry(id: string): Promise<void> {
        await api.delete(`/entries/${id}/force`);
        trashed.value = trashed.value.filter((e) => e.id !== id);
    }

    // --- Historial de versiones ---
    interface VersionMeta {
        id: number;
        version: number;
        createdAt: string;
    }

    async function fetchVersions(entryId: string): Promise<VersionMeta[]> {
        const { data } = await api.get(`/entries/${entryId}/versions`);
        return (data.versions as any[]).map((v) => ({ id: v.id, version: v.version, createdAt: v.created_at }));
    }

    async function fetchVersionDetail(entryId: string, versionId: number) {
        const { data } = await api.get(`/entries/${entryId}/versions/${versionId}`);
        return {
            id: data.id as number,
            version: data.version as number,
            createdAt: data.created_at as string,
            title: await dec(data.title),
            username: data.username ? await dec(data.username) : '',
            password: data.password ? await dec(data.password) : '',
            url: data.url ? await dec(data.url) : '',
            notes: data.notes ? await dec(data.notes) : '',
            customFields: await Promise.all(
                (data.custom_fields ?? []).map(async (f: any) => ({
                    label: await dec(f.label),
                    value: await dec(f.value),
                    type: f.type,
                    protected: f.protected,
                    position: f.position,
                })),
            ),
        };
    }

    async function restoreVersion(entryId: string, versionId: number): Promise<DecryptedEntry> {
        const { data } = await api.post(`/entries/${entryId}/versions/${versionId}/restore`);
        const entry = await decryptEntry(data.data);
        upsertEntry(entry);
        return entry;
    }

    const filteredEntries = computed<DecryptedEntry[]>(() => {
        let list = entries.value;
        const f = filter.value;
        if (f.type === 'favorites') list = list.filter((e) => e.favorite);
        else if (f.type === 'unfiled') list = list.filter((e) => e.folderId === null);
        else if (f.type === 'folder') list = list.filter((e) => e.folderId === f.id);
        else if (f.type === 'tag') list = list.filter((e) => e.tagIds.includes(f.id));

        const q = query.value.trim().toLowerCase();
        if (q) {
            list = list.filter((e) =>
                [e.title, e.username, e.url].some((field) => field.toLowerCase().includes(q)),
            );
        }
        return [...list].sort((a, b) => a.title.localeCompare(b.title));
    });

    const selectedEntry = computed(() => entries.value.find((e) => e.id === selectedId.value) ?? null);
    const favoritesCount = computed(() => entries.value.filter((e) => e.favorite).length);

    function tagById(id: string): DecryptedTag | undefined {
        return tags.value.find((t) => t.id === id);
    }

    return {
        entries,
        trashed,
        folders,
        tags,
        loaded,
        query,
        filter,
        selectedId,
        selectedEntry,
        filteredEntries,
        favoritesCount,
        load,
        reset,
        createEntry,
        updateEntry,
        toggleFavorite,
        deleteEntry,
        createFolder,
        renameFolder,
        deleteFolder,
        createTag,
        deleteTag,
        tagById,
        loadTrash,
        restoreEntry,
        purgeEntry,
        fetchVersions,
        fetchVersionDetail,
        restoreVersion,
    };
});
