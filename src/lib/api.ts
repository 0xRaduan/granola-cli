import type { Document, DocumentList, DocumentsResponse, TranscriptSegment, WorkspacesResponse } from './types.js';

const API_BASE = 'https://api.granola.ai';

export class ApiClient {
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  setToken(token: string): void {
    this.token = token;
  }

  private async post<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const response = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      const error = new Error(`API error ${response.status}: ${text || response.statusText}`);
      (error as Error & { status?: number }).status = response.status;
      throw error;
    }

    return response.json() as Promise<T>;
  }

  async getDocuments(options: { limit?: number; cursor?: string; workspace_id?: string; include_last_viewed_panel?: boolean } = {}): Promise<DocumentsResponse> {
    return this.post<DocumentsResponse>('/v2/get-documents', {
      limit: options.limit,
      cursor: options.cursor,
      workspace_id: options.workspace_id,
      include_last_viewed_panel: options.include_last_viewed_panel ?? false,
    });
  }

  async getDocumentMetadata(documentId: string): Promise<Document> {
    return this.post<Document>('/v1/get-document-metadata', { document_id: documentId });
  }

  async getDocumentTranscript(documentId: string): Promise<TranscriptSegment[]> {
    const res = await this.post<TranscriptSegment[] | { transcript?: TranscriptSegment[] }>(
      '/v1/get-document-transcript',
      { document_id: documentId },
    );
    if (Array.isArray(res)) return res;
    if (res.transcript) return res.transcript;
    return [];
  }

  async getDocumentLists(): Promise<DocumentList[]> {
    return this.post<DocumentList[]>('/v2/get-document-lists', {});
  }

  async getWorkspaces(): Promise<WorkspacesResponse> {
    return this.post<WorkspacesResponse>('/v1/get-workspaces', {});
  }

  async getPeople(): Promise<Array<Record<string, unknown>>> {
    return this.post<Array<Record<string, unknown>>>('/v1/get-people', {});
  }

  async refreshGoogleEvents(): Promise<unknown> {
    return this.post('/v1/refresh-google-events', {});
  }
}
