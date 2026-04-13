# claude-switch — Plan

## Problem

Claude Code stores auth and config in a single `~/.claude` directory. If you have multiple Anthropic accounts (e.g. company + personal), you have to log out and back in every time you switch — or manually juggle `CLAUDE_CONFIG_DIR` env vars and shell aliases.

## Solution

A thin CLI wrapper that manages named profiles, each with its own isolated config directory. It intercepts the profile flag, sets `CLAUDE_CONFIG_DIR`, and passes everything else straight through to `claude`.

```
claude-switch --work --dangerously-skip-permissions
```

This launches `claude --dangerously-skip-permissions` with the `work` profile's config directory.

## How It Works

```
claude-switch --<profile> [any claude flags...]
       │
       ├─ Looks up <profile> in ~/.claude-switch/config.json
       ├─ Sets CLAUDE_CONFIG_DIR to the profile's config_dir
       ├─ Spawns: claude [any claude flags...]
       └─ Inherits stdio (fully interactive, not a subprocess pipe)
```

If no `--<profile>` flag is given, it checks auto-switch rules (directory matching) or falls back to the default profile.

## CLI Interface

### Profile Management

```bash
# Add a new profile (creates config dir + launches claude auth)
claude-switch add work
claude-switch add personal

# List all profiles
claude-switch list

# Remove a profile
claude-switch remove work

# Set the default profile
claude-switch default personal
```

### Auto-Switch Rules (optional)

```bash
# Map directories to profiles — auto-detect when no --<profile> given
claude-switch rule add ~/coding/Convose work
claude-switch rule add ~/coding/personal personal

# List rules
claude-switch rule list

# Remove a rule
claude-switch rule remove ~/coding/Convose
```

### Launching Claude

```bash
# Explicit profile — most common usage
claude-switch --work
claude-switch --personal --dangerously-skip-permissions
claude-switch --work -p "fix the tests"

# Auto-detect from cwd (checks rules, then default)
claude-switch
claude-switch --dangerously-skip-permissions

# Check which profile would be used (dry run)
claude-switch which
```

### Shell Alias (recommended)

After install, users add to their `.zshrc` / `.bashrc`:

```bash
alias claude="claude-switch"
```

Then the UX becomes:

```bash
claude --work
claude --personal --dangerously-skip-permissions
claude                    # auto-detects from directory
```

## Config File

Stored at `~/.claude-switch/config.json`:

```json
{
  "profiles": {
    "work": {
      "config_dir": "~/.claude-switch/profiles/work"
    },
    "personal": {
      "config_dir": "~/.claude-switch/profiles/personal"
    }
  },
  "rules": [
    { "directory": "~/coding/Convose", "profile": "work" },
    { "directory": "~/coding/personal", "profile": "personal" }
  ],
  "default": "personal"
}
```

- `profiles` — named profiles, each pointing to an isolated config dir
- `rules` — directory prefix matching (longest match wins), supports `*` globs
- `default` — fallback when no rule matches and no `--<profile>` flag given

Profile config dirs live under `~/.claude-switch/profiles/<name>/` by default, keeping everything organized in one place.

## Flag Resolution Logic

When `claude-switch` is invoked:

1. Scan argv for `--<word>` where `<word>` matches a known profile name
2. If found: consume that flag, use that profile
3. If not found: check `cwd` against rules (longest directory prefix match wins)
4. If no rule matches: use `default` profile
5. If no default set: error with "run `claude-switch add <name>` to set up a profile"
6. Set `CLAUDE_CONFIG_DIR` and `exec` into `claude` with remaining args

This means `--work` is only treated as a profile selector if "work" is a registered profile name. Unknown flags pass through to claude untouched.

## `add` Flow (Interactive)

```
$ claude-switch add work

  Creating profile "work"...
  Config directory: ~/.claude-switch/profiles/work

  Launching Claude Code to authenticate...
  (complete the login flow in your browser)

  Profile "work" created and authenticated.

  Usage:
    claude-switch --work
    alias claude="claude-switch"  # then: claude --work
```

Steps:

1. Create `~/.claude-switch/profiles/work/` directory
2. Update `config.json` with the new profile entry
3. Run `CLAUDE_CONFIG_DIR=~/.claude-switch/profiles/work claude` so the user completes auth
4. Confirm profile is ready

## Tech Stack

