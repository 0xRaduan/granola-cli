export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export interface Document {
  id: string;
  title?: string;
  type?: string;
  created_at?: string;
  updated_at?: string;
  notes_markdown?: string;
  notes_plain?: string;
  was_trashed?: boolean;
  creation_source?: string;
  public?: boolean;
  people?: Record<string, unknown> | Array<Record<string, unknown>>;
  google_calendar_event?: {
    start?: { dateTime?: string };
    attendees?: Array<{ email?: string; displayName?: string }>;
  };
  last_viewed_panel?: { content?: unknown };
}

export interface TranscriptSegment {
  id?: string;
  text: string;
  source?: 'microphone' | 'system' | string;
  start_timestamp?: string;
  end_timestamp?: string;
  speaker?: string;
}

export interface CacheState {
  documents?: Record<string, Document>;
  transcripts?: Record<string, TranscriptSegment[]>;
  documentPanels?: Record<string, Record<string, { content?: unknown; original_content?: string }>>;
  documentLists?: Record<string, string[]>;
  documentListsMetadata?: Record<string, { id: string; title?: string; name?: string; visibility?: string; is_shared?: boolean; deleted_at?: string }>;
  workspaceData?: Record<string, unknown>;
  people?: Record<string, Record<string, unknown>>;
  sharedDocuments?: Record<string, Document>;
}

export interface WorkspaceEntry {
  workspace: {
    workspace_id: string;
    slug?: string;
    display_name?: string;
    created_at?: string;
    updated_at?: string;
  };
  role?: string;
  plan_type?: string;
}

export interface WorkspacesResponse {
  workspaces: WorkspaceEntry[];
}

export interface DocumentsResponse {
  docs?: Document[];
  next_cursor?: string;
}

export interface DocumentList {
  id: string;
  title?: string;
  name?: string;
  workspace_id?: string;
  documents?: Array<{ id: string }>;
  document_ids?: string[];
}

export interface PeopleResponse {
  people?: Array<Record<string, unknown>>;
}
