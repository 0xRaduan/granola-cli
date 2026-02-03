import type { ApiClient } from './api.js';
import type { CacheState, Document, DocumentList } from './types.js';
import { getMeetings, getDocumentsByFolderFromCache } from './cache.js';

export type SourceMode = 'auto' | 'api' | 'cache';

export interface ListOptions {
  limit?: number;
  workspace?: string;
  folder?: string;
  attendee?: string;
  since?: string;
  until?: string;
  query?: string;
}

function matchesDate(doc: Document, since?: string, until?: string): boolean {
  const dateStr = doc.created_at || doc.updated_at || doc.google_calendar_event?.start?.dateTime;
  if (!dateStr) return true;
  const time = new Date(dateStr).getTime();
  if (since) {
    const s = new Date(since).getTime();
    if (!Number.isNaN(s) && time < s) return false;
  }
  if (until) {
    const u = new Date(until).getTime();
    if (!Number.isNaN(u) && time > u) return false;
  }
  return true;
}

function matchesAttendee(doc: Document, attendee?: string): boolean {
  if (!attendee) return true;
  const q = attendee.toLowerCase();
  const people: Array<Record<string, unknown>> = Array.isArray(doc.people)
    ? (doc.people as Array<Record<string, unknown>>)
    : doc.people
      ? Object.values(doc.people as Record<string, unknown>) as Array<Record<string, unknown>>
      : [];
  const attendeeList = doc.google_calendar_event?.attendees || [];
  return (
    people.some((p) => (p?.name as string | undefined)?.toLowerCase().includes(q) || (p?.email as string | undefined)?.toLowerCase().includes(q)) ||
    attendeeList.some((a) => (a.displayName || '').toLowerCase().includes(q) || (a.email || '').toLowerCase().includes(q))
  );
}

function matchesQuery(doc: Document, query?: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  const title = (doc.title || '').toLowerCase();
  const notes = (doc.notes_markdown || doc.notes_plain || '').toLowerCase();
  return title.includes(q) || notes.includes(q);
}

function sortByUpdated(a: Document, b: Document): number {
  return new Date(b.updated_at || b.created_at || 0).getTime() - new Date(a.updated_at || a.created_at || 0).getTime();
}

export async function listFromApi(client: ApiClient, options: ListOptions): Promise<Document[]> {
  const limit = options.limit ?? 20;
  let cursor: string | undefined;
  const results: Document[] = [];
  const folderIds = options.folder ? await resolveFolderDocIdsApi(client, options.folder) : null;

  while (results.length < limit) {
    const response = await client.getDocuments({
      limit: 100,
      cursor,
      workspace_id: options.workspace,
      include_last_viewed_panel: false,
    });

    const docs = response.docs || [];
    const filtered = docs
      .filter((d) => d.type === 'meeting' && !d.was_trashed)
      .filter((d) => matchesDate(d, options.since, options.until))
      .filter((d) => matchesAttendee(d, options.attendee))
      .filter((d) => matchesQuery(d, options.query))
      .filter((d) => (folderIds ? folderIds.has(d.id) : true));

    results.push(...filtered);
    cursor = response.next_cursor;
    if (!cursor) break;
  }

  return results.sort(sortByUpdated).slice(0, limit);
}

export function listFromCache(state: CacheState, options: ListOptions): Document[] {
  let docs = getMeetings(state);
  if (options.folder) {
    docs = getDocumentsByFolderFromCache(state, options.folder);
  }

  docs = docs
    .filter((d) => matchesDate(d, options.since, options.until))
    .filter((d) => matchesAttendee(d, options.attendee))
    .filter((d) => matchesQuery(d, options.query));

  return docs.sort(sortByUpdated).slice(0, options.limit ?? 20);
}

export async function resolveMeetingIdFromList(docs: Document[], query: string): Promise<string | null> {
  if (!query) return null;
  const byId = docs.find((d) => d.id === query || d.id.startsWith(query));
  if (byId) return byId.id;
  const lower = query.toLowerCase();
  const byTitle = docs.find((d) => (d.title || '').toLowerCase().includes(lower));
  return byTitle ? byTitle.id : null;
}

async function resolveFolderDocIdsApi(client: ApiClient, folderIdOrName: string): Promise<Set<string> | null> {
  const lists = await client.getDocumentLists();
  const target = lists.find(
    (f) => f.id === folderIdOrName || (f.title || f.name || '').toLowerCase().includes(folderIdOrName.toLowerCase()),
  );
  if (!target) return null;
  const ids = target.document_ids || target.documents?.map((d) => d.id) || [];
  return new Set(ids);
}
