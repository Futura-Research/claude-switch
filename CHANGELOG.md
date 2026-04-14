# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-04-14

### Added

- **Interactive copy on profile add**: `claude-switch add <name>` prompts whether to copy the existing Claude config directory (`~/.claude`) into the new profile, preserving settings, project memories, and conversation history.
- **`--no-copy` flag**: Use `claude-switch add <name> --no-copy` to skip the prompt and create a clean profile.
- **`copy-config` command**: `claude-switch copy-config <profile>` copies the base Claude config into any existing profile on demand.
- **`reset` command**: `claude-switch reset <profile>` wipes a profile's config directory clean while keeping the profile registered.
- **`duplicate` command**: `claude-switch duplicate <source> <new-name>` creates a new profile as a full copy of an existing one.
- `getClaudeBaseDir()` utility to detect the active Claude config directory (`CLAUDE_CONFIG_DIR` env var or `~/.claude`).

### Fixed

- `run()` now threads `baseDirOverride` through dispatch, fixing test isolation issues when real profiles exist on the host system.

## [1.0.0] - 2026-04-11

### Added

- Initial release with core multi-account switching.
- Named profile management (`add`, `remove`, `list`, `default`).
- Directory-based auto-switching rules (`rule add`, `rule remove`, `rule list`).
- Profile resolution priority: explicit flag > directory rule > default.
- `which` command for dry-run profile resolution.
- Zero runtime dependencies.
