import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
  copyBaseConfig,
  copyDir,
  ensureProjectsLink,
  resetProfileDir,
  stripAuthFromClaudeJson,
} from "../src/migrate.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "claude-switch-migrate-test-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("copyBaseConfig", () => {
  it("copies files for selected categories", () => {
    const source = path.join(tmpDir, "source");
    const target = path.join(tmpDir, "target");
    fs.mkdirSync(source);
    fs.writeFileSync(path.join(source, "settings.json"), '{"theme":"dark"}');

    const result = copyBaseConfig(source, target, ["settings"]);

    expect(result).toEqual({ copied: true });
    expect(fs.readFileSync(path.join(target, "settings.json"), "utf-8")).toBe('{"theme":"dark"}');
  });

  it("copies directories for selected categories", () => {
    const source = path.join(tmpDir, "source");
    const target = path.join(tmpDir, "target");
    fs.mkdirSync(path.join(source, "sessions"), { recursive: true });
    fs.writeFileSync(path.join(source, "sessions", "abc.json"), "{}");

    copyBaseConfig(source, target, ["history"]);

    expect(fs.readFileSync(path.join(target, "sessions", "abc.json"), "utf-8")).toBe("{}");
  });

  it("only copies paths for the selected categories", () => {
    const source = path.join(tmpDir, "source");
    const target = path.join(tmpDir, "target");
    fs.mkdirSync(source);
    fs.writeFileSync(path.join(source, "settings.json"), "{}");
    fs.mkdirSync(path.join(source, "projects"), { recursive: true });
    fs.writeFileSync(path.join(source, "projects", "chat.json"), "{}");

    copyBaseConfig(source, target, ["settings"]);

    expect(fs.existsSync(path.join(target, "settings.json"))).toBe(true);
    expect(fs.existsSync(path.join(target, "projects"))).toBe(false);
  });

  it("returns copied false when source does not exist", () => {
    const result = copyBaseConfig(path.join(tmpDir, "nonexistent"), path.join(tmpDir, "target"), [
      "settings",
    ]);

    expect(result.copied).toBe(false);
    expect(result.reason).toContain("does not exist");
  });

  it("returns copied false when no categories selected", () => {
    const source = path.join(tmpDir, "source");
    fs.mkdirSync(source);
    fs.writeFileSync(path.join(source, "settings.json"), "{}");

    const result = copyBaseConfig(source, path.join(tmpDir, "target"), []);

    expect(result.copied).toBe(false);
    expect(result.reason).toContain("no categories selected");
  });

  it("returns copied false when no category files exist in source", () => {
    const source = path.join(tmpDir, "source");
    fs.mkdirSync(source);
    fs.writeFileSync(path.join(source, "settings.json"), "{}");

    const result = copyBaseConfig(source, path.join(tmpDir, "target"), ["history"]);

    expect(result.copied).toBe(false);
    expect(result.reason).toContain("no matching files");
  });

  it("overwrites existing files in target", () => {
    const source = path.join(tmpDir, "source");
    const target = path.join(tmpDir, "target");
    fs.mkdirSync(source);
    fs.mkdirSync(target);
    fs.writeFileSync(path.join(target, "settings.json"), "old");
    fs.writeFileSync(path.join(source, "settings.json"), "new");

    copyBaseConfig(source, target, ["settings"]);

    expect(fs.readFileSync(path.join(target, "settings.json"), "utf-8")).toBe("new");
  });

  it("creates target directory if it does not exist", () => {
    const source = path.join(tmpDir, "source");
    const target = path.join(tmpDir, "nested", "deep", "target");
    fs.mkdirSync(source);
    fs.writeFileSync(path.join(source, "settings.json"), "{}");

    copyBaseConfig(source, target, ["settings"]);

    expect(fs.existsSync(path.join(target, "settings.json"))).toBe(true);
  });

  it("skips category paths that do not exist in source", () => {
    const source = path.join(tmpDir, "source");
    const target = path.join(tmpDir, "target");
    fs.mkdirSync(source);
    fs.writeFileSync(path.join(source, "settings.json"), "{}");

    copyBaseConfig(source, target, ["settings", "history"]);

    expect(fs.existsSync(path.join(target, "settings.json"))).toBe(true);
    expect(fs.existsSync(path.join(target, "projects"))).toBe(false);
  });

  it("strips auth fields from .claude.json by default when settings selected", () => {
    const source = path.join(tmpDir, "source");
    const target = path.join(tmpDir, "target");
    fs.mkdirSync(source);
    fs.writeFileSync(
      path.join(source, ".claude.json"),
      JSON.stringify({ oauthAccount: { token: "secret" }, userID: "u123", theme: "dark" }),
    );

    copyBaseConfig(source, target, ["settings"]);

    const result = JSON.parse(fs.readFileSync(path.join(target, ".claude.json"), "utf-8"));
    expect(result).not.toHaveProperty("oauthAccount");
    expect(result).not.toHaveProperty("userID");
    expect(result.theme).toBe("dark");
  });

  it("preserves auth fields when stripAuth is false", () => {
    const source = path.join(tmpDir, "source");
    const target = path.join(tmpDir, "target");
    fs.mkdirSync(source);
    fs.writeFileSync(
      path.join(source, ".claude.json"),
      JSON.stringify({ oauthAccount: { token: "secret" }, userID: "u123" }),
    );

    copyBaseConfig(source, target, ["settings"], { stripAuth: false });

    const result = JSON.parse(fs.readFileSync(path.join(target, ".claude.json"), "utf-8"));
    expect(result.oauthAccount).toEqual({ token: "secret" });
    expect(result.userID).toBe("u123");
  });
});

