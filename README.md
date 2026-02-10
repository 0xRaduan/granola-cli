<p>
  <img src="assets/logo.png" alt="Granola logo" width="160" />
</p>

# Granola CLI (Community Edition)

Community-maintained CLI for Granola meetings.

[![npm version](https://img.shields.io/npm/v/@0xraduan/granola-cli.svg?color=1f8b4c)](https://www.npmjs.com/package/@0xraduan/granola-cli)
[![license](https://img.shields.io/npm/l/@0xraduan/granola-cli.svg?color=2f6f9f)](LICENSE)
[![Release](https://github.com/0xRaduan/granola-cli/actions/workflows/release.yml/badge.svg)](https://github.com/0xRaduan/granola-cli/actions/workflows/release.yml)

Unix-like CLI for Granola meetings with API-first auto mode and cache fallback.

## Features

- Meetings: list, search, view, notes, enhanced summaries, transcripts, export
- Metadata: workspaces, folders, people, shared docs, whoami
- Sync and cache: API-first with fallback, cache-only mode, offline friendly
- Output: JSON, Markdown, JSONL streaming for list/search
- Updates: automatic update checks + `granola update`

## Install (bun)

```bash
bun install -g @0xraduan/granola-cli
```

## Install (npm)

```bash
npm install -g @0xraduan/granola-cli
```

## Run (bunx)

```bash
bunx @0xraduan/granola-cli@latest meeting list --limit 5
```

## Install (curl)

```bash
curl -fsSL https://raw.githubusercontent.com/0xRaduan/granola-cli/main/scripts/install.sh | bash
```

## Run (dev)

```bash
bun src/cli.ts meeting list --limit 5
```

## Build (optional)

```bash
bun run build
```

## Update

```bash
granola update
```

Disable update checks:

```bash
GRANOLA_DISABLE_UPDATE_CHECK=1 granola meeting list --limit 5
```

## Usage

```bash
granola meeting list --limit 10
granola meeting search "standup"
granola meeting view "1:1"
granola meeting notes <id>
granola meeting enhanced <id>
granola meeting transcript <id>
granola meeting export <id>

granola workspace list
granola folder list
granola folder view "Sales"
granola people list
granola people search "sarah"
granola whoami
granola sync
```

## Output and source

- Output defaults to JSON when piped, Markdown when TTY.
- `--output json|markdown`
- `--jsonl` for list/search commands
- `--source auto|api|cache` (auto = API-first with cache fallback)
- `--no-network` forces cache-only

## Notes

The CLI reads tokens from `~/Library/Application Support/Granola/supabase.json` by default.
Use `GRANOLA_CREDENTIALS` and `GRANOLA_CACHE_PATH` to override paths.

## Credits

This project was informed by prior community implementations:

- https://github.com/aaronvanston/granola-cli
- https://github.com/HanifCarroll/granola-cli
- https://github.com/jeffmcfadden/granola-cli
- https://github.com/KierenB/granola-cli
- https://github.com/LucioFranco/granola-cli
- https://github.com/magarcia/granola-cli
- https://github.com/MrMaksimize/granola-cli
