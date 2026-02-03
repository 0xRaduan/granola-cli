# Granola CLI (Bun + TypeScript)

Unix-like CLI for Granola meetings with API-first auto mode and cache fallback.

## Install

```bash
bun install
```

## Run (dev)

```bash
bun src/cli.ts meeting list --limit 5
```

## Run (via bin)

```bash
./bin/granola meeting list --limit 5
```

## Build (optional)

```bash
bun run build
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
