import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { initConfig, loadConfig, saveConfig } from "../src/config.js";
import {
  addProfile,
  removeProfile,
  listProfiles,
  setDefault,
  getDefault,
  duplicateProfile,
  resetProfile,
} from "../src/profiles.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "claude-switch-test-"));
  initConfig(tmpDir);
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("addProfile", () => {
  it("creates profile directory and updates config", () => {
    const profileDir = addProfile("work", tmpDir);

    expect(fs.existsSync(profileDir)).toBe(true);
    const profiles = listProfiles(tmpDir);
    expect(profiles).toHaveLength(1);
    expect(profiles[0].name).toBe("work");
  });

  it("sets first profile as default", () => {
    addProfile("work", tmpDir);
    expect(getDefault(tmpDir)).toBe("work");
  });

  it("does not overwrite default when adding second profile", () => {
    addProfile("work", tmpDir);
    addProfile("personal", tmpDir);
    expect(getDefault(tmpDir)).toBe("work");
  });

  it("throws on duplicate profile name", () => {
    addProfile("work", tmpDir);
    expect(() => addProfile("work", tmpDir)).toThrow('Profile "work" already exists.');
  });

  it("throws on reserved name", () => {
    expect(() => addProfile("help", tmpDir)).toThrow("reserved name");
    expect(() => addProfile("version", tmpDir)).toThrow("reserved name");
    expect(() => addProfile("add", tmpDir)).toThrow("reserved name");
    expect(() => addProfile("copy-config", tmpDir)).toThrow("reserved name");
    expect(() => addProfile("reset", tmpDir)).toThrow("reserved name");
    expect(() => addProfile("duplicate", tmpDir)).toThrow("reserved name");
  });

  it("throws on invalid name format", () => {
    expect(() => addProfile("123bad", tmpDir)).toThrow("Invalid profile name");
    expect(() => addProfile("has spaces", tmpDir)).toThrow("Invalid profile name");
    expect(() => addProfile("", tmpDir)).toThrow("Invalid profile name");
  });

  it("allows hyphens and underscores", () => {
    addProfile("my-work", tmpDir);
    addProfile("my_personal", tmpDir);
    const profiles = listProfiles(tmpDir);
    expect(profiles).toHaveLength(2);
  });
});

describe("removeProfile", () => {
  it("removes profile from config", () => {
    addProfile("work", tmpDir);
    removeProfile("work", tmpDir);
    expect(listProfiles(tmpDir)).toHaveLength(0);
  });

  it("throws when profile does not exist", () => {
    expect(() => removeProfile("nonexistent", tmpDir)).toThrow(
      'Profile "nonexistent" does not exist.',
    );
  });

  it("reassigns default when removing default profile", () => {
    addProfile("work", tmpDir);
    addProfile("personal", tmpDir);
    removeProfile("work", tmpDir);
    expect(getDefault(tmpDir)).toBe("personal");
  });

  it("keeps default unchanged when removing a non-default profile", () => {
    addProfile("work", tmpDir);
    addProfile("personal", tmpDir);
    removeProfile("personal", tmpDir);
    expect(getDefault(tmpDir)).toBe("work");
  });

  it("clears default when removing last profile", () => {
    addProfile("work", tmpDir);
    removeProfile("work", tmpDir);
    expect(getDefault(tmpDir)).toBeUndefined();
  });

  it("removes rules associated with the profile", () => {
    addProfile("work", tmpDir);
    const config = loadConfig(tmpDir);
    config.rules.push({ directory: "/code", profile: "work" });
    saveConfig(config, tmpDir);

    removeProfile("work", tmpDir);
    const updated = loadConfig(tmpDir);
    expect(updated.rules).toHaveLength(0);
  });
});

describe("listProfiles", () => {
  it("returns empty array when no profiles exist", () => {
    expect(listProfiles(tmpDir)).toEqual([]);
  });

  it("returns all profiles with default flag", () => {
    addProfile("work", tmpDir);
    addProfile("personal", tmpDir);

    const profiles = listProfiles(tmpDir);
    expect(profiles).toHaveLength(2);

    const work = profiles.find((p) => p.name === "work");
    const personal = profiles.find((p) => p.name === "personal");
    expect(work?.isDefault).toBe(true);
    expect(personal?.isDefault).toBe(false);
  });
});

describe("setDefault", () => {
  it("changes the default profile", () => {
    addProfile("work", tmpDir);
    addProfile("personal", tmpDir);

    setDefault("personal", tmpDir);
    expect(getDefault(tmpDir)).toBe("personal");
  });

  it("throws when profile does not exist", () => {
    expect(() => setDefault("nonexistent", tmpDir)).toThrow(
      'Profile "nonexistent" does not exist.',
    );
  });
});

