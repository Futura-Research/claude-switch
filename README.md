# claude-switch

[![Maintainability](https://qlty.sh/gh/Futura-Research/projects/claude-switch/maintainability.svg)](https://qlty.sh/gh/Futura-Research/projects/claude-switch)
[![Code Coverage](https://qlty.sh/gh/Futura-Research/projects/claude-switch/coverage.svg)](https://qlty.sh/gh/Futura-Research/projects/claude-switch)

Switch between multiple Claude Code accounts with named profiles.

If you use Claude Code with more than one Anthropic account (e.g. work + personal), `claude-switch` eliminates the constant log out / log in cycle by giving each account its own isolated config directory.

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
# Create profiles (launches Claude Code auth for each)
claude-switch add work
claude-switch add personal

# Launch Claude with a specific profile
claude-switch --work
claude-switch --personal --dangerously-skip-permissions

# Check which profile would be used
claude-switch which
```

## Usage

### Launch Claude with a profile

```bash
claude-switch --<profile> [any claude flags...]
```

Everything after the profile flag is passed straight through to `claude`.

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
claude-switch add <name> --no-copy   # Create profile without copying existing settings
claude-switch remove <name>          # Remove a profile
claude-switch list                   # List all profiles
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

### Shared project history

All profiles share a single `projects/` directory at `~/.claude-switch/shared/projects/`. This avoids duplicating the 1GB+ of conversation history that Claude stores per directory.

The symlink is created automatically on first launch or profile creation. Existing profiles that already have a real `projects/` directory are left untouched.

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
claude-switch --<profile> [claude flags...]
       │
       ├─ Looks up <profile> in ~/.claude-switch/config.json
       ├─ Sets CLAUDE_CONFIG_DIR to the profile's config directory
       ├─ Spawns: claude [claude flags...]
       └─ Inherits stdio (fully interactive)
```

Resolution order:

1. `--<profile>` flag (if it matches a known profile name)
2. Directory rules (longest prefix match)
3. Default profile

Config is stored at `~/.claude-switch/config.json`. Each profile gets its own directory under `~/.claude-switch/profiles/<name>/`.

## Requirements

- Node.js >= 18
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) installed

## License

Apache 2.0 + Commons Clause — free to use, modify, and include in your projects with attribution to [Futura Research](https://github.com/futura-research). Not for resale. See [LICENSE](LICENSE) for details.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, branching conventions, and code quality standards.
