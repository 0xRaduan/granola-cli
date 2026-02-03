import type { Document, TranscriptSegment } from './types.js';
import { formatDocumentFrontmatter, formatTranscriptMarkdown, proseMirrorToMarkdown } from './format.js';

export type OutputFormat = 'json' | 'markdown';

export function defaultOutputFormat(): OutputFormat {
  return process.stdout.isTTY ? 'markdown' : 'json';
}

export function printJson(data: unknown, jsonl = false): void {
  if (jsonl && Array.isArray(data)) {
    for (const item of data) {
      process.stdout.write(`${JSON.stringify(item)}\n`);
    }
    return;
  }
  process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
}

export function formatMeetingListMarkdown(docs: Document[]): string {
  const lines = docs.map((d) => {
    const date = d.created_at || d.updated_at || '';
    const title = d.title || 'Untitled';
    return `- ${title} (${d.id}) ${date ? `\u2014 ${date}` : ''}`;
  });
  return lines.join('\n');
}

export function formatMeetingMarkdown(doc: Document, opts: { includeNotes?: boolean; notesMarkdown?: string; includeEnhanced?: boolean; enhancedMarkdown?: string } = {}): string {
  const title = doc.title || 'Untitled';
  const created = doc.created_at || doc.google_calendar_event?.start?.dateTime || '';
  const parts: string[] = [`# ${title}`, created ? `\n**Date:** ${created}\n` : ''];

  if (opts.includeNotes) {
    parts.push('## Notes');
    parts.push(opts.notesMarkdown || '(No notes)');
    parts.push('');
  }

  if (opts.includeEnhanced) {
    parts.push('## Summary');
    parts.push(opts.enhancedMarkdown || '(No summary)');
    parts.push('');
  }

  return parts.join('\n');
}

export function formatNotesMarkdown(raw: string | undefined | null): string {
  if (!raw) return '(No notes)';
  return raw;
}

export function formatEnhancedMarkdown(proseMirrorDoc: unknown): string {
  const md = proseMirrorToMarkdown(proseMirrorDoc);
  return md.trim() || '(No summary)';
}

export function formatTranscriptMarkdownOutput(segments: TranscriptSegment[]): string {
  return formatTranscriptMarkdown(segments, { timestamps: true });
}

export function formatExportMarkdown(doc: Document, opts: { summary?: string; transcript?: string }): string {
  const frontmatter = formatDocumentFrontmatter(doc);
  const sections: string[] = [frontmatter];

  sections.push('## Summary');
  sections.push(opts.summary || '(No summary)');
  sections.push('');

  sections.push('## Transcript');
  sections.push(opts.transcript || '(No transcript)');
  sections.push('');

  return sections.join('\n');
}
