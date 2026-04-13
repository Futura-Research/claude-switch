import * as path from "node:path";
import { loadConfig, expandTilde, type Config } from "./config.js";

export interface ResolvedProfile {
  name: string;
  configDir: string;
  source: "flag" | "rule" | "default";
}

export interface ParsedArgs {
  profileFlag: string | null;
  claudeArgs: string[];
}

export function parseArgs(argv: string[], config: Config): ParsedArgs {
  const profileNames = new Set(Object.keys(config.profiles));
  let profileFlag: string | null = null;
  const claudeArgs: string[] = [];

  for (const arg of argv) {
    if (profileFlag === null && arg.startsWith("--") && !arg.includes("=")) {
      const name = arg.slice(2);
      if (profileNames.has(name)) {
        profileFlag = name;
        continue;
      }
    }
    claudeArgs.push(arg);
  }

  return { profileFlag, claudeArgs };
}

export function matchRule(cwd: string, config: Config): string | null {
  let bestMatch: string | null = null;
  let bestLength = 0;

  for (const rule of config.rules) {
    const ruleDir = path.resolve(expandTilde(rule.directory));
    const normalizedCwd = path.resolve(cwd);

    if (normalizedCwd === ruleDir || normalizedCwd.startsWith(ruleDir + path.sep)) {
      if (ruleDir.length > bestLength) {
        bestMatch = rule.profile;
        bestLength = ruleDir.length;
      }
    }
  }

  return bestMatch;
}

export function resolveProfile(
  argv: string[],
  cwd: string,
  baseDirOverride?: string,
): ResolvedProfile {
  const config = loadConfig(baseDirOverride);
  const { profileFlag } = parseArgs(argv, config);

  if (profileFlag) {
    const profile = config.profiles[profileFlag];
    return { name: profileFlag, configDir: profile.config_dir, source: "flag" };
  }

  const ruleMatch = matchRule(cwd, config);
  if (ruleMatch && config.profiles[ruleMatch]) {
    return { name: ruleMatch, configDir: config.profiles[ruleMatch].config_dir, source: "rule" };
  }

  if (config.default && config.profiles[config.default]) {
    return {
      name: config.default,
      configDir: config.profiles[config.default].config_dir,
      source: "default",
    };
  }

  throw new Error("No profile found. Set up a profile with: claude-switch add <name>");
}
