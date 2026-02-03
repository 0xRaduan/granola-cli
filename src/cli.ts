#!/usr/bin/env bun
import { Command } from 'commander';
import { ApiClient } from './lib/api.js';
import { extractAccessToken, readUserInfo } from './lib/auth.js';
import {
  getCacheMeta,
  getDocumentsByFolderFromCache,
  getDocumentById,
  getEnhancedNotes,
  getMeetings,
  getPeopleFromCache,
  getSharedDocumentsFromCache,
  getTranscript,
  loadCacheState,
  getFoldersFromCache,
} from './lib/cache.js';
import { CliError, isCliError } from './lib/errors.js';
import { defaultOutputFormat, formatEnhancedMarkdown, formatExportMarkdown, formatMeetingListMarkdown, formatMeetingMarkdown, formatNotesMarkdown, formatTranscriptMarkdownOutput, printJson } from './lib/output.js';
import type { Document } from './lib/types.js';
import { listFromApi, listFromCache, resolveMeetingIdFromList, type ListOptions, type SourceMode } from './lib/resolve.js';

const program = new Command();

program
  .name('granola')
  .description('Unix-like CLI for Granola meetings')
  .version('0.1.0')
  .option('-o, --output <format>', 'Output format (json, markdown)')
  .option('--jsonl', 'Output JSON Lines for lists')
  .option('--source <mode>', 'Source mode: auto, api, cache', 'auto')
  .option('--no-network', 'Disable network access (force cache)');

function getOutputFormat(opts: Record<string, unknown>): 'json' | 'markdown' {
  const format = (opts.output as string | undefined) || defaultOutputFormat();
  if (format !== 'json' && format !== 'markdown') {
    throw new CliError(`Invalid output format: ${format}`, 5);
  }
  return format;
}

function getSourceMode(opts: Record<string, unknown>): SourceMode {
  if (opts.noNetwork) return 'cache';
  const mode = (opts.source as string | undefined) || 'auto';
  if (mode !== 'auto' && mode !== 'api' && mode !== 'cache') {
    throw new CliError(`Invalid source mode: ${mode}`, 5);
  }
  return mode;
}

function getApiClient(mode: SourceMode, allowFallback: boolean): ApiClient | null {
  if (mode === 'cache') return null;
  try {
    const token = extractAccessToken();
    return new ApiClient(token);
  } catch {
    if (allowFallback) return null;
    throw new CliError('Authentication required. Could not read Granola token.', 2);
  }
}

async function listMeetings(opts: Record<string, unknown>, listOptions: ListOptions): Promise<Document[]> {
  const mode = getSourceMode(opts);
  if (mode === 'cache') {
    const state = loadCacheState();
    return listFromCache(state, listOptions);
  }

  const client = getApiClient(mode, mode === 'auto');
  if (!client) {
    const state = loadCacheState();
    return listFromCache(state, listOptions);
  }

  if (mode === 'api') {
    return listFromApi(client, listOptions);
  }

  try {
    return await listFromApi(client, listOptions);
  } catch {
    const state = loadCacheState();
    return listFromCache(state, listOptions);
  }
}

async function resolveMeetingId(opts: Record<string, unknown>, query: string): Promise<string> {
  const docs = await listMeetings(opts, { limit: 200 });
  const id = await resolveMeetingIdFromList(docs, query);
  if (!id) throw new CliError(`Meeting not found for: ${query}`, 4);
  return id;
}

function outputList(docs: Document[], opts: Record<string, unknown>): void {
  const format = getOutputFormat(opts);
  const jsonl = Boolean(opts.jsonl);
  if (format === 'json') {
    printJson(docs, jsonl);
    return;
  }
  process.stdout.write(`${formatMeetingListMarkdown(docs)}\n`);
}

const meeting = program.command('meeting').description('Meeting operations');

