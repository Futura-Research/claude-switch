import * as fs from "node:fs";
import * as path from "node:path";
import { loadConfig, expandTilde, type Config } from "./config.js";

export interface ResolvedProfile {
  name: string;
  configDir: string;
  source: "flag" | "project" | "rule" | "default";
  agent: string;
}

export interface ParsedArgs {
  profileFlag: string | null;
  claudeArgs: string[];
}

/** Filename a repository can commit to pin itself to a profile. */
export const PROJECT_FILE = ".claude-switch";

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

/**
 * Walks up from `cwd` looking for a committed `.claude-switch` file. The first
 * non-empty, non-comment line names the profile the repository pins itself to.
 */
export function findProjectProfile(cwd: string): { profile: string; file: string } | null {
  let dir = path.resolve(cwd);

  while (true) {
    const file = path.join(dir, PROJECT_FILE);
    if (fs.existsSync(file) && fs.statSync(file).isFile()) {
      const raw = fs.readFileSync(file, "utf-8");
      for (const line of raw.split("\n")) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#")) {
          return { profile: trimmed, file };
        }
      }
      return null;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      return null;
    }
    dir = parent;
  }
}

function agentOf(config: Config, name: string): string {
  return config.profiles[name].agent ?? "claude";
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
    return {
      name: profileFlag,
      configDir: profile.config_dir,
      source: "flag",
      agent: agentOf(config, profileFlag),
    };
  }

  const projectMatch = findProjectProfile(cwd);
  if (projectMatch) {
    if (!config.profiles[projectMatch.profile]) {
      throw new Error(
        `Profile "${projectMatch.profile}" referenced in ${projectMatch.file} does not exist. ` +
          `Create it with: claude-switch add ${projectMatch.profile}`,
      );
    }
    return {
      name: projectMatch.profile,
      configDir: config.profiles[projectMatch.profile].config_dir,
      source: "project",
      agent: agentOf(config, projectMatch.profile),
    };
  }

  const ruleMatch = matchRule(cwd, config);
  if (ruleMatch && config.profiles[ruleMatch]) {
    return {
      name: ruleMatch,
      configDir: config.profiles[ruleMatch].config_dir,
      source: "rule",
      agent: agentOf(config, ruleMatch),
    };
  }

  if (config.default && config.profiles[config.default]) {
    return {
      name: config.default,
      configDir: config.profiles[config.default].config_dir,
      source: "default",
      agent: agentOf(config, config.default),
    };
  }

  throw new Error("No profile found. Set up a profile with: claude-switch add <name>");
}
