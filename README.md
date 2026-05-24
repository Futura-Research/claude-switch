# claude-switch

[![Maintainability](https://qlty.sh/gh/Futura-Research/projects/claude-switch/maintainability.svg)](https://qlty.sh/gh/Futura-Research/projects/claude-switch)
[![Code Coverage](https://qlty.sh/gh/Futura-Research/projects/claude-switch/coverage.svg)](https://qlty.sh/gh/Futura-Research/projects/claude-switch)

Switch between multiple coding-agent accounts with named profiles.

If you use Claude Code — or OpenAI Codex CLI or Gemini CLI — with more than one account (e.g. work + personal), `claude-switch` eliminates the constant log out / log in cycle by giving each account its own isolated config directory.

Each profile is bound to an **agent** (`claude`, `codex`, or `gemini`). Launching a profile sets that agent's config-directory environment variable and spawns its binary, so a company Claude account, a personal Claude account, and a Codex account can all coexist on one machine.

## Install

```bash
npm install -g @futura-research/claude-switch
```

Or run directly:

```bash
npx @futura-research/claude-switch --help
```

## Quick Start

```bash
# Create profiles (launches the agent's auth flow for each)
claude-switch add work
claude-switch add personal
claude-switch add work-codex --agent codex

# Launch the agent with a specific profile
claude-switch --work
claude-switch --personal --dangerously-skip-permissions

# Check which profile would be used
claude-switch which
```

## Usage

### Launch an agent with a profile

```bash
claude-switch --<profile> [any agent flags...]
```

Everything after the profile flag is passed straight through to the profile's agent.

```bash
claude-switch --work -p "fix the tests"
claude-switch --personal --dangerously-skip-permissions
```

### Auto-detect from directory

When no `--<profile>` flag is given, `claude-switch` checks directory rules, then falls back to the default profile:

```bash
claude-switch                          # uses rule match or default
claude-switch --dangerously-skip-permissions  # same, with flags
```

### Profile management

```bash
claude-switch add <name>             # Create profile + authenticate
claude-switch add <name> --agent codex  # Create a profile for a different agent
claude-switch add <name> --no-copy   # Create profile without copying existing settings
claude-switch remove <name>          # Remove a profile and delete its config directory
claude-switch remove <name> --keep-dir  # Remove but keep the config directory on disk
claude-switch list                   # List all profiles (shows agent + signed-in account)
claude-switch default <name>         # Set the default profile
```

When you create a profile, `claude-switch` asks whether to copy your existing Claude config and — if yes — which categories to include:

```
$ claude-switch add work
  Copy existing Claude settings to new profile? (Y/n)

  What would you like to copy?

  Settings — Theme, model, and general preferences (Y/n)
  Skills & commands — Custom skills, slash commands, and plugins (Y/n)
  IDE settings — VS Code / JetBrains integration config (Y/n)
  Conversation history — Resume sessions and command history (y/N)
  In-progress work — Plans, tasks, and todos (y/N)
```

Auth credentials (`oauthAccount`) are always stripped from the copied config — the new profile will prompt for its own login. Use `--no-copy` to skip all prompts and create a completely clean profile.

### Copy, reset & duplicate

Manage profile config state at any time:

```bash
claude-switch copy-config <name>             # Copy base Claude config into a profile
claude-switch reset <name>                   # Wipe a profile's config (keeps profile registered)
claude-switch duplicate <source> <new-name>  # Clone a profile under a new name
```

**Copy config** prompts for the same category selection as `add`, then copies only the chosen items from `~/.claude` into the profile. Auth credentials are stripped automatically.

```bash
claude-switch copy-config work
```

**Reset** wipes the profile directory clean but keeps it registered — you can then re-authenticate or copy config back in:

```bash
claude-switch reset work          # clean slate
claude-switch copy-config work    # restore from base config
```

**Duplicate** creates a new profile that's an exact clone of an existing one — all data including auth is preserved, and `.git` directories inside plugins are excluded to avoid permission errors:

```bash
claude-switch duplicate work work-staging
```

### Multiple coding agents

Each profile drives a coding agent. Pass `--agent` when creating one:

```bash
claude-switch add work               # defaults to claude
claude-switch add work-codex --agent codex
claude-switch add personal-gemini --agent gemini
```

| Agent    | `--agent` id | Binary   | Config dir env var   |
| -------- | ------------ | -------- | -------------------- |
| Claude Code | `claude`  | `claude` | `CLAUDE_CONFIG_DIR`  |
| OpenAI Codex CLI | `codex` | `codex` | `CODEX_HOME`     |
| Gemini CLI | `gemini`   | `gemini` | `GEMINI_CONFIG_DIR` |

Launching a profile sets the matching environment variable to the profile's config directory and spawns that agent's binary. Profiles created before 1.2.0 (and any without an explicit agent) are treated as `claude`.

> Gemini CLI honours `GEMINI_CONFIG_DIR` on macOS and Linux; it is not respected on Windows.

### Project-pinned profiles

A repository can pin itself to a profile by committing a `.claude-switch` file at its root containing the profile name:

```bash
echo work > .claude-switch
```

When you run `claude-switch` anywhere inside that repository, it uses the named profile. This is committed with the repo, so teammates who share the profile name get the right account automatically — no per-machine setup. Lines starting with `#` are treated as comments.

### Per-profile environment variables

Attach environment variables to a profile; they are injected whenever that profile launches. Useful for API gateways, proxies, or model overrides:

```bash
claude-switch env set work ANTHROPIC_BASE_URL=https://gateway.company.com
claude-switch env set work HTTPS_PROXY=http://proxy.company.com:8080
claude-switch env list work
claude-switch env unset work HTTPS_PROXY
```

### Shared session history

By default all Claude profiles share a single set of session directories under `~/.claude-switch/shared/` — `projects/` (conversation transcripts), `todos/` (per-session todo lists), and `shell-snapshots/`. This avoids duplicating the 1GB+ of history Claude stores per directory, and means a session you started in a project under your **work** profile can be resumed under your **personal** profile in the same project — `claude --resume` sees it.

The symlinks are created automatically on first launch or profile creation. Existing profiles that already have a real `projects/` (or `todos/` / `shell-snapshots/`) directory are left untouched. Codex and Gemini profiles are not shared, since their on-disk layouts differ.

### Directory rules

Map directories to profiles for automatic switching:

```bash
claude-switch rule add ~/work/repos work
claude-switch rule add ~/personal personal
claude-switch rule list
claude-switch rule remove ~/work/repos
```

When you run `claude-switch` inside `~/work/repos/my-project`, it automatically uses the `work` profile (longest directory prefix match wins).

### Shell alias (recommended)

Add to your `~/.zshrc` or `~/.bashrc`:

```bash
alias claude="claude-switch"
```

Then:

```bash
claude --work
claude --personal --dangerously-skip-permissions
claude                    # auto-detects from directory
```

## How it works

```
claude-switch --<profile> [agent flags...]
       │
       ├─ Looks up <profile> in ~/.claude-switch/config.json
       ├─ Sets the agent's config-dir env var to the profile's directory
       ├─ Injects the profile's environment variables
       ├─ Spawns the agent's binary [agent flags...]
       └─ Inherits stdio (fully interactive)
```

Resolution order:

1. `--<profile>` flag (if it matches a known profile name)
2. `.claude-switch` project file (searched from cwd upward)
3. Directory rules (longest prefix match)
4. Default profile

Config is stored at `~/.claude-switch/config.json`. Each profile gets its own directory under `~/.claude-switch/profiles/<name>/`.

## Requirements

- Node.js >= 18
- The CLI for whichever agent a profile uses, installed and on your `PATH` — [Claude Code](https://docs.anthropic.com/en/docs/claude-code), OpenAI Codex CLI, or Gemini CLI

## License

[MIT](LICENSE) — fully open source. You can use, modify, and redistribute `claude-switch` freely (including commercially), provided the copyright notice crediting [Futura Research](https://github.com/futura-research) is retained in copies or substantial portions of the software.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, branching conventions, and code quality standards.