meeting
  .command('list')
  .description('List meetings')
  .option('--limit <n>', 'Limit results', '20')
  .option('--workspace <id>', 'Filter by workspace')
  .option('--folder <id|name>', 'Filter by folder')
  .option('--attendee <name>', 'Filter by attendee')
  .option('--since <date>', 'Filter from date (ISO)')
  .option('--until <date>', 'Filter until date (ISO)')
  .action(async (options) => {
    const opts = { ...program.opts(), ...options };
    const docs = await listMeetings(opts, {
      limit: Number.parseInt(options.limit, 10),
      workspace: options.workspace,
      folder: options.folder,
      attendee: options.attendee,
      since: options.since,
      until: options.until,
    });
    outputList(docs, opts);
  });

meeting
  .command('search')
  .description('Search meetings by title/notes')
  .argument('<query>', 'Search query')
  .option('--limit <n>', 'Limit results', '20')
  .action(async (query, options) => {
    const opts = { ...program.opts(), ...options };
    const docs = await listMeetings(opts, {
      limit: Number.parseInt(options.limit, 10),
      query,
    });
    outputList(docs, opts);
  });

meeting
  .command('view')
  .description('View meeting details')
  .argument('<id|title>', 'Meeting ID or title')
  .action(async (query) => {
    const opts = program.opts();
    const id = await resolveMeetingId(opts, query);
    const mode = getSourceMode(opts);
    const format = getOutputFormat(opts);

    let doc: Document | null = null;
    let enhanced: string | null = null;
    let notes: string | null = null;

    const client = getApiClient(mode, mode === 'auto');
    if (client) {
      try {
        doc = await client.getDocumentMetadata(id);
        notes = doc.notes_markdown || doc.notes_plain || null;
        const docs = await client.getDocuments({ limit: 200, include_last_viewed_panel: true });
        const match = (docs.docs || []).find((d) => d.id === id);
        if (match?.last_viewed_panel?.content) {
          enhanced = formatEnhancedMarkdown(match.last_viewed_panel.content);
        }
      } catch {
        doc = null;
      }
    }

    if (!doc) {
      const state = loadCacheState();
      const cached = getDocumentById(state, id);
      if (!cached) throw new CliError(`Meeting not found for: ${query}`, 4);
      doc = cached;
      notes = cached.notes_markdown || cached.notes_plain || null;
      const panel = getEnhancedNotes(state, id);
      enhanced = panel ? formatEnhancedMarkdown(panel) : null;
    }

    if (format === 'json') {
      printJson({ document: doc, notes, summary: enhanced });
      return;
    }

    const markdown = formatMeetingMarkdown(doc, {
      includeNotes: true,
      notesMarkdown: formatNotesMarkdown(notes),
      includeEnhanced: true,
      enhancedMarkdown: enhanced || '(No summary)',
    });
    process.stdout.write(`${markdown}\n`);
  });

meeting
  .command('notes')
  .description('Show manual notes')
  .argument('<id|title>', 'Meeting ID or title')
  .action(async (query) => {
    const opts = program.opts();
    const id = await resolveMeetingId(opts, query);
    const format = getOutputFormat(opts);
    const mode = getSourceMode(opts);
    let notes: string | null = null;

    const client = getApiClient(mode, mode === 'auto');
    if (client) {
      try {
        const doc = await client.getDocumentMetadata(id);
        notes = doc.notes_markdown || doc.notes_plain || null;
      } catch {
        notes = null;
      }
    }

    if (!notes) {
      const state = loadCacheState();
      const doc = getDocumentById(state, id);
      if (!doc) throw new CliError(`Meeting not found for: ${query}`, 4);
      notes = doc.notes_markdown || doc.notes_plain || null;
    }

    if (format === 'json') {
      printJson({ id, notes });
      return;
    }
    process.stdout.write(`${formatNotesMarkdown(notes)}\n`);
  });

