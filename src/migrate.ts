import * as fs from "node:fs";
import * as path from "node:path";

export const AUTH_FIELDS = ["oauthAccount", "userID"] as const;

export function stripAuthFromClaudeJson(dir: string): void {
  const claudeJsonPath = path.join(dir, ".claude.json");
  if (!fs.existsSync(claudeJsonPath)) {
    return;
  }
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(fs.readFileSync(claudeJsonPath, "utf-8")) as Record<string, unknown>;
  } catch {
    return;
  }
  let changed = false;
  for (const field of AUTH_FIELDS) {
    if (field in data) {
      delete data[field];
      changed = true;
    }
  }
  if (changed) {
    fs.writeFileSync(claudeJsonPath, JSON.stringify(data, null, 2));
  }
}

export function copyBaseConfig(
  sourceDir: string,
  targetDir: string,
): { copied: boolean; reason?: string } {
  if (!fs.existsSync(sourceDir)) {
    return { copied: false, reason: "source directory does not exist" };
  }

  const entries = fs.readdirSync(sourceDir);
  if (entries.length === 0) {
    return { copied: false, reason: "source directory is empty" };
  }

  fs.mkdirSync(targetDir, { recursive: true });
  fs.cpSync(sourceDir, targetDir, { recursive: true, force: true });

  return { copied: true };
}

export function resetProfileDir(profileDir: string): void {
  if (!fs.existsSync(profileDir)) {
    return;
  }

  for (const entry of fs.readdirSync(profileDir)) {
    fs.rmSync(path.join(profileDir, entry), { recursive: true, force: true });
  }
}