- **Language**: TypeScript (same ecosystem as Claude Code)
- **Runtime**: Node.js (>=18)
- **Dependencies**: zero runtime deps — only `node:*` built-in modules
- **Build**: tsup (single-file bundle)
- **Test**: Vitest
- **Lint**: ESLint + Prettier
- **Git hooks**: simple-git-hooks + lint-staged (pre-commit: lint + format, pre-push: tests)
- **Package**: npm, scoped to `@futura-research/claude-switch` (`npx @futura-research/claude-switch` works out of the box)
- **Binary name**: `claude-switch`

### Why zero runtime dependencies?

This is a thin wrapper. `process.argv` parsing is trivial for our flag format. `fs` and `path` handle config. `child_process.spawn` with `stdio: 'inherit'` handles launching claude. No need for commander, yargs, or inquirer.

Dev dependencies (tsup, vitest, eslint, prettier, etc.) don't ship to users.

## License

**Apache 2.0 + Commons Clause**

- **Allowed**: use, modify, distribute, include in projects — with attribution to Futura Research
- **Not allowed**: sell the software or services whose value substantially derives from it
- **Attribution**: all copies must retain the license notice crediting Futura Research

This is a common pattern used by Redis, Confluent, and others to keep software open while preventing resale.

## File Structure

```
claude-switch/
  src/
    index.ts          # Entry point — arg parsing + dispatch
    config.ts         # Load/save ~/.claude-switch/config.json
    profiles.ts       # add, remove, list, default commands
    rules.ts          # rule add, remove, list commands
    resolver.ts       # Profile resolution (flag → rule → default)
    launcher.ts       # Set env + exec into claude
  tests/
    config.test.ts    # Config read/write/init
    profiles.test.ts  # Profile CRUD operations
    rules.test.ts     # Rule CRUD operations
    resolver.test.ts  # Flag parsing, directory matching, fallback
    launcher.test.ts  # Env setup, spawn args
  .github/
    workflows/
      ci.yml          # Lint + test + build on push/PR
      publish.yml     # Build + npm publish on version tags
  .eslintrc.cjs
  .prettierrc
  package.json
  tsconfig.json
  tsup.config.ts
  CONTRIBUTING.md
  LICENSE             # Apache 2.0 + Commons Clause
  README.md
```

## Testing Strategy

All tests use **Vitest**. No mocking of the filesystem — tests use a temp directory (`os.tmpdir()`) as the config root so they run in isolation and clean up after themselves.

| Module      | What to test                                                                                   |
| ----------- | ---------------------------------------------------------------------------------------------- |
| config.ts   | Init creates dir + empty config, load/save round-trips, handles missing file gracefully        |
| profiles.ts | Add creates dir + updates config, remove deletes entry, list formats output, default sets/gets |
| rules.ts    | Add/remove rules, list formatting                                                              |
| resolver.ts | Flag extraction, directory prefix matching (longest wins), default fallback, no-profile error  |
| launcher.ts | Correct env var set, args passed through, claude-not-found error                               |

**Coverage target**: 90%+ on `config`, `profiles`, `rules`, `resolver`. `launcher.ts` is harder to unit test (spawns a process) — test the arg/env assembly, not the spawn itself.

## Branching & Release Strategy

- **`main`** — stable, release-ready. Protected: no direct pushes, requires PR + passing CI.
- **`develop`** — integration branch. Feature branches merge here first.
- **Feature branches** — `feat/<name>` off `develop`. One feature per branch.
- **Bugfix branches** — `fix/<name>` off `develop` (or `main` for hotfixes).

### Release flow

1. `develop` → PR to `main` when ready for a release
2. Tag `main` with semver (`v1.0.0`, `v1.1.0`, etc.)
3. GitHub Action publishes to npm on tag push

### Commit messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add auto-switch rules
fix: handle tilde expansion in config paths
docs: add shell alias instructions to README
chore: configure eslint + prettier
```

## CI Pipeline (GitHub Actions)

### CI — runs on every push and PR to `main` and `develop`

```yaml
steps:
  - Checkout
  - Setup Node 18
  - Install deps (npm ci)
  - Lint (eslint + prettier --check)
  - Test (vitest --coverage)
  - Build (tsup)
  - Upload coverage report
```

### Publish — runs on version tags (`v*`)

```yaml
on:
  push:
    tags: ["v*"]

steps:
  - Checkout
  - Setup Node 18
  - Install deps (npm ci)
  - Build (tsup)
  - Publish (npm publish --access public)
  - Create GitHub Release from tag
