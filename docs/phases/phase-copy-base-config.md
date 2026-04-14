# Phase Plan: Profile Config Management — Copy, Reset, Duplicate

**Parent Project:** claude-switch
**Phase:** Standalone feature
**Objective:** Give users full control over profile config state — auto-copy on add, copy base config to any profile on demand, reset a profile to clean slate, and duplicate an existing profile under a new name.

---

## Scope

When a user runs `claude-switch add <name>`, the tool currently creates an empty profile directory, forcing users to lose all their settings, custom commands, project memories, and conversation history. This phase adds:

1. **Auto-copy on add** — `claude-switch add <name>` copies `~/.claude` into the new profile by default (skip with `--no-copy`)
2. **Copy config on demand** — `claude-switch copy-config <profile>` copies the Claude base dir into any existing profile at any time
3. **Reset profile** — `claude-switch reset <profile>` wipes a profile's config directory clean (keeps the profile registered)
4. **Duplicate profile** — `claude-switch duplicate <source> <new-name>` creates a new profile that is a full copy of an existing one

**In scope:**
- `getClaudeBaseDir()` utility to detect the current Claude config directory
- `copyBaseConfig(source, target)` function for recursive directory copy
- `resetProfileDir(profileDir)` function to wipe profile directory contents
- Integration into `addProfile` / `handleAdd` flow with `--no-copy` opt-out
- New `copy-config`, `reset`, `duplicate` CLI commands
- New `duplicateProfile` and `resetProfile` functions in profiles module
- Updated reserved names list to prevent conflicts with new commands
- Updated help text
- Full test coverage for all new and modified code

**Out of scope (deferred):**
- Selective file/directory filtering (copy everything as-is)
- `claude-switch import` / `claude-switch export` for external archives
- Merging configs between profiles
- Interactive confirmation prompts (reset/copy-config are immediate)

---

## Git Branch

- Base branch: `develop`
- Feature branch: `feat/copy-base-config`
- Run: `git checkout develop && git checkout -b feat/copy-base-config`

## Prerequisites

- [ ] **[git: create branch `feat/copy-base-config`]** — Run `git checkout develop && git checkout -b feat/copy-base-config` before touching any code
- [ ] `develop` branch is up to date with `main`

---

## Implementation Checklist

### Group 1: Config Utility

- [ ] **[commit: feat(config): add getClaudeBaseDir helper]** — In `src/config.ts`, add and export `getClaudeBaseDir()`. Logic: return `process.env.CLAUDE_CONFIG_DIR` if set and non-empty, otherwise return `path.join(os.homedir(), ".claude")`. Run tilde expansion on env var values via existing `expandTilde()`. No dependencies on other new code.

- [ ] **[commit: test(config): add tests for getClaudeBaseDir]** — In `tests/config.test.ts`, add a `describe("getClaudeBaseDir")` block with tests: (1) returns `~/.claude` equivalent by default (i.e. `path.join(os.homedir(), ".claude")`), (2) returns expanded `CLAUDE_CONFIG_DIR` env var when set, (3) ignores empty string `CLAUDE_CONFIG_DIR` and falls back to default. Save/restore `process.env.CLAUDE_CONFIG_DIR` in beforeEach/afterEach.

### Group 2: Migrate Module — Copy & Reset Logic

- [ ] **[commit: feat(migrate): add copyBaseConfig function]** — Create `src/migrate.ts` with `copyBaseConfig(sourceDir: string, targetDir: string): { copied: boolean; reason?: string }`. Logic: if `sourceDir` does not exist, return `{ copied: false, reason: "source directory does not exist" }`. If `sourceDir` is empty (no entries via `fs.readdirSync`), return `{ copied: false, reason: "source directory is empty" }`. Otherwise, ensure `targetDir` exists with `fs.mkdirSync(targetDir, { recursive: true })`, then use `fs.cpSync(sourceDir, targetDir, { recursive: true, force: true })` to copy all contents. Return `{ copied: true }`.

