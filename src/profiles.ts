import * as fs from "node:fs";
import { loadConfig, saveConfig, getProfileDir } from "./config.js";
import { copyBaseConfig, copyDir, resetProfileDir, type CopyCategory } from "./migrate.js";
import { getAgent } from "./agents.js";

const RESERVED_NAMES = [
  "help",
  "version",
  "add",
  "remove",
  "list",
  "default",
  "rule",
  "which",
  "copy-config",
  "reset",
  "duplicate",
  "env",
];

function validateProfileName(name: string): void {
  if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(name)) {
    throw new Error(
      `Invalid profile name "${name}". Use letters, numbers, hyphens, or underscores (must start with a letter).`,
    );
  }
  if (RESERVED_NAMES.includes(name)) {
    throw new Error(
      `"${name}" is a reserved name and cannot be used as a profile. Reserved: ${RESERVED_NAMES.join(", ")}`,
    );
  }
}

const DEFAULT_COPY_CATEGORIES: CopyCategory[] = ["settings", "skills", "ide"];

export function addProfile(
  name: string,
  baseDirOverride?: string,
  options?: { copyFrom?: string; categories?: CopyCategory[]; agent?: string },
): string {
  validateProfileName(name);

  const agent = getAgent(options?.agent);

  const config = loadConfig(baseDirOverride);

  if (config.profiles[name]) {
    throw new Error(`Profile "${name}" already exists.`);
  }

  const profileDir = getProfileDir(name, baseDirOverride);
  fs.mkdirSync(profileDir, { recursive: true });

  if (options?.copyFrom) {
    copyBaseConfig(options.copyFrom, profileDir, options.categories ?? DEFAULT_COPY_CATEGORIES);
  }

  config.profiles[name] = { config_dir: profileDir, agent: agent.id };

  if (!config.default) {
    config.default = name;
  }

  saveConfig(config, baseDirOverride);
  return profileDir;
}

export function removeProfile(
  name: string,
  baseDirOverride?: string,
  options?: { keepDir?: boolean },
): void {
  const config = loadConfig(baseDirOverride);

  if (!config.profiles[name]) {
    throw new Error(`Profile "${name}" does not exist.`);
  }

  const profileDir = config.profiles[name].config_dir;

  delete config.profiles[name];
  config.rules = config.rules.filter((r) => r.profile !== name);

  if (config.default === name) {
    const remaining = Object.keys(config.profiles);
    config.default = remaining.length > 0 ? remaining[0] : undefined;
  }

  saveConfig(config, baseDirOverride);

  if (!options?.keepDir && fs.existsSync(profileDir)) {
    fs.rmSync(profileDir, { recursive: true, force: true });
  }
}

export function listProfiles(
  baseDirOverride?: string,
): { name: string; configDir: string; isDefault: boolean; agent: string }[] {
  const config = loadConfig(baseDirOverride);

  return Object.entries(config.profiles).map(([name, profile]) => ({
    name,
    configDir: profile.config_dir,
    isDefault: config.default === name,
    agent: profile.agent ?? "claude",
  }));
}

export function setDefault(name: string, baseDirOverride?: string): void {
  const config = loadConfig(baseDirOverride);

  if (!config.profiles[name]) {
    throw new Error(
      `Profile "${name}" does not exist. Add it first with: claude-switch add ${name}`,
    );
  }

  config.default = name;
  saveConfig(config, baseDirOverride);
}

export function getDefault(baseDirOverride?: string): string | undefined {
  const config = loadConfig(baseDirOverride);
  return config.default;
}

export function duplicateProfile(
  sourceName: string,
  targetName: string,
  baseDirOverride?: string,
): string {
  validateProfileName(targetName);

  const config = loadConfig(baseDirOverride);

  if (!config.profiles[sourceName]) {
    throw new Error(`Source profile "${sourceName}" does not exist.`);
  }

  if (config.profiles[targetName]) {
    throw new Error(`Profile "${targetName}" already exists.`);
  }

  const source = config.profiles[sourceName];
  const targetDir = getProfileDir(targetName, baseDirOverride);
  if (fs.existsSync(source.config_dir)) {
    copyDir(source.config_dir, targetDir);
  } else {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  config.profiles[targetName] = {
    config_dir: targetDir,
    agent: source.agent ?? "claude",
    ...(source.env ? { env: { ...source.env } } : {}),
  };
  saveConfig(config, baseDirOverride);

  return targetDir;
}

export function resetProfile(name: string, baseDirOverride?: string): void {
  const config = loadConfig(baseDirOverride);

  if (!config.profiles[name]) {
    throw new Error(`Profile "${name}" does not exist.`);
  }

  resetProfileDir(config.profiles[name].config_dir);
}

function validateEnvKey(key: string): void {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
    throw new Error(
      `Invalid environment variable name "${key}". Use letters, digits, and underscores (must not start with a digit).`,
    );
  }
}

export function setProfileEnv(
  name: string,
  vars: Record<string, string>,
  baseDirOverride?: string,
): void {
  const config = loadConfig(baseDirOverride);
  const profile = config.profiles[name];
  if (!profile) {
    throw new Error(`Profile "${name}" does not exist.`);
  }

  for (const key of Object.keys(vars)) {
    validateEnvKey(key);
  }

  profile.env = { ...(profile.env ?? {}), ...vars };
  saveConfig(config, baseDirOverride);
}

export function unsetProfileEnv(name: string, keys: string[], baseDirOverride?: string): void {
  const config = loadConfig(baseDirOverride);
  const profile = config.profiles[name];
  if (!profile) {
    throw new Error(`Profile "${name}" does not exist.`);
  }

  if (profile.env) {
    for (const key of keys) {
      delete profile.env[key];
    }
    if (Object.keys(profile.env).length === 0) {
      delete profile.env;
    }
  }

  saveConfig(config, baseDirOverride);
}

export function getProfileEnv(name: string, baseDirOverride?: string): Record<string, string> {
  const config = loadConfig(baseDirOverride);
  const profile = config.profiles[name];
  if (!profile) {
    throw new Error(`Profile "${name}" does not exist.`);
  }
  return profile.env ?? {};
}
