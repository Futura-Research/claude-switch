import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

export interface Profile {
  config_dir: string;
}

export interface Rule {
  directory: string;
  profile: string;
}

export interface Config {
  profiles: Record<string, Profile>;
  rules: Rule[];
  default?: string;
}

const DEFAULT_CONFIG: Config = {
  profiles: {},
  rules: [],
};

function getBaseDir(baseDirOverride?: string): string {
  return baseDirOverride ?? path.join(os.homedir(), ".claude-switch");
}

export function getConfigPath(baseDirOverride?: string): string {
  return path.join(getBaseDir(baseDirOverride), "config.json");
}

export function getProfileDir(profileName: string, baseDirOverride?: string): string {
  return path.join(getBaseDir(baseDirOverride), "profiles", profileName);
}

export function expandTilde(filepath: string): string {
  if (filepath.startsWith("~/")) {
    return path.join(os.homedir(), filepath.slice(2));
  }
  if (filepath === "~") {
    return os.homedir();
  }
  return filepath;
}

export function getClaudeBaseDir(): string {
  const envDir = process.env.CLAUDE_CONFIG_DIR;
  if (envDir && envDir.trim() !== "") {
    return path.resolve(expandTilde(envDir));
  }
  return path.join(os.homedir(), ".claude");
}

export function loadConfig(baseDirOverride?: string): Config {
  const configPath = getConfigPath(baseDirOverride);

  if (!fs.existsSync(configPath)) {
    return { ...DEFAULT_CONFIG, profiles: {}, rules: [] };
  }

  const raw = fs.readFileSync(configPath, "utf-8");
  const parsed = JSON.parse(raw) as Partial<Config>;

  return {
    profiles: parsed.profiles ?? {},
    rules: parsed.rules ?? [],
    default: parsed.default,
  };
}

export function saveConfig(config: Config, baseDirOverride?: string): void {
  const baseDir = getBaseDir(baseDirOverride);
  const configPath = getConfigPath(baseDirOverride);

  fs.mkdirSync(baseDir, { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
}

export function initConfig(baseDirOverride?: string): Config {
  const configPath = getConfigPath(baseDirOverride);

  if (fs.existsSync(configPath)) {
    return loadConfig(baseDirOverride);
  }

  const config: Config = { ...DEFAULT_CONFIG, profiles: {}, rules: [] };
  saveConfig(config, baseDirOverride);
  return config;
}
