import type { Document, TranscriptSegment } from './types.js';

export function proseMirrorToMarkdown(node: unknown): string {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(proseMirrorToMarkdown).join('');

  const record = node as Record<string, unknown>;
  if (typeof record.text === 'string') return record.text;

  const type = record.type as string | undefined;
  const content = record.content as unknown;
  const inner = content ? proseMirrorToMarkdown(content) : '';

  switch (type) {
    case 'heading':
      return `\n## ${inner}\n`;
    case 'paragraph':
      return `${inner}\n`;
    case 'bulletList':
    case 'orderedList':
      return `${inner}\n`;
    case 'listItem':
      return `- ${inner}`;
    case 'hardBreak':
      return '\n';
    default:
      return inner;
  }
}

export function formatTranscriptMarkdown(segments: TranscriptSegment[], opts: { timestamps?: boolean } = {}): string {
  const lines = segments.map((seg) => {
    const speaker = seg.speaker || (seg.source === 'microphone' ? 'You' : seg.source === 'system' ? 'Them' : 'Speaker');
    const ts = opts.timestamps && seg.start_timestamp ? `[${seg.start_timestamp}] ` : '';
    return `${ts}${speaker}: ${seg.text}`;
  });
  return lines.join('\n');
}

export function formatDocumentFrontmatter(doc: Document): string {
  const created = doc.created_at || doc.google_calendar_event?.start?.dateTime || '';
  const title = doc.title || 'Untitled';
  return [
    '---',
    `granola_id: ${doc.id}`,
    `title: "${title.replace(/"/g, '\\"')}"`,
    `created_at: ${created}`,
    '---',
    '',
  ].join('\n');
}
