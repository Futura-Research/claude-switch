import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { initConfig } from "../src/config.js";
import { addProfile } from "../src/profiles.js";
import { addRule, removeRule, listRules } from "../src/rules.js";

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

describe("addRule", () => {
  it("adds a directory-to-profile rule", () => {
    addRule("/code/project", "work", tmpDir);
    const rules = listRules(tmpDir);
    expect(rules).toHaveLength(1);
    expect(rules[0].directory).toBe("/code/project");
    expect(rules[0].profile).toBe("work");
  });

  it("throws when profile does not exist", () => {
    expect(() => addRule("/code", "nonexistent", tmpDir)).toThrow(
      'Profile "nonexistent" does not exist.',
    );
  });

  it("updates existing rule for same directory", () => {
    addRule("/code/project", "work", tmpDir);
    addRule("/code/project", "personal", tmpDir);
    const rules = listRules(tmpDir);
    expect(rules).toHaveLength(1);
    expect(rules[0].profile).toBe("personal");
  });

  it("normalizes directory paths", () => {
    addRule("/code/project/../project", "work", tmpDir);
    const rules = listRules(tmpDir);
    expect(rules[0].directory).toBe("/code/project");
  });
});

describe("removeRule", () => {
  it("removes an existing rule", () => {
    addRule("/code/project", "work", tmpDir);
    removeRule("/code/project", tmpDir);
    expect(listRules(tmpDir)).toHaveLength(0);
  });

  it("throws when rule does not exist", () => {
    expect(() => removeRule("/nonexistent", tmpDir)).toThrow(
      'No rule found for directory "/nonexistent".',
    );
  });

  it("matches normalized paths", () => {
    addRule("/code/project", "work", tmpDir);
    removeRule("/code/project/../project", tmpDir);
    expect(listRules(tmpDir)).toHaveLength(0);
  });
});

describe("listRules", () => {
  it("returns empty array when no rules exist", () => {
    expect(listRules(tmpDir)).toEqual([]);
  });

  it("returns all rules", () => {
    addRule("/code/a", "work", tmpDir);
    addRule("/code/b", "personal", tmpDir);
    const rules = listRules(tmpDir);
    expect(rules).toHaveLength(2);
  });
});
