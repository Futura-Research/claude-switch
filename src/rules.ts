import { loadConfig, saveConfig, expandTilde } from "./config.js";
import * as path from "node:path";

export function addRule(directory: string, profile: string, baseDirOverride?: string): void {
  const config = loadConfig(baseDirOverride);

  if (!config.profiles[profile]) {
    throw new Error(
      `Profile "${profile}" does not exist. Add it first with: claude-switch add ${profile}`,
    );
  }

  const normalizedDir = path.resolve(expandTilde(directory));

  const existing = config.rules.find(
    (r) => path.resolve(expandTilde(r.directory)) === normalizedDir,
  );
  if (existing) {
    existing.profile = profile;
  } else {
    config.rules.push({ directory: normalizedDir, profile });
  }

  saveConfig(config, baseDirOverride);
}

export function removeRule(directory: string, baseDirOverride?: string): void {
  const config = loadConfig(baseDirOverride);
  const normalizedDir = path.resolve(expandTilde(directory));

  const before = config.rules.length;
  config.rules = config.rules.filter(
    (r) => path.resolve(expandTilde(r.directory)) !== normalizedDir,
  );

  if (config.rules.length === before) {
    throw new Error(`No rule found for directory "${directory}".`);
  }

  saveConfig(config, baseDirOverride);
}

export function listRules(baseDirOverride?: string): { directory: string; profile: string }[] {
  const config = loadConfig(baseDirOverride);
  return config.rules.map((r) => ({ directory: r.directory, profile: r.profile }));
}
