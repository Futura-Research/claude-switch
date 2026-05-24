import { describe, it, expect } from "vitest";
import * as os from "node:os";
import * as path from "node:path";
import { AGENTS, DEFAULT_AGENT, getAgent } from "../src/agents.js";

describe("AGENTS", () => {
  it("registers claude, codex, and gemini", () => {
    expect(Object.keys(AGENTS).sort()).toEqual(["claude", "codex", "gemini"]);
  });

  it("each agent declares a distinct config env var", () => {
    const vars = Object.values(AGENTS).map((a) => a.configEnvVar);
    expect(new Set(vars).size).toBe(vars.length);
  });

  it("only claude supports shared sessions", () => {
    expect(AGENTS.claude.supportsSharedSessions).toBe(true);
    expect(AGENTS.codex.supportsSharedSessions).toBe(false);
    expect(AGENTS.gemini.supportsSharedSessions).toBe(false);
  });

  it("resolves default config directories under the home dir", () => {
    expect(AGENTS.claude.defaultConfigDir()).toBe(path.join(os.homedir(), ".claude"));
    expect(AGENTS.codex.defaultConfigDir()).toBe(path.join(os.homedir(), ".codex"));
    expect(AGENTS.gemini.defaultConfigDir()).toBe(path.join(os.homedir(), ".gemini"));
  });
});

describe("getAgent", () => {
  it("returns the named agent", () => {
    expect(getAgent("codex").id).toBe("codex");
  });

  it("defaults to claude when no id is given", () => {
    expect(getAgent().id).toBe(DEFAULT_AGENT);
    expect(getAgent(undefined).id).toBe("claude");
  });

  it("throws on an unknown agent", () => {
    expect(() => getAgent("rovo")).toThrow('Unknown agent "rovo"');
    expect(() => getAgent("rovo")).toThrow("claude, codex, gemini");
  });
});