- [ ] **[commit: feat(migrate): add resetProfileDir function]** — In `src/migrate.ts`, add and export `resetProfileDir(profileDir: string): void`. Logic: if `profileDir` does not exist, return silently. Read entries with `fs.readdirSync`. For each entry, call `fs.rmSync(path.join(profileDir, entry), { recursive: true, force: true })`. This removes all contents but preserves the profile directory itself.

- [ ] **[commit: test(migrate): add tests for copyBaseConfig and resetProfileDir]** — Create `tests/migrate.test.ts`. For `copyBaseConfig`: (1) copies files and subdirectories recursively, (2) returns `{ copied: false }` when source does not exist, (3) returns `{ copied: false }` when source is empty, (4) overwrites existing files in target, (5) copies nested directory structures correctly. For `resetProfileDir`: (1) removes all files and subdirectories from profile dir, (2) preserves the profile directory itself, (3) handles already-empty directory without error, (4) handles non-existent directory without error. Use temp directories consistent with existing test patterns (`fs.mkdtempSync` + cleanup).

### Group 3: Profile Layer — copyFrom, duplicate, reset

- [ ] **[commit: feat(profiles): accept copyFrom option in addProfile]** — In `src/profiles.ts`, update `addProfile` signature to `addProfile(name: string, baseDirOverride?: string, options?: { copyFrom?: string })`. After `fs.mkdirSync(profileDir, ...)`, if `options?.copyFrom` is provided, call `copyBaseConfig(options.copyFrom, profileDir)`. Import `copyBaseConfig` from `./migrate.js`. Return type stays `string`. No change to existing callers (options param is optional).

- [ ] **[commit: feat(profiles): add duplicateProfile function]** — In `src/profiles.ts`, add and export `duplicateProfile(sourceName: string, targetName: string, baseDirOverride?: string): string`. Logic: (1) validate `targetName` with existing `validateProfileName()`, (2) load config and verify `sourceName` exists (throw if not), (3) verify `targetName` does not already exist (throw if so), (4) get source profile dir from config, (5) create target profile dir with `fs.mkdirSync`, (6) call `copyBaseConfig(sourceDir, targetDir)`, (7) add target profile entry to config with its `config_dir`, (8) save config, (9) return target profile dir path.

- [ ] **[commit: feat(profiles): add resetProfile function]** — In `src/profiles.ts`, add and export `resetProfile(name: string, baseDirOverride?: string): void`. Logic: (1) load config and verify profile exists (throw if not), (2) get profile dir from config, (3) call `resetProfileDir(profileDir)` from `./migrate.js`. The profile stays registered in config, only its directory contents are cleared.

- [ ] **[commit: test(profiles): test copyFrom, duplicateProfile, and resetProfile]** — In `tests/profiles.test.ts`, add three new describe blocks. **`addProfile with copyFrom`**: (1) copies source contents when copyFrom provided, (2) creates normally when copyFrom not provided (unchanged), (3) creates normally when copyFrom path does not exist (no error). **`duplicateProfile`**: (1) creates new profile with source's files, (2) registers new profile in config, (3) does not set new profile as default, (4) throws when source does not exist, (5) throws when target already exists, (6) throws on invalid target name. **`resetProfile`**: (1) clears all files in profile dir, (2) keeps profile registered in config, (3) throws when profile does not exist. Set up fake dirs with sample files in temp space.

### Group 4: CLI — handleAdd with --no-copy

- [ ] **[commit: feat(cli): add --no-copy flag to handleAdd]** — In `src/cli.ts`, update `handleAdd(args, baseDirOverride?)`:
  1. Check for `--no-copy` in `args` and remove it, storing a boolean `noCopy`.
  2. Extract name from remaining args via `requireName()`.
  3. If `noCopy` is false, resolve Claude base dir via `getClaudeBaseDir()` and pass as `copyFrom` option to `addProfile(name, baseDirOverride, { copyFrom })`.
  4. If `noCopy` is true, call `addProfile(name, baseDirOverride)` without options.
  5. When copy happens, log: `"  Copied settings from <sourceDir>"`.
  Import `getClaudeBaseDir` from `./config.js`.

