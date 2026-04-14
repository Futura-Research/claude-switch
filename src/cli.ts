import { initConfig, loadConfig, getClaudeBaseDir } from "./config.js";
import {
  addProfile,
  removeProfile,
  listProfiles,
  setDefault,
  resetProfile,
  duplicateProfile,
} from "./profiles.js";
import { addRule, removeRule, listRules } from "./rules.js";
import { resolveProfile, parseArgs } from "./resolver.js";
import { launch } from "./launcher.js";
import { copyBaseConfig } from "./migrate.js";
import { confirm } from "./prompt.js";

const VERSION = "1.1.0";

export function printUsage(): void {
  console.log(
    `
claude-switch — Switch between multiple Claude Code accounts

Usage:
  claude-switch --<profile> [claude flags...]    Launch claude with a profile
  claude-switch [claude flags...]                Auto-detect profile from cwd
  claude-switch add <name> [--no-copy]           Add a new profile (copies settings by default)
  claude-switch remove <name>                    Remove a profile
  claude-switch list                             List all profiles
  claude-switch default <name>                   Set the default profile
  claude-switch copy-config <name>               Copy base Claude config to a profile
  claude-switch reset <name>                     Reset a profile to clean slate
  claude-switch duplicate <source> <new-name>    Duplicate a profile under a new name
  claude-switch rule add <dir> <profile>         Add a directory rule
  claude-switch rule remove <dir>                Remove a directory rule
  claude-switch rule list                        List all rules
  claude-switch which                            Show which profile would be used
  claude-switch --help                           Show this help
  claude-switch --version                        Show version
`.trim(),
  );
}

export function requireName(args: string[], usage: string): string {
  const name = args[0];
  if (!name) {
    console.error(usage);
    process.exit(1);
  }
  return name;
}

export function runWithErrorHandling(fn: () => void): void {
  try {
    fn();
  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
  }
}

export async function handleAdd(args: string[], baseDirOverride?: string): Promise<void> {
  const noCopy = args.includes("--no-copy");
  const filtered = args.filter((a) => a !== "--no-copy");
  const name = requireName(filtered, "Usage: claude-switch add <name> [--no-copy]");
  initConfig(baseDirOverride);

  let copyFrom: string | undefined;
  if (!noCopy) {
    const baseDir = getClaudeBaseDir();
    const fs = await import("node:fs");
    if (fs.existsSync(baseDir) && fs.readdirSync(baseDir).length > 0) {
      const shouldCopy = await confirm("  Copy existing Claude settings to new profile? (Y/n) ");
      if (shouldCopy) {
        copyFrom = baseDir;
      }
    }
  }

  runWithErrorHandling(() => {
    const profileDir = addProfile(name, baseDirOverride, copyFrom ? { copyFrom } : undefined);
    console.log(`\n  Creating profile "${name}"...`);
    console.log(`  Config directory: ${profileDir}\n`);
    if (copyFrom) {
      console.log(`  Copied settings from ${copyFrom}`);
    }
    console.log("  Launching Claude Code to authenticate...");
    console.log("  (complete the login flow in your browser)\n");

    launch({ configDir: profileDir, args: [] });
  });
}

export function handleRemove(args: string[], baseDirOverride?: string): void {
  const name = requireName(args, "Usage: claude-switch remove <name>");
  runWithErrorHandling(() => {
    removeProfile(name, baseDirOverride);
    console.log(`Profile "${name}" removed.`);
  });
}

export function handleList(baseDirOverride?: string): void {
  const profiles = listProfiles(baseDirOverride);
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

export function handleDefault(args: string[], baseDirOverride?: string): void {
  const name = requireName(args, "Usage: claude-switch default <name>");
  runWithErrorHandling(() => {
    setDefault(name, baseDirOverride);
    console.log(`Default profile set to "${name}".`);
  });
}

export function handleRule(args: string[], baseDirOverride?: string): void {
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
        addRule(dir, profile, baseDirOverride);
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
        removeRule(dir, baseDirOverride);
        console.log(`Rule removed for ${dir}.`);
      });
      break;
    }
    case "list": {
      const rules = listRules(baseDirOverride);
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

export function handleCopyConfig(args: string[], baseDirOverride?: string): void {
  const name = requireName(args, "Usage: claude-switch copy-config <profile>");
  runWithErrorHandling(() => {
    const config = loadConfig(baseDirOverride);
    if (!config.profiles[name]) {
      throw new Error(
        `Profile "${name}" does not exist. Add it first with: claude-switch add ${name}`,
      );
    }
    const sourceDir = getClaudeBaseDir();
    const result = copyBaseConfig(sourceDir, config.profiles[name].config_dir);
    if (result.copied) {
      console.log(`Copied config from "${sourceDir}" to profile "${name}".`);
    } else {
      console.log(`Nothing to copy: ${result.reason}.`);
    }
  });
}

export function handleDuplicate(args: string[], baseDirOverride?: string): void {
  const source = args[0];
  const target = args[1];
  if (!source || !target) {
    console.error("Usage: claude-switch duplicate <source> <new-name>");
    process.exit(1);
  }
  runWithErrorHandling(() => {
    duplicateProfile(source, target, baseDirOverride);
    console.log(`Profile "${target}" created as a copy of "${source}".`);
  });
}

export function handleReset(args: string[], baseDirOverride?: string): void {
  const name = requireName(args, "Usage: claude-switch reset <profile>");
  runWithErrorHandling(() => {
    resetProfile(name, baseDirOverride);
    console.log(`Profile "${name}" has been reset.`);
  });
}

export function handleWhich(baseDirOverride?: string): void {
  runWithErrorHandling(() => {
    const resolved = resolveProfile([], process.cwd(), baseDirOverride);
    console.log(`Profile: ${resolved.name} (via ${resolved.source})`);
    console.log(`Config:  ${resolved.configDir}`);
  });
}

export function launchClaude(args: string[], baseDirOverride?: string): void {
  runWithErrorHandling(() => {
    initConfig(baseDirOverride);
    const resolved = resolveProfile(args, process.cwd(), baseDirOverride);
    const config = loadConfig(baseDirOverride);
    const { claudeArgs } = parseArgs(args, config);
    launch({ configDir: resolved.configDir, args: claudeArgs });
  });
}

export function printVersion(): void {
  console.log(`claude-switch ${VERSION}`);
}

export function run(argv: string[], baseDirOverride?: string): void | Promise<void> {
  if (argv.length === 0) {
    launchClaude([], baseDirOverride);
    return;
  }

  const commands: Record<string, ((args: string[]) => void | Promise<void>) | undefined> = {
    add: (args) => handleAdd(args, baseDirOverride),
    remove: (args) => handleRemove(args, baseDirOverride),
    list: () => handleList(baseDirOverride),
    default: (args) => handleDefault(args, baseDirOverride),
    rule: (args) => handleRule(args, baseDirOverride),
    "copy-config": (args) => handleCopyConfig(args, baseDirOverride),
    reset: (args) => handleReset(args, baseDirOverride),
    duplicate: (args) => handleDuplicate(args, baseDirOverride),
    which: () => handleWhich(baseDirOverride),
    "--help": () => printUsage(),
    "-h": () => printUsage(),
    "--version": () => printVersion(),
    "-v": () => printVersion(),
  };

  const handler = commands[argv[0]];
  if (handler) {
    return handler(argv.slice(1));
  } else {
    launchClaude(argv, baseDirOverride);
  }
}
