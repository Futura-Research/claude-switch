import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { initConfig, loadConfig } from "../src/config.js";
import { addProfile, removeProfile } from "../src/profiles.js";
import { addRule } from "../src/rules.js";
import { parseArgs, matchRule, resolveProfile } from "../src/resolver.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "claude-switch-test-"));
  initConfig(tmpDir);
  addProfile("work", tmpDir);
  addProfile("personal", tmpDir);
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("parseArgs", () => {
  it("extracts profile flag from args", () => {
    const config = loadConfig(tmpDir);
    const result = parseArgs(["--work", "--dangerously-skip-permissions"], config);
    expect(result.profileFlag).toBe("work");
    expect(result.claudeArgs).toEqual(["--dangerously-skip-permissions"]);
  });

  it("returns null profileFlag when no profile matches", () => {
    const config = loadConfig(tmpDir);
    const result = parseArgs(["--dangerously-skip-permissions", "-p", "fix tests"], config);
    expect(result.profileFlag).toBeNull();
    expect(result.claudeArgs).toEqual(["--dangerously-skip-permissions", "-p", "fix tests"]);
  });

  it("only takes the first matching profile flag", () => {
    const config = loadConfig(tmpDir);
    const result = parseArgs(["--work", "--personal"], config);
    expect(result.profileFlag).toBe("work");
    expect(result.claudeArgs).toEqual(["--personal"]);
  });

  it("does not match flags with = values", () => {
    const config = loadConfig(tmpDir);
    const result = parseArgs(["--work=something"], config);
    expect(result.profileFlag).toBeNull();
    expect(result.claudeArgs).toEqual(["--work=something"]);
  });

  it("handles empty args", () => {
    const config = loadConfig(tmpDir);
    const result = parseArgs([], config);
    expect(result.profileFlag).toBeNull();
    expect(result.claudeArgs).toEqual([]);
  });
});

describe("matchRule", () => {
  it("matches exact directory", () => {
    addRule("/code/project", "work", tmpDir);
    const config = loadConfig(tmpDir);
    expect(matchRule("/code/project", config)).toBe("work");
  });

  it("matches subdirectory", () => {
    addRule("/code/project", "work", tmpDir);
    const config = loadConfig(tmpDir);
    expect(matchRule("/code/project/subdir/deep", config)).toBe("work");
  });

  it("does not match sibling directory", () => {
    addRule("/code/project", "work", tmpDir);
    const config = loadConfig(tmpDir);
    expect(matchRule("/code/project2", config)).toBeNull();
  });

  it("returns longest match when multiple rules match", () => {
    addRule("/code", "personal", tmpDir);
    addRule("/code/project", "work", tmpDir);
    const config = loadConfig(tmpDir);
    expect(matchRule("/code/project/subdir", config)).toBe("work");
  });

  it("returns null when no rules match", () => {
    const config = loadConfig(tmpDir);
    expect(matchRule("/unmatched", config)).toBeNull();
  });
});

describe("resolveProfile", () => {
  it("resolves from flag (highest priority)", () => {
    addRule("/code", "personal", tmpDir);
    const result = resolveProfile(["--work"], "/code", tmpDir);
    expect(result.name).toBe("work");
    expect(result.source).toBe("flag");
  });

  it("resolves from rule when no flag given", () => {
    addRule("/code/project", "work", tmpDir);
    const result = resolveProfile([], "/code/project", tmpDir);
    expect(result.name).toBe("work");
    expect(result.source).toBe("rule");
  });

  it("resolves from default when no flag or rule matches", () => {
    const result = resolveProfile([], "/random/dir", tmpDir);
    expect(result.name).toBe("work"); // first added = default
    expect(result.source).toBe("default");
  });

  it("throws when no profile can be resolved", () => {
    removeProfile("work", tmpDir);
    removeProfile("personal", tmpDir);

    expect(() => resolveProfile([], "/code", tmpDir)).toThrow("No profile found");
  });

  it("returns config_dir for the resolved profile", () => {
    const result = resolveProfile(["--work"], "/", tmpDir);
    expect(result.configDir).toContain("profiles");
    expect(result.configDir).toContain("work");
  });
});