meeting
  .command('enhanced')
  .description('Show AI-generated summary')
  .argument('<id|title>', 'Meeting ID or title')
  .action(async (query) => {
    const opts = program.opts();
    const id = await resolveMeetingId(opts, query);
    const format = getOutputFormat(opts);
    const mode = getSourceMode(opts);
    let summary: string | null = null;

    const client = getApiClient(mode, mode === 'auto');
    if (client) {
      try {
        const docs = await client.getDocuments({ limit: 200, include_last_viewed_panel: true });
        const match = (docs.docs || []).find((d) => d.id === id);
        if (match?.last_viewed_panel?.content) {
          summary = formatEnhancedMarkdown(match.last_viewed_panel.content);
        }
      } catch {
        summary = null;
      }
    }

    if (!summary) {
      const state = loadCacheState();
      const panel = getEnhancedNotes(state, id);
      if (panel) summary = formatEnhancedMarkdown(panel);
    }

    if (!summary) throw new CliError(`No summary available for: ${query}`, 4);

    if (format === 'json') {
      printJson({ id, summary });
      return;
    }
    process.stdout.write(`${summary}\n`);
  });

meeting
  .command('transcript')
  .description('Show meeting transcript')
  .argument('<id|title>', 'Meeting ID or title')
  .action(async (query) => {
    const opts = program.opts();
    const id = await resolveMeetingId(opts, query);
    const format = getOutputFormat(opts);
    const mode = getSourceMode(opts);
    let transcript: string | null = null;

    const client = getApiClient(mode, mode === 'auto');
    if (client) {
      try {
        const segments = await client.getDocumentTranscript(id);
        transcript = formatTranscriptMarkdownOutput(segments);
      } catch {
        transcript = null;
      }
    }

    if (!transcript) {
      const state = loadCacheState();
      const segments = getTranscript(state, id);
      if (!segments) throw new CliError(`No transcript available for: ${query}`, 4);
      transcript = formatTranscriptMarkdownOutput(segments);
    }

    if (format === 'json') {
      printJson({ id, transcript });
      return;
    }
    process.stdout.write(`${transcript}\n`);
  });

meeting
  .command('export')
  .description('Export summary + transcript to Markdown')
  .argument('<id|title>', 'Meeting ID or title')
  .action(async (query) => {
    const opts = program.opts();
    const id = await resolveMeetingId(opts, query);
    const mode = getSourceMode(opts);
    let doc: Document | null = null;
    let summary: string | null = null;
    let transcript: string | null = null;

    const client = getApiClient(mode, mode === 'auto');
    if (client) {
      try {
        doc = await client.getDocumentMetadata(id);
        const docs = await client.getDocuments({ limit: 200, include_last_viewed_panel: true });
        const match = (docs.docs || []).find((d) => d.id === id);
        if (match?.last_viewed_panel?.content) {
          summary = formatEnhancedMarkdown(match.last_viewed_panel.content);
        }
        const segments = await client.getDocumentTranscript(id);
        transcript = formatTranscriptMarkdownOutput(segments);
      } catch {
        doc = null;
      }
    }

    if (!doc) {
      const state = loadCacheState();
      const cached = getDocumentById(state, id);
      if (!cached) throw new CliError(`Meeting not found for: ${query}`, 4);
      doc = cached;
      const panel = getEnhancedNotes(state, id);
      summary = panel ? formatEnhancedMarkdown(panel) : null;
      const segments = getTranscript(state, id);
      transcript = segments ? formatTranscriptMarkdownOutput(segments) : null;
    }

    if (!doc.id) {
      doc = { ...doc, id };
    }

    const markdown = formatExportMarkdown(doc, {
      summary: summary || '(No summary)',
      transcript: transcript || '(No transcript)',
    });
    process.stdout.write(`${markdown}\n`);
  });

const workspace = program.command('workspace').description('Workspace operations');