- [ ] **[commit: test(cli): test handleAdd with --no-copy flag]** — In `tests/cli.test.ts`, add tests in `handleAdd` describe block: (1) creates profile without error when `--no-copy` is passed, (2) handles `--no-copy` before name: `["--no-copy", "work"]`, (3) handles `--no-copy` after name: `["work", "--no-copy"]`, (4) logs copy message when base dir exists and `--no-copy` not passed.

### Group 5: CLI — handleCopyConfig command

- [ ] **[commit: feat(cli): add copy-config command]** — In `src/cli.ts`, add `handleCopyConfig(args, baseDirOverride?)`. Logic: (1) extract profile name via `requireName(args, "Usage: claude-switch copy-config <profile>")`, (2) load config and verify profile exists (error + exit if not), (3) get profile dir from config, (4) get source dir via `getClaudeBaseDir()`, (5) call `copyBaseConfig(sourceDir, profileDir)`, (6) if copied, log `'Copied config from "<sourceDir>" to profile "<name>".'`, (7) if not copied, log the reason. Register `"copy-config"` in the `commands` dispatch table in `run()`.

- [ ] **[commit: test(cli): test handleCopyConfig command]** — In `tests/cli.test.ts`, add `describe("handleCopyConfig")` block: (1) copies base config to existing profile, (2) exits with error when profile does not exist, (3) exits with error when name is missing, (4) dispatches correctly via `run(["copy-config", "work"])`.

### Group 6: CLI — handleReset command

- [ ] **[commit: feat(cli): add reset command]** — In `src/cli.ts`, add `handleReset(args, baseDirOverride?)`. Logic: (1) extract profile name via `requireName(args, "Usage: claude-switch reset <profile>")`, (2) call `resetProfile(name, baseDirOverride)` (handles validation), (3) log `'Profile "<name>" has been reset.'`. Register `"reset"` in the `commands` dispatch table in `run()`.

- [ ] **[commit: test(cli): test handleReset command]** — In `tests/cli.test.ts`, add `describe("handleReset")` block: (1) resets existing profile, (2) exits with error when profile does not exist, (3) exits with error when name is missing, (4) dispatches correctly via `run(["reset", "work"])`.

### Group 7: CLI — handleDuplicate command

- [ ] **[commit: feat(cli): add duplicate command]** — In `src/cli.ts`, add `handleDuplicate(args, baseDirOverride?)`. Logic: (1) extract source name from `args[0]` (error if missing with `"Usage: claude-switch duplicate <source> <new-name>"`), (2) extract target name from `args[1]` (error if missing with same usage), (3) call `duplicateProfile(source, target, baseDirOverride)`, (4) log `'Profile "<target>" created as a copy of "<source>".'`. Register `"duplicate"` in the `commands` dispatch table in `run()`.

- [ ] **[commit: test(cli): test handleDuplicate command]** — In `tests/cli.test.ts`, add `describe("handleDuplicate")` block: (1) duplicates existing profile, (2) exits with error when source does not exist, (3) exits with error when target already exists, (4) exits with error when args are missing, (5) dispatches correctly via `run(["duplicate", "work", "work-copy"])`.

### Group 8: Reserved Names, Help Text & Cleanup

- [ ] **[commit: feat(profiles): add new commands to reserved names]** — In `src/profiles.ts`, add `"copy-config"`, `"reset"`, `"duplicate"` to the `RESERVED_NAMES` array. This prevents users from creating profiles that collide with the new command names.

- [ ] **[commit: test(profiles): test new reserved names]** — In `tests/profiles.test.ts`, extend the "throws on reserved name" test to include `"copy-config"`, `"reset"`, and `"duplicate"`.

- [ ] **[commit: docs(cli): update help text with new commands]** — In `src/cli.ts`, update `printUsage()` to include:
  ```
  claude-switch add <name> [--no-copy]         Add a new profile (copies settings by default)
  claude-switch copy-config <name>             Copy base Claude config to a profile
  claude-switch reset <name>                   Reset a profile to clean slate
  claude-switch duplicate <source> <new-name>  Duplicate a profile under a new name
  ```

