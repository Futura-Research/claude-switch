import { spawnSync } from "node:child_process";
import * as path from "node:path";
import { expandTilde } from "./config.js";

export function findClaude(): string {
  const result = spawnSync("which", ["claude"], { encoding: "utf-8" });
  if (result.status !== 0 || !result.stdout.trim()) {
    throw new Error(
      "Claude Code CLI not found. Install it first: https://docs.anthropic.com/en/docs/claude-code",
    );
  }
  return result.stdout.trim();
}

export interface LaunchOptions {
  configDir: string;
  args: string[];
  claudePath?: string;
}

export function buildLaunchEnv(configDir: string): Record<string, string | undefined> {
  return {
    ...process.env,
    CLAUDE_CONFIG_DIR: path.resolve(expandTilde(configDir)),
  };
}

export function buildLaunchArgs(args: string[]): string[] {
  return [...args];
}

export function launch(options: LaunchOptions): never {
  const claudePath = options.claudePath ?? findClaude();
  const env = buildLaunchEnv(options.configDir);
  const args = buildLaunchArgs(options.args);

  const result = spawnSync(claudePath, args, {
    env,
    stdio: "inherit",
  });

  process.exit(result.status ?? 1);
}
