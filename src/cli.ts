import { initConfig, loadConfig, getClaudeBaseDir, getSharedDir } from "./config.js";
import {
  addProfile,
  removeProfile,
  listProfiles,
  setDefault,
  resetProfile,
  duplicateProfile,
  setProfileEnv,
  unsetProfileEnv,
  getProfileEnv,
} from "./profiles.js";
import { addRule, removeRule, listRules } from "./rules.js";
import { resolveProfile, parseArgs } from "./resolver.js";
import { launch } from "./launcher.js";
import { copyBaseConfig, ensureSharedDirs, COPY_CATEGORIES, type CopyCategory } from "./migrate.js";
import { getAgent } from "./agents.js";
import { readAccountInfo, formatAccount } from "./account.js";
import { confirm } from "./prompt.js";

const VERSION = "1.2.0";

export function printUsage(): void {
  console.log(
    `
claude-switch — Switch between multiple coding-agent accounts

Usage:
  claude-switch --<profile> [agent flags...]     Launch the agent with a profile
  claude-switch [agent flags...]                 Auto-detect profile from cwd
  claude-switch add <name> [--agent <id>] [--no-copy]
                                                 Add a profile (agent: claude|codex|gemini)
  claude-switch remove <name> [--keep-dir]       Remove a profile (deletes config dir by default)
  claude-switch list                             List all profiles
  claude-switch default <name>                   Set the default profile
  claude-switch copy-config <name>               Copy base Claude config to a profile
  claude-switch reset <name>                     Reset a profile to clean slate
  claude-switch duplicate <source> <new-name>    Duplicate a profile under a new name
  claude-switch env set <name> KEY=VALUE...      Set per-profile environment variables
  claude-switch env unset <name> KEY...          Remove per-profile environment variables
  claude-switch env list <name>                  List a profile's environment variables
  claude-switch rule add <dir> <profile>         Add a directory rule
  claude-switch rule remove <dir>                Remove a directory rule
  claude-switch rule list                        List all rules
  claude-switch which                            Show which profile would be used
  claude-switch --help                           Show this help
  claude-switch --version                        Show version

A repository can pin itself to a profile by committing a ".claude-switch"
file containing the profile name.
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

/** Pulls a `--flag value` pair out of args, returning the value and the rest. */
export function extractFlagValue(args: string[], flag: string): { value?: string; rest: string[] } {
  const rest: string[] = [];
  let value: string | undefined;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === flag) {
      value = args[i + 1];
      i++;
      continue;
    }
    rest.push(args[i]);
  }
  return { value, rest };
}

export async function handleAdd(args: string[], baseDirOverride?: string): Promise<void> {
  const noCopy = args.includes("--no-copy");
  const withoutNoCopy = args.filter((a) => a !== "--no-copy");
  const { value: agentId, rest } = extractFlagValue(withoutNoCopy, "--agent");
  const name = requireName(rest, "Usage: claude-switch add <name> [--agent <id>] [--no-copy]");

  let agent;
  try {
    agent = getAgent(agentId);
  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
    return;
  }

  initConfig(baseDirOverride);

  let copyFrom: string | undefined;
  let copyCategories: CopyCategory[] | undefined;
  if (!noCopy && agent.id === "claude") {
    const baseDir = getClaudeBaseDir();
    const fs = await import("node:fs");
    if (fs.existsSync(baseDir) && fs.readdirSync(baseDir).length > 0) {
      const shouldCopy = await confirm("  Copy existing Claude settings to new profile? (Y/n) ");
      if (shouldCopy) {
        copyFrom = baseDir;
        copyCategories = await promptCopyCategories(baseDir);
      }
    }
  }

  runWithErrorHandling(() => {
    const profileDir = addProfile(name, baseDirOverride, {
      agent: agent.id,
      ...(copyFrom && copyCategories?.length ? { copyFrom, categories: copyCategories } : {}),
    });
    if (agent.supportsSharedSessions) {
      ensureSharedDirs(profileDir, getSharedDir(baseDirOverride));
    }
    console.log(`\n  Creating profile "${name}" (${agent.label})...`);
    console.log(`  Config directory: ${profileDir}\n`);
    if (copyFrom && copyCategories?.length) {
      console.log(`  Copied settings from ${copyFrom}`);
    }
    console.log(`  Launching ${agent.label} to authenticate...`);
    console.log("  (complete the login flow in your browser)\n");

    launch({ configDir: profileDir, args: [], agent });
  });
}

export function handleRemove(args: string[], baseDirOverride?: string): void {
  const keepDir = args.includes("--keep-dir");
  const filtered = args.filter((a) => a !== "--keep-dir");
  const name = requireName(filtered, "Usage: claude-switch remove <name> [--keep-dir]");
  runWithErrorHandling(() => {
    removeProfile(name, baseDirOverride, { keepDir });
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
    console.log(`  ${p.name}${marker} [${p.agent}]`);
    console.log(`    ${p.configDir}`);
    const account = readAccountInfo(p.configDir, p.agent);
    if (account) {
      console.log(`    ${formatAccount(account)}`);
    }
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

export function handleEnv(args: string[], baseDirOverride?: string): void {
  const subcommand = args[0];

  switch (subcommand) {
    case "set": {
      const name = args[1];
      const assignments = args.slice(2);
      if (!name || assignments.length === 0) {
        console.error("Usage: claude-switch env set <profile> KEY=VALUE [KEY=VALUE...]");
        process.exit(1);
        return;
      }
      runWithErrorHandling(() => {
        const vars: Record<string, string> = {};
        for (const assignment of assignments) {
          const eq = assignment.indexOf("=");
          if (eq < 1) {
            throw new Error(`Invalid assignment "${assignment}". Expected KEY=VALUE.`);
          }
          vars[assignment.slice(0, eq)] = assignment.slice(eq + 1);
        }
        setProfileEnv(name, vars, baseDirOverride);
        console.log(`Set ${Object.keys(vars).join(", ")} for profile "${name}".`);
      });
      break;
    }
    case "unset": {
      const name = args[1];
      const keys = args.slice(2);
      if (!name || keys.length === 0) {
        console.error("Usage: claude-switch env unset <profile> KEY [KEY...]");
        process.exit(1);
        return;
      }
      runWithErrorHandling(() => {
        unsetProfileEnv(name, keys, baseDirOverride);
        console.log(`Unset ${keys.join(", ")} for profile "${name}".`);
      });
      break;
    }
    case "list": {
      const name = args[1];
      if (!name) {
        console.error("Usage: claude-switch env list <profile>");
        process.exit(1);
        return;
      }
      runWithErrorHandling(() => {
        const env = getProfileEnv(name, baseDirOverride);
        const keys = Object.keys(env);
        if (keys.length === 0) {
          console.log(`No environment variables set for profile "${name}".`);
          return;
        }
        console.log(`\nEnvironment for "${name}":\n`);
        for (const key of keys) {
          console.log(`  ${key}=${env[key]}`);
        }
        console.log();
      });
      break;
    }
    default:
      console.error("Usage: claude-switch env <set|unset|list> <profile> [args...]");
      process.exit(1);
  }
}

export async function handleCopyConfig(args: string[], baseDirOverride?: string): Promise<void> {
  const name = requireName(args, "Usage: claude-switch copy-config <profile>");

  let profileDir: string;
  try {
    const config = loadConfig(baseDirOverride);
    if (!config.profiles[name]) {
      throw new Error(
        `Profile "${name}" does not exist. Add it first with: claude-switch add ${name}`,
      );
    }
    profileDir = config.profiles[name].config_dir;
  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
    return;
  }

  const fs = await import("node:fs");
  const sourceDir = getClaudeBaseDir();
  if (!fs.existsSync(sourceDir) || fs.readdirSync(sourceDir).length === 0) {
    console.log(`Nothing to copy: source is empty or does not exist.`);
    return;
  }

  const categories = await promptCopyCategories(sourceDir);
  if (categories.length === 0) {
    console.log("Nothing selected to copy.");
    return;
  }

  const result = copyBaseConfig(sourceDir, profileDir, categories);
  if (result.copied) {
    console.log(`Copied config from "${sourceDir}" to profile "${name}".`);
  } else {
    console.log(`Nothing to copy: ${result.reason}.`);
  }
}

export async function promptCopyCategories(sourceDir: string): Promise<CopyCategory[]> {
  void sourceDir; // reserved for future size hints
  console.log("\n  What would you like to copy?\n");
  const selected: CopyCategory[] = [];
  for (const [key, cat] of Object.entries(COPY_CATEGORIES) as [
    CopyCategory,
    (typeof COPY_CATEGORIES)[CopyCategory],
  ][]) {
    const hint = cat.defaultOn ? "Y/n" : "y/N";
    const yes = await confirm(`  ${cat.label} — ${cat.description} (${hint}) `, cat.defaultOn);
    if (yes) selected.push(key);
  }
  console.log();
  return selected;
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
    const agent = getAgent(resolved.agent);
    console.log(`Profile: ${resolved.name} (via ${resolved.source}) [${agent.id}]`);
    console.log(`Config:  ${resolved.configDir}`);
    const account = readAccountInfo(resolved.configDir, agent.id);
    if (account) {
      console.log(`Account: ${formatAccount(account)}`);
    }
  });
}

export function launchClaude(args: string[], baseDirOverride?: string): void {
  runWithErrorHandling(() => {
    initConfig(baseDirOverride);
    const resolved = resolveProfile(args, process.cwd(), baseDirOverride);
    const config = loadConfig(baseDirOverride);
    const { claudeArgs } = parseArgs(args, config);
    const agent = getAgent(resolved.agent);
    if (agent.supportsSharedSessions) {
      ensureSharedDirs(resolved.configDir, getSharedDir(baseDirOverride));
    }
    launch({
      configDir: resolved.configDir,
      args: claudeArgs,
      agent,
      extraEnv: config.profiles[resolved.name]?.env,
    });
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
    env: (args) => handleEnv(args, baseDirOverride),
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