describe("stripAuthFromClaudeJson", () => {
  it("removes oauthAccount and userID from .claude.json", () => {
    const dir = path.join(tmpDir, "profile");
    fs.mkdirSync(dir);
    fs.writeFileSync(
      path.join(dir, ".claude.json"),
      JSON.stringify({ oauthAccount: { token: "secret" }, userID: "u123", theme: "dark" }),
    );

    stripAuthFromClaudeJson(dir);

    const result = JSON.parse(fs.readFileSync(path.join(dir, ".claude.json"), "utf-8"));
    expect(result).not.toHaveProperty("oauthAccount");
    expect(result).not.toHaveProperty("userID");
    expect(result.theme).toBe("dark");
  });

  it("leaves other fields intact", () => {
    const dir = path.join(tmpDir, "profile");
    fs.mkdirSync(dir);
    fs.writeFileSync(
      path.join(dir, ".claude.json"),
      JSON.stringify({ numStartups: 5, tipsHistory: [], theme: "light" }),
    );

    stripAuthFromClaudeJson(dir);

    const result = JSON.parse(fs.readFileSync(path.join(dir, ".claude.json"), "utf-8"));
    expect(result.numStartups).toBe(5);
    expect(result.tipsHistory).toEqual([]);
    expect(result.theme).toBe("light");
  });

  it("does nothing when .claude.json does not exist", () => {
    const dir = path.join(tmpDir, "profile");
    fs.mkdirSync(dir);

    expect(() => stripAuthFromClaudeJson(dir)).not.toThrow();
  });

  it("does nothing when .claude.json has no auth fields", () => {
    const dir = path.join(tmpDir, "profile");
    fs.mkdirSync(dir);
    const content = JSON.stringify({ numStartups: 3 });
    fs.writeFileSync(path.join(dir, ".claude.json"), content);

    stripAuthFromClaudeJson(dir);

    expect(fs.readFileSync(path.join(dir, ".claude.json"), "utf-8")).toBe(content);
  });

  it("does nothing when .claude.json is invalid JSON", () => {
    const dir = path.join(tmpDir, "profile");
    fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir, ".claude.json"), "not-json");

    expect(() => stripAuthFromClaudeJson(dir)).not.toThrow();
    expect(fs.readFileSync(path.join(dir, ".claude.json"), "utf-8")).toBe("not-json");
  });
});

