import * as os from "node:os";
import * as path from "node:path";

export interface AgentAdapter {
  /** Stable identifier stored in config (`claude`, `codex`, `gemini`). */
  id: string;
  /** Human-readable name shown in CLI output. */
  label: string;
  /** Executable name resolved on PATH. */
  binary: string;
  /** Environment variable the agent reads to locate its config directory. */
  configEnvVar: string;
  /** The agent's default config directory when no override is set. */
  defaultConfigDir(): string;
  /**
   * Whether claude-switch can share session state across profiles of this
   * agent. Only Claude Code has a known shareable layout today.
   */
  supportsSharedSessions: boolean;
}

export const AGENTS: Record<string, AgentAdapter> = {
  claude: {
    id: "claude",
    label: "Claude Code",
    binary: "claude",
    configEnvVar: "CLAUDE_CONFIG_DIR",
    defaultConfigDir: () => path.join(os.homedir(), ".claude"),
    supportsSharedSessions: true,
  },
  codex: {
    id: "codex",
    label: "OpenAI Codex CLI",
    binary: "codex",
    configEnvVar: "CODEX_HOME",
    defaultConfigDir: () => path.join(os.homedir(), ".codex"),
    supportsSharedSessions: false,
  },
  gemini: {
    id: "gemini",
    label: "Gemini CLI",
    binary: "gemini",
    // GEMINI_CONFIG_DIR is honoured on macOS/Linux; not respected on Windows.
    configEnvVar: "GEMINI_CONFIG_DIR",
    defaultConfigDir: () => path.join(os.homedir(), ".gemini"),
    supportsSharedSessions: false,
  },
};

export const DEFAULT_AGENT = "claude";

export function getAgent(id?: string): AgentAdapter {
  const agent = AGENTS[id ?? DEFAULT_AGENT];
  if (!agent) {
    throw new Error(`Unknown agent "${id}". Supported agents: ${Object.keys(AGENTS).join(", ")}.`);
  }
  return agent;
}
