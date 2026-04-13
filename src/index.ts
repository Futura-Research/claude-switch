import { initConfig, loadConfig } from "./config.js";
import { addProfile, removeProfile, listProfiles, setDefault } from "./profiles.js";
import { addRule, removeRule, listRules } from "./rules.js";
import { resolveProfile, parseArgs } from "./resolver.js";
import { launch } from "./launcher.js";

const VERSION = "0.0.0";

function printUsage(): void {
  console.log(
    `
claude-switch — Switch between multiple Claude Code accounts

Usage:
  claude-switch --<profile> [claude flags...]    Launch claude with a profile
  claude-switch [claude flags...]                Auto-detect profile from cwd
  claude-switch add <name>                       Add a new profile
  claude-switch remove <name>                    Remove a profile
  claude-switch list                             List all profiles
  claude-switch default <name>                   Set the default profile
  claude-switch rule add <dir> <profile>         Add a directory rule
  claude-switch rule remove <dir>                Remove a directory rule
  claude-switch rule list                        List all rules
  claude-switch which                            Show which profile would be used
  claude-switch --help                           Show this help
  claude-switch --version                        Show version
`.trim(),
  );
}

function requireName(args: string[], usage: string): string {
  const name = args[0];
  if (!name) {
    console.error(usage);
    process.exit(1);
  }
  return name;
}

function runWithErrorHandling(fn: () => void): void {
  try {
    fn();
  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
  }
}

function handleAdd(args: string[]): void {
  const name = requireName(args, "Usage: claude-switch add <name>");
  initConfig();

  runWithErrorHandling(() => {
    const profileDir = addProfile(name);
    console.log(`\n  Creating profile "${name}"...`);
    console.log(`  Config directory: ${profileDir}\n`);
    console.log("  Launching Claude Code to authenticate...");
    console.log("  (complete the login flow in your browser)\n");

    launch({ configDir: profileDir, args: [] });
  });
}

function handleRemove(args: string[]): void {
  const name = requireName(args, "Usage: claude-switch remove <name>");
  runWithErrorHandling(() => {
    removeProfile(name);
    console.log(`Profile "${name}" removed.`);
  });
}

function handleList(): void {
  const profiles = listProfiles();
  if (profiles.length === 0) {
    console.log("No profiles configured. Add one with: claude-switch add <name>");
    return;
  }

  console.log("\nProfiles:\n");
  for (const p of profiles) {
    const marker = p.isDefault ? " (default)" : "";
    console.log(`  ${p.name}${marker}`);
    console.log(`    ${p.configDir}`);
  }
  console.log();
}

function handleDefault(args: string[]): void {
  const name = requireName(args, "Usage: claude-switch default <name>");
  runWithErrorHandling(() => {
    setDefault(name);
    console.log(`Default profile set to "${name}".`);
  });
}

function handleRule(args: string[]): void {
  const subcommand = args[0];

  switch (subcommand) {
    case "add": {
      const dir = args[1];
      const profile = args[2];
      if (!dir || !profile) {
        console.error("Usage: claude-switch rule add <directory> <profile>");
        process.exit(1);
      }
      runWithErrorHandling(() => {
        addRule(dir, profile);
        console.log(`Rule added: ${dir} → ${profile}`);
      });
      break;
    }
    case "remove": {
      const dir = args[1];
      if (!dir) {
        console.error("Usage: claude-switch rule remove <directory>");
        process.exit(1);
      }
      runWithErrorHandling(() => {
        removeRule(dir);
        console.log(`Rule removed for ${dir}.`);
      });
      break;
    }
    case "list": {
      const rules = listRules();
      if (rules.length === 0) {
        console.log("No rules configured. Add one with: claude-switch rule add <dir> <profile>");
        return;
      }
      console.log("\nRules:\n");
      for (const r of rules) {
        console.log(`  ${r.directory} → ${r.profile}`);
      }
      console.log();
      break;
    }
    default:
      console.error("Usage: claude-switch rule <add|remove|list> [args...]");
      process.exit(1);
  }
}

function handleWhich(): void {
  runWithErrorHandling(() => {
    const resolved = resolveProfile([], process.cwd());
    console.log(`Profile: ${resolved.name} (via ${resolved.source})`);
    console.log(`Config:  ${resolved.configDir}`);
  });
}

function launchClaude(args: string[]): void {
  runWithErrorHandling(() => {
    initConfig();
    const resolved = resolveProfile(args, process.cwd());
    const config = loadConfig();
    const { claudeArgs } = parseArgs(args, config);
    launch({ configDir: resolved.configDir, args: claudeArgs });
  });
}

const COMMANDS: Record<string, ((args: string[]) => void) | undefined> = {
  add: (args) => handleAdd(args),
  remove: (args) => handleRemove(args),
  list: () => handleList(),
  default: (args) => handleDefault(args),
  rule: (args) => handleRule(args),
  which: () => handleWhich(),
  "--help": () => printUsage(),
  "-h": () => printUsage(),
  "--version": () => console.log(`claude-switch ${VERSION}`),
  "-v": () => console.log(`claude-switch ${VERSION}`),
};

function main(): void {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    launchClaude([]);
    return;
  }

  const handler = COMMANDS[args[0]];
  if (handler) {
    handler(args.slice(1));
  } else {
    launchClaude(args);
  }
}

main();