workspace
  .command('list')
  .description('List workspaces')
  .action(async () => {
    const opts = program.opts();
    const format = getOutputFormat(opts);
    const mode = getSourceMode(opts);

    if (mode === 'cache') {
      const state = loadCacheState();
      const workspaceData = state.workspaceData as Record<string, unknown> | undefined;
      const entries = (workspaceData?.workspaces as Array<Record<string, unknown>>) || [];
      if (format === 'json') {
        printJson(entries);
        return;
      }
      const lines = entries.map((e) => `- ${(e.workspace as Record<string, unknown>)?.display_name || 'Unnamed'} (${(e.workspace as Record<string, unknown>)?.workspace_id})`);
      process.stdout.write(`${lines.join('\n')}\n`);
      return;
    }

    const client = getApiClient(mode, false);
    if (!client) throw new CliError('Authentication required. Could not read Granola token.', 2);
    const response = await client.getWorkspaces();
    if (format === 'json') {
      printJson(response.workspaces);
      return;
    }
    const lines = response.workspaces.map((w) => `- ${w.workspace.display_name} (${w.workspace.workspace_id})`);
    process.stdout.write(`${lines.join('\n')}\n`);
  });

const folder = program.command('folder').description('Folder operations');

folder
  .command('list')
  .description('List folders')
  .action(async () => {
    const opts = program.opts();
    const format = getOutputFormat(opts);
    const mode = getSourceMode(opts);

    if (mode === 'cache') {
      const state = loadCacheState();
      const folders = getFoldersFromCache(state);
      if (format === 'json') {
        printJson(folders);
        return;
      }
      const lines = folders.map((f) => `- ${f.title} (${f.id})`);
      process.stdout.write(`${lines.join('\n')}\n`);
      return;
    }

    const client = getApiClient(mode, false);
    if (!client) throw new CliError('Authentication required. Could not read Granola token.', 2);
    const lists = await client.getDocumentLists();
    if (format === 'json') {
      printJson(lists);
      return;
    }
    const lines = lists.map((l) => `- ${l.title || l.name || 'Untitled'} (${l.id})`);
    process.stdout.write(`${lines.join('\n')}\n`);
  });

folder
  .command('view')
  .description('View folder contents')
  .argument('<id|name>', 'Folder ID or name')
  .action(async (folderIdOrName) => {
    const opts = program.opts();
    const format = getOutputFormat(opts);
    const mode = getSourceMode(opts);

    if (mode === 'cache') {
      const state = loadCacheState();
      const docs = getDocumentsByFolderFromCache(state, folderIdOrName);
      if (docs.length === 0) throw new CliError(`Folder not found: ${folderIdOrName}`, 4);
      if (format === 'json') {
        printJson(docs);
        return;
      }
      process.stdout.write(`${formatMeetingListMarkdown(docs)}\n`);
      return;
    }

    const client = getApiClient(mode, false);
    if (!client) throw new CliError('Authentication required. Could not read Granola token.', 2);
    const lists = await client.getDocumentLists();
    const target = lists.find(
      (f) => f.id === folderIdOrName || (f.title || f.name || '').toLowerCase().includes(folderIdOrName.toLowerCase()),
    );
    if (!target) throw new CliError(`Folder not found: ${folderIdOrName}`, 4);
    const docIds = new Set(target.document_ids || target.documents?.map((d) => d.id) || []);
    const docs = await listFromApi(client, { limit: 200 });
    const filtered = docs.filter((d) => docIds.has(d.id));
    if (format === 'json') {
      printJson(filtered);
      return;
    }
    process.stdout.write(`${formatMeetingListMarkdown(filtered)}\n`);
  });

const people = program.command('people').description('People operations');

