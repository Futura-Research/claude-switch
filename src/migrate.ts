import * as fs from "node:fs";

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
