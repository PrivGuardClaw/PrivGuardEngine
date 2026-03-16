# Changelog

All notable changes to this project will be documented in this file.

## [0.2.0] - 2026-03-16

### Added
- Local HTTP proxy server for transparent PII interception
- Support for Anthropic Messages API and OpenAI Chat Completions API
- Streaming (SSE) response handling with placeholder buffering
- Auto-detection and configuration for Claude Code, OpenCode, OpenClaw
- One-click setup: `privguard-proxy init`
- Agent teardown: `privguard-proxy teardown`
- Strict mode (`--strict`) to hide original values in terminal output
- Unit tests for core modules (engine, registry, matcher, proxy)

### Changed
- Placeholder format changed from `{{PG:TYPE_N}}` to `<|PG:TYPE_N|>`
  - Avoids conflicts with template engines (Mustache/Jinja2/Handlebars)
  - More tokenizer-friendly (similar to LLM special tokens)
  - Backward compatible: restore() supports both formats

### Fixed
- Upstream URL routing: preserves original `ANTHROPIC_BASE_URL` when configuring proxy
- Registry isolation: per-request engine instance prevents cross-request leaks
- Streaming placeholder truncation: buffers incomplete `<|PG:...` sequences
- tool_use input scanning: recursively scans all string values

## [0.1.0] - 2026-03-10

### Added
- Core PII detection engine with regex-based matching
- Support for 20+ PII types (phone, email, SSN, API keys, etc.)
- YAML-based rule definitions with confidence levels
- Validation algorithms: Luhn, ID card checksum, SSN format
- CLI tool: `detect`, `sanitize`, `restore` commands
- Diff output formats: plain, ANSI, Markdown
- Code block preservation during restore