describe("getDefault", () => {
  it("returns undefined when no profiles exist", () => {
    expect(getDefault(tmpDir)).toBeUndefined();
  });
});

describe("addProfile with copyFrom", () => {
  it("copies source contents when copyFrom is provided", () => {
    const sourceDir = path.join(tmpDir, "claude-source");
    fs.mkdirSync(sourceDir);
    fs.writeFileSync(path.join(sourceDir, "settings.json"), '{"theme":"dark"}');

    const profileDir = addProfile("work", tmpDir, { copyFrom: sourceDir });

    expect(fs.readFileSync(path.join(profileDir, "settings.json"), "utf-8")).toBe(
      '{"theme":"dark"}',
    );
  });

  it("creates profile normally when copyFrom is not provided", () => {
    const profileDir = addProfile("work", tmpDir);

    expect(fs.existsSync(profileDir)).toBe(true);
    expect(fs.readdirSync(profileDir)).toHaveLength(0);
  });

  it("creates profile normally when copyFrom path does not exist", () => {
    const profileDir = addProfile("work", tmpDir, { copyFrom: "/nonexistent/path" });

    expect(fs.existsSync(profileDir)).toBe(true);
    expect(fs.readdirSync(profileDir)).toHaveLength(0);
  });
});

describe("duplicateProfile", () => {
  it("creates new profile with source files", () => {
    const profileDir = addProfile("work", tmpDir);
    fs.writeFileSync(path.join(profileDir, "settings.json"), '{"key":"val"}');

    const targetDir = duplicateProfile("work", "work-copy", tmpDir);

    expect(fs.readFileSync(path.join(targetDir, "settings.json"), "utf-8")).toBe('{"key":"val"}');
  });

  it("registers new profile in config", () => {
    addProfile("work", tmpDir);
    duplicateProfile("work", "work-copy", tmpDir);

    const profiles = listProfiles(tmpDir);
    expect(profiles.find((p) => p.name === "work-copy")).toBeDefined();
  });

  it("does not change default profile", () => {
    addProfile("work", tmpDir);
    duplicateProfile("work", "work-copy", tmpDir);

    expect(getDefault(tmpDir)).toBe("work");
  });

  it("throws when source does not exist", () => {
    expect(() => duplicateProfile("nonexistent", "copy", tmpDir)).toThrow(
      'Source profile "nonexistent" does not exist.',
    );
  });

  it("throws when target already exists", () => {
    addProfile("work", tmpDir);
    addProfile("personal", tmpDir);

    expect(() => duplicateProfile("work", "personal", tmpDir)).toThrow(
      'Profile "personal" already exists.',
    );
  });

  it("throws on invalid target name", () => {
    addProfile("work", tmpDir);
    expect(() => duplicateProfile("work", "123bad", tmpDir)).toThrow("Invalid profile name");
  });

  it("creates empty target dir when source config dir is missing from disk", () => {
    addProfile("work", tmpDir);
    // Manually remove the source dir from disk to simulate deletion
    const config = loadConfig(tmpDir);
    fs.rmSync(config.profiles["work"].config_dir, { recursive: true, force: true });

    const targetDir = duplicateProfile("work", "work-copy", tmpDir);

    expect(fs.existsSync(targetDir)).toBe(true);
    expect(fs.statSync(targetDir).isDirectory()).toBe(true);
  });

  it("preserves auth fields in .claude.json", () => {
    const profileDir = addProfile("work", tmpDir);
    fs.writeFileSync(
      path.join(profileDir, ".claude.json"),
      JSON.stringify({ oauthAccount: { token: "secret" }, userID: "u123", theme: "dark" }),
    );

    const targetDir = duplicateProfile("work", "work-copy", tmpDir);

    const result = JSON.parse(fs.readFileSync(path.join(targetDir, ".claude.json"), "utf-8"));
    expect(result.oauthAccount).toEqual({ token: "secret" });
    expect(result.userID).toBe("u123");
    expect(result.theme).toBe("dark");
  });
});

describe("resetProfile", () => {
  it("clears all files in profile dir", () => {
    const profileDir = addProfile("work", tmpDir);
    fs.writeFileSync(path.join(profileDir, "settings.json"), "{}");
    fs.mkdirSync(path.join(profileDir, "projects"));

    resetProfile("work", tmpDir);

    expect(fs.readdirSync(profileDir)).toHaveLength(0);
  });

  it("keeps profile registered in config", () => {
    addProfile("work", tmpDir);
    resetProfile("work", tmpDir);

    const profiles = listProfiles(tmpDir);
    expect(profiles.find((p) => p.name === "work")).toBeDefined();
  });

  it("throws when profile does not exist", () => {
    expect(() => resetProfile("nonexistent", tmpDir)).toThrow(
      'Profile "nonexistent" does not exist.',
    );
  });
});