describe("copyDir", () => {
  it("copies files and subdirectories recursively", () => {
    const src = path.join(tmpDir, "src");
    const dst = path.join(tmpDir, "dst");
    fs.mkdirSync(path.join(src, "sub"), { recursive: true });
    fs.writeFileSync(path.join(src, "file.txt"), "data");
    fs.writeFileSync(path.join(src, "sub", "deep.txt"), "deep");

    copyDir(src, dst);

    expect(fs.readFileSync(path.join(dst, "file.txt"), "utf-8")).toBe("data");
    expect(fs.readFileSync(path.join(dst, "sub", "deep.txt"), "utf-8")).toBe("deep");
  });

  it("skips .git directories", () => {
    const src = path.join(tmpDir, "src");
    fs.mkdirSync(path.join(src, ".git", "objects"), { recursive: true });
    fs.writeFileSync(path.join(src, ".git", "objects", "abc"), "blob");
    fs.writeFileSync(path.join(src, "plugin.js"), "code");

    const dst = path.join(tmpDir, "dst");
    copyDir(src, dst);

    expect(fs.existsSync(path.join(dst, ".git"))).toBe(false);
    expect(fs.readFileSync(path.join(dst, "plugin.js"), "utf-8")).toBe("code");
  });

  it("skips nested .git directories", () => {
    const src = path.join(tmpDir, "src");
    fs.mkdirSync(path.join(src, "plugins", "my-plugin", ".git", "objects"), { recursive: true });
    fs.writeFileSync(path.join(src, "plugins", "my-plugin", ".git", "objects", "ff"), "blob");
    fs.writeFileSync(path.join(src, "plugins", "my-plugin", "index.js"), "export default {}");

    const dst = path.join(tmpDir, "dst");
    copyDir(src, dst);

    expect(fs.existsSync(path.join(dst, "plugins", "my-plugin", ".git"))).toBe(false);
    expect(fs.readFileSync(path.join(dst, "plugins", "my-plugin", "index.js"), "utf-8")).toBe(
      "export default {}",
    );
  });

  it("creates destination directory if it does not exist", () => {
    const src = path.join(tmpDir, "src");
    fs.mkdirSync(src);
    fs.writeFileSync(path.join(src, "file.txt"), "data");

    copyDir(src, path.join(tmpDir, "nested", "deep", "dst"));

    expect(fs.existsSync(path.join(tmpDir, "nested", "deep", "dst", "file.txt"))).toBe(true);
  });
});

describe("ensureProjectsLink", () => {
  it("creates a symlink to the shared projects dir", () => {
    const profileDir = path.join(tmpDir, "profile");
    const sharedDir = path.join(tmpDir, "shared");
    fs.mkdirSync(profileDir);

    ensureProjectsLink(profileDir, sharedDir);

    const linkPath = path.join(profileDir, "projects");
    expect(fs.lstatSync(linkPath).isSymbolicLink()).toBe(true);
    expect(fs.readlinkSync(linkPath)).toBe(path.join(sharedDir, "projects"));
  });

  it("creates the shared projects dir if it does not exist", () => {
    const profileDir = path.join(tmpDir, "profile");
    const sharedDir = path.join(tmpDir, "shared");
    fs.mkdirSync(profileDir);

    ensureProjectsLink(profileDir, sharedDir);

    expect(fs.existsSync(path.join(sharedDir, "projects"))).toBe(true);
  });

  it("does not touch an existing real projects directory", () => {
    const profileDir = path.join(tmpDir, "profile");
    const sharedDir = path.join(tmpDir, "shared");
    fs.mkdirSync(path.join(profileDir, "projects"), { recursive: true });
    fs.writeFileSync(path.join(profileDir, "projects", "chat.json"), "{}");

    ensureProjectsLink(profileDir, sharedDir);

    expect(fs.lstatSync(path.join(profileDir, "projects")).isSymbolicLink()).toBe(false);
    expect(fs.existsSync(path.join(profileDir, "projects", "chat.json"))).toBe(true);
  });

  it("does not touch an existing symlink", () => {
    const profileDir = path.join(tmpDir, "profile");
    const sharedDir = path.join(tmpDir, "shared");
    const otherTarget = path.join(tmpDir, "other-projects");
    fs.mkdirSync(profileDir);
    fs.mkdirSync(otherTarget);
    fs.symlinkSync(otherTarget, path.join(profileDir, "projects"));

    ensureProjectsLink(profileDir, sharedDir);

    expect(fs.readlinkSync(path.join(profileDir, "projects"))).toBe(otherTarget);
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
