# PrivGuard Engine — Agent Guidelines (AGENTS.md)

## 🏗️ Architecture

This repo contains the TypeScript source for the PrivGuard engine. It serves two purposes:

1. **npm package** (`@privguard/engine`) — used by the proxy server (Claude Code path)
2. **Skill bundle** (`privguard.cjs`) — used by OpenCode via the `privguard-skill` repo

### Source of Truth

`src/cli.ts` is the single source of truth for the CLI and skill bundle.
**Never edit `privguard-skill/privguard/scripts/privguard.cjs` directly** — it is generated.

## 🚀 Commands

```bash
# Build TypeScript → dist/ (for npm package and proxy)
npm run build

# Bundle cli.ts → dist/privguard.cjs (skill bundle only, no copy)
npm run build:skill

# Bundle + copy to ../privguard-skill/privguard/scripts/privguard.cjs
npm run sync:skill

# Run tests
npm test

# Type check only
npm run check
```

### Sync Workflow

When modifying CLI logic or engine behavior:
1. Edit `src/cli.ts` (or other `src/*.ts` files)
2. Run `npm run sync:skill` to bundle and copy to `privguard-skill`
3. Test: `node ../../privguard-skill/privguard/scripts/privguard.cjs sanitize --input "test@example.com"`
4. Commit changes in both repos

## 🛠️ Code Style & Guidelines

### Naming Conventions
- **Variables/Functions**: camelCase
- **Classes**: PascalCase
- **Constants**: SCREAMING_SNAKE_CASE

### Imports
- Node built-ins: use `node:` prefix (e.g., `import { readFileSync } from 'node:fs'`)
- 2-space indentation

### Error Handling
- CLI errors → JSON to `stderr`: `{"error": "message"}`
- Graceful degradation: if a rule pattern fails to compile, skip and continue

## 🛡️ Security Mandates
1. **Placeholder format**: `<|PG:TYPE_N|>` — not `{{PG:...}}` or `[REDACTED]`
2. **Deterministic**: same value in same session → same placeholder
3. **Restore** placeholders only in final output; code blocks → use env vars
4. **Memory-only mappings**: never persist or send mapping tables externally

## 🧩 Rules
- System rules: `rules/` (published with npm package)
- User custom rules: `.privguard/rules/custom.yml` (never overwrite on upgrade)
- YAML convention: SCREAMING_SNAKE_CASE type, single-quoted regex, `validate:` for algorithmic checks
