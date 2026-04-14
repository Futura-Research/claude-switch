# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2026-04-15

### Added

- **Category-based copy selection**: When copying config (on `add` or via `copy-config`), an interactive prompt asks which categories to include — Settings, Skills & commands, IDE settings, Conversation history, and In-progress work. Defaults favour useful settings (on) over large data (off).
- **Shared project history**: All profiles automatically symlink `projects/` to `~/.claude-switch/shared/projects/`, eliminating duplicate storage of the 1GB+ conversation history directory. Existing profiles with a real `projects/` directory are left untouched.
- `getSharedDir()` utility to locate the shared data directory.
- `ensureProjectsLink()` utility to create the shared symlink idempotently.
- `copyDir()` utility for recursive directory copy that skips `.git` directories.
- `CopyCategory` type and `COPY_CATEGORIES` metadata for the five selectable copy categories.
- `defaultYes` parameter on `confirm()` so category prompts correctly default to N for large-data options.

### Fixed

- **Auth credentials no longer copied**: `oauthAccount` and `userID` are stripped from `.claude.json` when copying settings to a new profile — the new profile prompts for its own login.
- **`.git` directories excluded from copy**: Plugin and skill directories that are git repositories no longer cause `EACCES` permission errors during config copy.
- **`duplicate` preserves auth**: `duplicateProfile` performs a direct filesystem copy (skipping `.git`) rather than going through the category filter, so auth and all data are preserved for true profile cloning.

### Changed

- `copy-config` is now async — it prompts for categories before copying.
- `projects/` removed from the `history` copy category; it is now shared via symlink rather than copied.

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
