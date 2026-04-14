import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { copyBaseConfig, resetProfileDir } from "../src/migrate.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "claude-switch-migrate-test-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("copyBaseConfig", () => {
  it("copies files and subdirectories recursively", () => {
    const source = path.join(tmpDir, "source");
    const target = path.join(tmpDir, "target");
    fs.mkdirSync(source, { recursive: true });
    fs.writeFileSync(path.join(source, "settings.json"), '{"theme":"dark"}');
    fs.mkdirSync(path.join(source, "projects"), { recursive: true });
    fs.writeFileSync(path.join(source, "projects", "memo.md"), "notes");

    const result = copyBaseConfig(source, target);

    expect(result).toEqual({ copied: true });
    expect(fs.readFileSync(path.join(target, "settings.json"), "utf-8")).toBe('{"theme":"dark"}');
    expect(fs.readFileSync(path.join(target, "projects", "memo.md"), "utf-8")).toBe("notes");
  });

  it("returns copied false when source does not exist", () => {
    const result = copyBaseConfig(path.join(tmpDir, "nonexistent"), path.join(tmpDir, "target"));

    expect(result.copied).toBe(false);
    expect(result.reason).toContain("does not exist");
  });

  it("returns copied false when source is empty", () => {
    const source = path.join(tmpDir, "empty-source");
    fs.mkdirSync(source);

    const result = copyBaseConfig(source, path.join(tmpDir, "target"));

    expect(result.copied).toBe(false);
    expect(result.reason).toContain("empty");
  });

  it("overwrites existing files in target", () => {
    const source = path.join(tmpDir, "source");
    const target = path.join(tmpDir, "target");
    fs.mkdirSync(source);
    fs.mkdirSync(target);
    fs.writeFileSync(path.join(target, "settings.json"), "old");
    fs.writeFileSync(path.join(source, "settings.json"), "new");

    copyBaseConfig(source, target);

    expect(fs.readFileSync(path.join(target, "settings.json"), "utf-8")).toBe("new");
  });

  it("creates target directory if it does not exist", () => {
    const source = path.join(tmpDir, "source");
    const target = path.join(tmpDir, "nested", "deep", "target");
    fs.mkdirSync(source);
    fs.writeFileSync(path.join(source, "file.txt"), "data");

    copyBaseConfig(source, target);

    expect(fs.existsSync(path.join(target, "file.txt"))).toBe(true);
  });

  it("copies nested directory structures correctly", () => {
    const source = path.join(tmpDir, "source");
    fs.mkdirSync(path.join(source, "a", "b", "c"), { recursive: true });
    fs.writeFileSync(path.join(source, "a", "b", "c", "deep.txt"), "deep");
    fs.writeFileSync(path.join(source, "a", "top.txt"), "top");

    const target = path.join(tmpDir, "target");
    copyBaseConfig(source, target);

    expect(fs.readFileSync(path.join(target, "a", "b", "c", "deep.txt"), "utf-8")).toBe("deep");
    expect(fs.readFileSync(path.join(target, "a", "top.txt"), "utf-8")).toBe("top");
  });
});

describe("resetProfileDir", () => {
  it("removes all files and subdirectories from profile dir", () => {
    const profileDir = path.join(tmpDir, "profile");
    fs.mkdirSync(profileDir);
    fs.writeFileSync(path.join(profileDir, "settings.json"), "{}");
    fs.mkdirSync(path.join(profileDir, "projects"));
    fs.writeFileSync(path.join(profileDir, "projects", "memo.md"), "notes");

    resetProfileDir(profileDir);

    expect(fs.existsSync(profileDir)).toBe(true);
    expect(fs.readdirSync(profileDir)).toHaveLength(0);
  });

  it("preserves the profile directory itself", () => {
    const profileDir = path.join(tmpDir, "profile");
    fs.mkdirSync(profileDir);
    fs.writeFileSync(path.join(profileDir, "file.txt"), "data");

    resetProfileDir(profileDir);

    expect(fs.existsSync(profileDir)).toBe(true);
    expect(fs.statSync(profileDir).isDirectory()).toBe(true);
  });

  it("handles already-empty directory without error", () => {
    const profileDir = path.join(tmpDir, "empty-profile");
    fs.mkdirSync(profileDir);

    expect(() => resetProfileDir(profileDir)).not.toThrow();
    expect(fs.readdirSync(profileDir)).toHaveLength(0);
  });

  it("handles non-existent directory without error", () => {
    expect(() => resetProfileDir(path.join(tmpDir, "nonexistent"))).not.toThrow();
  });
});
