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

function handleAdd(args: string[]): void {
  const name = args[0];
  if (!name) {
    console.error("Usage: claude-switch add <name>");
    process.exit(1);
  }

  initConfig();

  try {
    const profileDir = addProfile(name);
    console.log(`\n  Creating profile "${name}"...`);
    console.log(`  Config directory: ${profileDir}\n`);
    console.log("  Launching Claude Code to authenticate...");
    console.log("  (complete the login flow in your browser)\n");

    launch({ configDir: profileDir, args: [] });
  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
  }
}

function handleRemove(args: string[]): void {
  const name = args[0];
  if (!name) {
    console.error("Usage: claude-switch remove <name>");
    process.exit(1);
  }

  try {
    removeProfile(name);
    console.log(`Profile "${name}" removed.`);
  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
  }
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
  const name = args[0];
  if (!name) {
    console.error("Usage: claude-switch default <name>");
    process.exit(1);
  }

  try {
    setDefault(name);
    console.log(`Default profile set to "${name}".`);
  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
  }
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
      try {
        addRule(dir, profile);
        console.log(`Rule added: ${dir} → ${profile}`);
      } catch (err) {
        console.error((err as Error).message);
        process.exit(1);
      }
      break;
    }
    case "remove": {
      const dir = args[1];
      if (!dir) {
        console.error("Usage: claude-switch rule remove <directory>");
        process.exit(1);
      }
      try {
        removeRule(dir);
        console.log(`Rule removed for ${dir}.`);
      } catch (err) {
        console.error((err as Error).message);
        process.exit(1);
      }
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
  try {
    const resolved = resolveProfile([], process.cwd());
    console.log(`Profile: ${resolved.name} (via ${resolved.source})`);
    console.log(`Config:  ${resolved.configDir}`);
  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
  }
}

function main(): void {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    // No args — auto-detect and launch
    try {
      initConfig();
      const resolved = resolveProfile([], process.cwd());
      const config = loadConfig();
      const { claudeArgs } = parseArgs([], config);
      launch({ configDir: resolved.configDir, args: claudeArgs });
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }
    return;
  }

  const firstArg = args[0];

  // Handle subcommands
  switch (firstArg) {
    case "add":
      handleAdd(args.slice(1));
      return;
    case "remove":
      handleRemove(args.slice(1));
      return;
    case "list":
      handleList();
      return;
    case "default":
      handleDefault(args.slice(1));
      return;
    case "rule":
      handleRule(args.slice(1));
      return;
    case "which":
      handleWhich();
      return;
    case "--help":
    case "-h":
      printUsage();
      return;
    case "--version":
    case "-v":
      console.log(`claude-switch ${VERSION}`);
      return;
  }

  // Not a subcommand — treat as claude launch with potential profile flag
  try {
    initConfig();
    const resolved = resolveProfile(args, process.cwd());
    const config = loadConfig();
    const { claudeArgs } = parseArgs(args, config);
    launch({ configDir: resolved.configDir, args: claudeArgs });
  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
  }
}

main();