people
  .command('list')
  .description('List people')
  .action(async () => {
    const opts = program.opts();
    const format = getOutputFormat(opts);
    const mode = getSourceMode(opts);

    if (mode === 'cache') {
      const state = loadCacheState();
      const list = getPeopleFromCache(state);
      if (format === 'json') {
        printJson(list);
        return;
      }
      const lines = list.map((p) => {
        const name = (p.name as string) || 'Unknown';
        const email = (p.email as string) || '';
        return `- ${name}${email ? ` (${email})` : ''}`;
      });
      process.stdout.write(`${lines.join('\n')}\n`);
      return;
    }

    const client = getApiClient(mode, false);
    if (!client) throw new CliError('Authentication required. Could not read Granola token.', 2);
    const list = await client.getPeople();
    if (format === 'json') {
      printJson(list);
      return;
    }
    const lines = list.map((p) => {
      const name = (p.name as string) || 'Unknown';
      const email = (p.email as string) || '';
      return `- ${name}${email ? ` (${email})` : ''}`;
    });
    process.stdout.write(`${lines.join('\n')}\n`);
  });

people
  .command('search')
  .description('Search people by name/email')
  .argument('<query>', 'Search query')
  .action(async (query) => {
    const opts = program.opts();
    const format = getOutputFormat(opts);
    const mode = getSourceMode(opts);
    const q = query.toLowerCase();

    const list = mode === 'cache'
      ? getPeopleFromCache(loadCacheState())
      : await (getApiClient(mode, false) || (() => { throw new CliError('Authentication required. Could not read Granola token.', 2); })()).getPeople();
    const filtered = list.filter((p) =>
      ((p.name as string | undefined) || '').toLowerCase().includes(q) || ((p.email as string | undefined) || '').toLowerCase().includes(q),
    );

    if (format === 'json') {
      printJson(filtered);
      return;
    }
    const lines = filtered.map((p) => {
      const name = (p.name as string) || 'Unknown';
      const email = (p.email as string) || '';
      return `- ${name}${email ? ` (${email})` : ''}`;
    });
    process.stdout.write(`${lines.join('\n')}\n`);
  });

program
  .command('whoami')
  .description('Show current user info')
  .action(() => {
    const opts = program.opts();
    const format = getOutputFormat(opts);
    const info = readUserInfo();
    if (format === 'json') {
      printJson(info || {});
      return;
    }
    if (!info) {
      process.stdout.write('No user info available.\n');
      return;
    }
    const userInfo = info as Record<string, unknown>;
    const meta = (userInfo.user_metadata as Record<string, unknown> | undefined) || {};
    const name = (meta.name as string) || (userInfo.name as string) || 'Unknown';
    const email = (userInfo.email as string) || 'Unknown';
    const lines = [`Name: ${name}`, `Email: ${email}`];
    process.stdout.write(`${lines.join('\n')}\n`);
  });

program
  .command('sync')
  .description('Refresh Granola data from API')
  .action(async () => {
    const opts = program.opts();
    const mode = getSourceMode(opts);
    if (mode === 'cache') throw new CliError('Network disabled. Use --source api to sync.', 5);
    const client = getApiClient(mode, false);
    if (!client) throw new CliError('Authentication required. Could not read Granola token.', 2);
    await client.refreshGoogleEvents();
    process.stdout.write('Sync requested.\n');
  });

program
  .command('cache')
  .description('Show cache status')
  .action(() => {
    const meta = getCacheMeta();
    printJson(meta);
  });

program
  .command('shared')
  .description('List shared documents (cache only)')
  .action(() => {
    const opts = program.opts();
    const format = getOutputFormat(opts);
    const state = loadCacheState();
    const docs = getSharedDocumentsFromCache(state);
    if (format === 'json') {
      printJson(docs);
      return;
    }
    process.stdout.write(`${formatMeetingListMarkdown(docs)}\n`);
  });

program.parseAsync(process.argv).catch((err: unknown) => {
  if (isCliError(err)) {
    console.error(err.message);
    process.exit(err.exitCode);
  }
  if (err instanceof Error) {
    console.error(err.message);
  } else {
    console.error('Unknown error');
  }
  process.exit(1);
});
