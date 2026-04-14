import * as fs from "node:fs";
import * as path from "node:path";

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
