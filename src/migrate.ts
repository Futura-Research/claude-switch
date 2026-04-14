import * as fs from "node:fs";
import * as path from "node:path";

export type CopyCategory = "settings" | "skills" | "ide" | "history" | "work";

export const COPY_CATEGORIES: Record<
  CopyCategory,
  { label: string; description: string; paths: string[]; defaultOn: boolean }
> = {
  settings: {
    label: "Settings",
    description: "Theme, model, and general preferences",
    paths: ["settings.json", "settings.local.json", ".claude.json"],
    defaultOn: true,
  },
  skills: {
    label: "Skills & commands",
    description: "Custom skills, slash commands, and plugins",
    paths: ["skills", "commands", "plugins"],
    defaultOn: true,
  },
  ide: {
    label: "IDE settings",
    description: "VS Code / JetBrains integration config",
    paths: ["ide"],
    defaultOn: true,
  },
  history: {
    label: "Conversation history",
    description: "Chat transcripts per project — can be very large",
    paths: ["projects", "sessions", "history.jsonl"],
    defaultOn: false,
  },
  work: {
    label: "In-progress work",
    description: "Plans, tasks, and todos",
    paths: ["plans", "tasks", "todos"],
    defaultOn: false,
  },
};

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
  categories: CopyCategory[],
  options?: { stripAuth?: boolean },
): { copied: boolean; reason?: string } {
  if (!fs.existsSync(sourceDir)) {
    return { copied: false, reason: "source directory does not exist" };
  }
  if (categories.length === 0) {
    return { copied: false, reason: "no categories selected" };
  }

  fs.mkdirSync(targetDir, { recursive: true });

  let anyCopied = false;
  for (const category of categories) {
    for (const relPath of COPY_CATEGORIES[category].paths) {
      const srcPath = path.join(sourceDir, relPath);
      const dstPath = path.join(targetDir, relPath);
      if (!fs.existsSync(srcPath)) continue;
      if (fs.statSync(srcPath).isDirectory()) {
        fs.cpSync(srcPath, dstPath, { recursive: true, force: true });
      } else {
        fs.copyFileSync(srcPath, dstPath);
      }
      anyCopied = true;
    }
  }

  if (!anyCopied) {
    return { copied: false, reason: "no matching files found in source" };
  }

  if (options?.stripAuth !== false && categories.includes("settings")) {
    stripAuthFromClaudeJson(targetDir);
  }

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
