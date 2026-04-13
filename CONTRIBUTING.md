# Contributing to claude-switch

Thanks for your interest in contributing! This guide will help you get started.

## Getting Started

```bash
# Clone the repo
git clone https://github.com/futura-research/claude-switch.git
cd claude-switch

# Install dependencies
npm install

# Run tests
npm test

# Build
npm run build
```

## Development Workflow

### Branching

- **`main`** — stable, release-ready. Protected branch.
- **`develop`** — integration branch. Feature branches merge here.
- **`feat/<name>`** — new features, branched from `develop`.
- **`fix/<name>`** — bug fixes, branched from `develop` (or `main` for hotfixes).

### Commit Messages

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add auto-switch rules
fix: handle tilde expansion in config paths
docs: add shell alias instructions to README
chore: configure eslint + prettier
test: add resolver edge case tests
```

### Pull Requests

1. Branch from `develop` (or `main` for hotfixes)
2. Make your changes with tests
3. Ensure `npm run lint`, `npm run format:check`, and `npm test` all pass
4. Open a PR to `develop` (or `main` for hotfixes)
5. Keep PRs focused — one feature or fix per PR

## Code Quality

- **Linting**: `npm run lint` (ESLint with TypeScript)
- **Formatting**: `npm run format` (Prettier)
- **Testing**: `npm test` (Vitest)
- **Coverage**: `npm run test:coverage` (90% threshold)

Git hooks run lint + format on pre-commit and tests on pre-push.

## Project Structure

```
src/
  index.ts      — CLI entry point + arg dispatch
  config.ts     — Load/save ~/.claude-switch/config.json
  profiles.ts   — add, remove, list, default commands
  rules.ts      — rule add, remove, list commands
  resolver.ts   — Profile resolution (flag → rule → default)
  launcher.ts   — Set CLAUDE_CONFIG_DIR + exec into claude
tests/
  *.test.ts     — Mirrors src/ modules
```

## Zero Runtime Dependencies

This project has **zero runtime dependencies**. All functionality uses Node.js built-in modules (`fs`, `path`, `child_process`, `os`). Dev dependencies (tsup, vitest, eslint, etc.) are not shipped to users.

Do not add runtime dependencies without discussion in an issue first.

## License

By contributing, you agree that your contributions will be licensed under the [Apache 2.0 + Commons Clause](LICENSE) license.