- [ ] **[commit: chore: lint and format all new and modified files]** — Run `npm run lint -- --fix` and `npm run format`. Fix any issues in `src/migrate.ts`, `tests/migrate.test.ts`, and all modified files. Run `npm test` to confirm all tests pass. Run `npm run build` to confirm build succeeds.

---

## Exit Criteria

- [ ] All implementation checklist items above are checked off
- [ ] `npm test` passes with no failures (all existing + new tests green)
- [ ] `npm run lint` passes on all new/modified files
- [ ] `npm run format:check` passes
- [ ] `npm run build` succeeds
- [ ] Manual verification: `claude-switch add test-profile` copies `~/.claude` contents into profile dir
- [ ] Manual verification: `claude-switch add test-profile --no-copy` creates empty profile dir
- [ ] Manual verification: `claude-switch copy-config test-profile` copies `~/.claude` into existing profile
- [ ] Manual verification: `claude-switch reset test-profile` wipes profile dir contents
- [ ] Manual verification: `claude-switch duplicate test-profile test-copy` creates new profile with same files
- [ ] Feature branch ready for PR to `develop`

---

## Commit Order Summary

1. `feat(config): add getClaudeBaseDir helper`
2. `test(config): add tests for getClaudeBaseDir`
3. `feat(migrate): add copyBaseConfig function`
4. `feat(migrate): add resetProfileDir function`
5. `test(migrate): add tests for copyBaseConfig and resetProfileDir`
6. `feat(profiles): accept copyFrom option in addProfile`
7. `feat(profiles): add duplicateProfile function`
8. `feat(profiles): add resetProfile function`
9. `test(profiles): test copyFrom, duplicateProfile, and resetProfile`
10. `feat(cli): add --no-copy flag to handleAdd`
11. `test(cli): test handleAdd with --no-copy flag`
12. `feat(cli): add copy-config command`
13. `test(cli): test handleCopyConfig command`
14. `feat(cli): add reset command`
15. `test(cli): test handleReset command`
16. `feat(cli): add duplicate command`
17. `test(cli): test handleDuplicate command`
18. `feat(profiles): add new commands to reserved names`
19. `test(profiles): test new reserved names`
20. `docs(cli): update help text with new commands`
21. `chore: lint and format all new and modified files`

---

## Notes & Decisions

- **Copy everything, no filtering:** The simplest correct approach. Users get an exact replica of their existing config. Auth tokens will be overwritten when Claude re-authenticates in the new profile. Filtering would add complexity with little benefit.
- **`fs.cpSync` availability:** Node >= 16.7 has `fs.cpSync`. Project requires Node >= 18, so safe to use. Avoids manual recursive copy.
- **`CLAUDE_CONFIG_DIR` precedence for `getClaudeBaseDir`:** If the user already has `CLAUDE_CONFIG_DIR` set (e.g., running within claude-switch), we respect it. This means `copy-config` copies from the currently active profile's dir, which is the correct behavior.
- **Default is copy, opt-out is `--no-copy`:** Most users want settings preserved on add. Making copy the default with explicit opt-out follows principle of least surprise.
- **No error on missing source:** If `~/.claude` doesn't exist (fresh install), `addProfile` and `copy-config` silently proceed without copying. No confusing error messages.
- **`reset` is immediate, no confirmation:** Consistent with `remove` which also has no confirmation prompt. The profile stays registered — only its directory contents are wiped. Users can restore by running `copy-config` afterward.
- **`duplicate` copies from profile dir, not base dir:** Unlike `copy-config` which copies from `~/.claude`, `duplicate` copies from one profile's dir to another. This is the correct semantic — you're cloning a profile, not re-importing base config.
- **Reserved names updated:** `copy-config`, `reset`, `duplicate` added to prevent creating profiles with names that collide with the new commands.
- **Gitflow:** Feature branch `feat/copy-base-config` from `develop`, PR back to `develop`. Follows existing branch naming convention (`feat/core-logic`, `feat/scaffolding`).
