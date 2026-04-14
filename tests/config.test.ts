import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
  loadConfig,
  saveConfig,
  initConfig,
  getConfigPath,
  getProfileDir,
  expandTilde,
  getClaudeBaseDir,
} from "../src/config.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "claude-switch-test-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("expandTilde", () => {
  it("expands ~/path to homedir/path", () => {
    const result = expandTilde("~/coding/project");
    expect(result).toBe(path.join(os.homedir(), "coding/project"));
  });

  it("expands bare ~ to homedir", () => {
    expect(expandTilde("~")).toBe(os.homedir());
  });

  it("leaves absolute paths unchanged", () => {
    expect(expandTilde("/usr/local/bin")).toBe("/usr/local/bin");
  });

  it("leaves relative paths unchanged", () => {
    expect(expandTilde("relative/path")).toBe("relative/path");
  });
});

describe("getConfigPath", () => {
  it("returns config.json inside base dir", () => {
    expect(getConfigPath(tmpDir)).toBe(path.join(tmpDir, "config.json"));
  });

  it("defaults to ~/.claude-switch when no override provided", () => {
    expect(getConfigPath()).toBe(path.join(os.homedir(), ".claude-switch", "config.json"));
  });
});

describe("getProfileDir", () => {
  it("returns profiles/<name> inside base dir", () => {
    expect(getProfileDir("work", tmpDir)).toBe(path.join(tmpDir, "profiles", "work"));
  });
});

describe("loadConfig", () => {
  it("returns default config when file does not exist", () => {
    const config = loadConfig(tmpDir);
    expect(config).toEqual({ profiles: {}, rules: [] });
  });

  it("loads config from disk", () => {
    const data = {
      profiles: { work: { config_dir: "/tmp/work" } },
      rules: [{ directory: "/code", profile: "work" }],
      default: "work",
    };
    fs.writeFileSync(path.join(tmpDir, "config.json"), JSON.stringify(data), "utf-8");

    const config = loadConfig(tmpDir);
    expect(config.profiles.work.config_dir).toBe("/tmp/work");
    expect(config.rules).toHaveLength(1);
    expect(config.default).toBe("work");
  });

  it("handles partial config gracefully", () => {
    fs.writeFileSync(path.join(tmpDir, "config.json"), "{}", "utf-8");
    const config = loadConfig(tmpDir);
    expect(config).toEqual({ profiles: {}, rules: [] });
  });
});

describe("saveConfig", () => {
  it("creates base dir and writes config", () => {
    const nested = path.join(tmpDir, "nested", "dir");
    const config = { profiles: {}, rules: [], default: "test" as const };

    saveConfig(config, nested);

    const raw = fs.readFileSync(path.join(nested, "config.json"), "utf-8");
    expect(JSON.parse(raw)).toEqual(config);
  });

  it("overwrites existing config", () => {
    const config1 = { profiles: {}, rules: [] };
    const config2 = { profiles: { x: { config_dir: "/x" } }, rules: [] };

    saveConfig(config1, tmpDir);
    saveConfig(config2, tmpDir);

    const loaded = loadConfig(tmpDir);
    expect(loaded.profiles.x).toBeDefined();
  });
});

describe("initConfig", () => {
  it("creates default config when none exists", () => {
    const config = initConfig(tmpDir);
    expect(config).toEqual({ profiles: {}, rules: [] });
    expect(fs.existsSync(getConfigPath(tmpDir))).toBe(true);
  });

  it("returns existing config without overwriting", () => {
    const existing = { profiles: { work: { config_dir: "/w" } }, rules: [] };
    saveConfig(existing, tmpDir);

    const config = initConfig(tmpDir);
    expect(config.profiles.work).toBeDefined();
  });
});

describe("getClaudeBaseDir", () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.CLAUDE_CONFIG_DIR;
    delete process.env.CLAUDE_CONFIG_DIR;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.CLAUDE_CONFIG_DIR = originalEnv;
    } else {
      delete process.env.CLAUDE_CONFIG_DIR;
    }
  });

  it("returns ~/.claude by default", () => {
    expect(getClaudeBaseDir()).toBe(path.join(os.homedir(), ".claude"));
  });

  it("returns CLAUDE_CONFIG_DIR env var when set", () => {
    process.env.CLAUDE_CONFIG_DIR = "/custom/claude/dir";
    expect(getClaudeBaseDir()).toBe("/custom/claude/dir");
  });

  it("expands tilde in CLAUDE_CONFIG_DIR", () => {
    process.env.CLAUDE_CONFIG_DIR = "~/my-claude";
    expect(getClaudeBaseDir()).toBe(path.join(os.homedir(), "my-claude"));
  });

  it("ignores empty CLAUDE_CONFIG_DIR", () => {
    process.env.CLAUDE_CONFIG_DIR = "";
    expect(getClaudeBaseDir()).toBe(path.join(os.homedir(), ".claude"));
  });

  it("ignores whitespace-only CLAUDE_CONFIG_DIR", () => {
    process.env.CLAUDE_CONFIG_DIR = "   ";
    expect(getClaudeBaseDir()).toBe(path.join(os.homedir(), ".claude"));
  });
});