```

Requires an `NPM_TOKEN` repository secret (generated from npmjs.com → Access Tokens → Granular Access Token scoped to `@futura-research`).

## npm Publishing

### Package metadata (`package.json`)

```json
{
  "name": "@futura-research/claude-switch",
  "version": "1.0.0",
  "description": "Switch between multiple Claude Code accounts with named profiles",
  "author": "Futura Research",
  "license": "Apache-2.0",
  "repository": {
    "type": "git",
    "url": "https://github.com/futura-research/claude-switch"
  },
  "bin": {
    "claude-switch": "./dist/index.js"
  },
  "files": ["dist"],
  "publishConfig": {
    "access": "public"
  }
}
```

Key points:

- **`name`**: `@futura-research/claude-switch` — scoped to the org. Scoped packages are private by default on npm, so `publishConfig.access: "public"` is required.
- **`files`**: only ships the `dist/` folder — no source, tests, or config files in the published package.
- **`bin`**: registers `claude-switch` as a global command so `npx @futura-research/claude-switch` just works.

### How to publish

**First time (manual):**

```bash
# Log in to npm as a member of the @futura-research org
npm login

# Verify you have publish rights
npm org ls futura-research

# Dry run — see exactly what will be published
npm publish --dry-run

# Publish for real
npm publish --access public
```

**Subsequent releases (automated via CI):**

1. Bump version: `npm version patch|minor|major` (this creates a commit + tag)
2. Push the tag: `git push origin v1.x.x`
3. GitHub Actions picks up the `v*` tag → runs build → `npm publish`

### npm token setup for CI

1. Go to https://www.npmjs.com → Access Tokens → Generate New Token
2. Choose **Granular Access Token**, scope it to `@futura-research/*` packages, permission: **Read and Write**
3. Add it as a GitHub repo secret named `NPM_TOKEN`
4. The publish workflow uses `NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}`

### Install UX for end users

```bash
# Global install (recommended)
npm install -g @futura-research/claude-switch

# One-off usage
npx @futura-research/claude-switch --work

# Or with shell alias
alias claude="npx @futura-research/claude-switch"
```

## Edge Cases

- **Profile name conflicts with claude flags**: We only consume `--<word>` if it exactly matches a profile name. If someone names a profile "help" or "version", that's their problem — but we could warn on `add`.
- **Claude not installed**: Check `which claude` on launch, give a clear error.
- **Windows**: Use `process.env` (works cross-platform), `spawn` with `shell: true` on Windows.
- **Nested directory rules**: Longest prefix match wins. `/home/user/coding/Convose/zerocalls` matches the `/home/user/coding/Convose` rule over `/home/user/coding`.
- **Config dir already exists**: `add` reuses it (might already be authenticated).
- **Tilde expansion**: Expand `~` in config values since JSON doesn't do this natively.

## Implementation Order

### Phase 1 — Project Scaffolding

1. Initialize `package.json` as `@futura-research/claude-switch` with publishConfig, bin, files, repository
2. Configure TypeScript (`tsconfig.json`)
3. Configure tsup (`tsup.config.ts`)
4. Configure ESLint + Prettier
5. Configure Vitest
6. Configure simple-git-hooks + lint-staged
7. Set up GitHub Actions CI workflow
8. Create `CONTRIBUTING.md`

### Phase 2 — Core Logic + Tests

1. `config.ts` + `config.test.ts` — config read/write + init
2. `profiles.ts` + `profiles.test.ts` — add, remove, list, default
3. `rules.ts` + `rules.test.ts` — rule add, remove, list
4. `resolver.ts` + `resolver.test.ts` — flag parsing + directory matching + default fallback
5. `launcher.ts` + `launcher.test.ts` — env setup + exec

### Phase 3 — CLI Wiring + Integration

1. `index.ts` — CLI dispatch (subcommands vs launch mode)
2. End-to-end manual testing
3. README.md — install, usage, examples, attribution notice

### Phase 4 — Publish

1. Final review — lint, test, build all pass clean
2. Set up `NPM_TOKEN` secret in GitHub repo settings
3. Add GitHub Actions publish workflow (triggers on `v*` tags)
4. `npm version 1.0.0` → `git push origin v1.0.0`
5. Verify CI publishes to npm successfully
6. Test `npx @futura-research/claude-switch` from a clean environment
7. Create GitHub Release with changelog
