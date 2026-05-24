import { spawnSync } from "node:child_process";
import * as path from "node:path";
import { expandTilde } from "./config.js";
import { AGENTS, type AgentAdapter } from "./agents.js";

/* v8 ignore start — integration boundary: relies on system `which` */
export function findBinary(agent: AgentAdapter): string {
  const result = spawnSync("which", [agent.binary], { encoding: "utf-8" });
  if (result.status !== 0 || !result.stdout.trim()) {
    throw new Error(
      `${agent.label} ("${agent.binary}") not found on PATH. Install it and try again.`,
    );
  }
  return result.stdout.trim();
}
/* v8 ignore stop */

export interface LaunchOptions {
  configDir: string;
  args: string[];
  agent?: AgentAdapter;
  extraEnv?: Record<string, string>;
  binaryPath?: string;
}

export function buildLaunchEnv(
  configDir: string,
  agent: AgentAdapter = AGENTS.claude,
  extraEnv?: Record<string, string>,
): Record<string, string | undefined> {
  return {
    ...process.env,
    ...extraEnv,
    [agent.configEnvVar]: path.resolve(expandTilde(configDir)),
  };
}

export function buildLaunchArgs(args: string[]): string[] {
  return [...args];
}

/* v8 ignore start — integration boundary: spawns the agent + process.exit */
export function launch(options: LaunchOptions): never {
  const agent = options.agent ?? AGENTS.claude;
  const binaryPath = options.binaryPath ?? findBinary(agent);
  const env = buildLaunchEnv(options.configDir, agent, options.extraEnv);
  const args = buildLaunchArgs(options.args);

  const result = spawnSync(binaryPath, args, {
    env,
    stdio: "inherit",
  });

  process.exit(result.status ?? 1);
}
/* v8 ignore stop */
