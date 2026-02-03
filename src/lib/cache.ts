import { existsSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { CacheState, Document, TranscriptSegment } from './types.js';

const CACHE_PATHS = {
  darwin: join(homedir(), 'Library/Application Support/Granola/cache-v3.json'),
  linux: join(homedir(), '.config/Granola/cache-v3.json'),
  win32: join(homedir(), 'AppData/Roaming/Granola/cache-v3.json'),
};

export function getCachePath(): string {
  if (process.env.GRANOLA_CACHE_PATH) return process.env.GRANOLA_CACHE_PATH;
  const platform = process.platform as keyof typeof CACHE_PATHS;
  return CACHE_PATHS[platform] || CACHE_PATHS.darwin;
}

export function loadCacheState(): CacheState {
  const cachePath = getCachePath();
  if (!existsSync(cachePath)) {
    throw new Error(`Granola cache not found at ${cachePath}`);
  }

  const raw = readFileSync(cachePath, 'utf8');
  const outer = JSON.parse(raw);
  const inner = typeof outer.cache === 'string' ? JSON.parse(outer.cache) : outer.cache;
  return (inner?.state || {}) as CacheState;
}

export function getCacheMeta(): { path: string; exists: boolean; mtimeMs?: number } {
  const cachePath = getCachePath();
  if (!existsSync(cachePath)) return { path: cachePath, exists: false };
  const stats = statSync(cachePath);
  return { path: cachePath, exists: true, mtimeMs: stats.mtimeMs };
}

export function getDocuments(state: CacheState): Document[] {
  return Object.values(state.documents || {});
}

export function getMeetings(state: CacheState): Document[] {
  return getDocuments(state).filter((doc) => doc.type === 'meeting' && !doc.was_trashed);
}

export function getDocumentById(state: CacheState, id: string): Document | undefined {
  return state.documents?.[id];
}

export function getTranscript(state: CacheState, id: string): TranscriptSegment[] | undefined {
  return state.transcripts?.[id];
}

export function getEnhancedNotes(state: CacheState, id: string): unknown | null {
  const panels = state.documentPanels?.[id];
  if (!panels) return null;
  const panelId = Object.keys(panels)[0];
  if (!panelId) return null;
  return panels[panelId]?.content || null;
}

export function getFoldersFromCache(state: CacheState): Array<{ id: string; title: string; noteCount: number; visibility?: string; isShared?: boolean }> {
  const metadata = state.documentListsMetadata || {};
  const lists = state.documentLists || {};
  return Object.values(metadata)
    .filter((f) => f && !f.deleted_at)
    .map((f) => {
      const title = f.title || f.name || '(untitled)';
      const noteCount = (lists[f.id] || []).length;
      return { id: f.id, title, noteCount, visibility: f.visibility, isShared: f.is_shared };
    })
    .sort((a, b) => a.title.localeCompare(b.title));
}

export function getDocumentsByFolderFromCache(state: CacheState, folderIdOrName: string): Document[] {
  const folders = getFoldersFromCache(state);
  const lists = state.documentLists || {};
  const target = folders.find(
    (f) => f.id === folderIdOrName || f.title.toLowerCase().includes(folderIdOrName.toLowerCase()),
  );
  if (!target) return [];
  const docIds = new Set(lists[target.id] || []);
  return getDocuments(state)
    .filter((doc) => docIds.has(doc.id))
    .sort((a, b) => new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime());
}

export function getPeopleFromCache(state: CacheState): Array<Record<string, unknown>> {
  return Object.values(state.people || {}).filter((p) => (p as Record<string, unknown>)?.name) as Array<Record<string, unknown>>;
}

export function getSharedDocumentsFromCache(state: CacheState): Document[] {
  return Object.values(state.sharedDocuments || {}).filter((d) => d?.id) as Document[];
}
