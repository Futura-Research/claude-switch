import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { initConfig } from "../src/config.js";
import { addProfile } from "../src/profiles.js";
import { addRule } from "../src/rules.js";
import {
  run,
  printUsage,
  printVersion,
  requireName,
  runWithErrorHandling,
  handleAdd,
  handleRemove,
  handleList,
  handleDefault,
  handleRule,
  handleCopyConfig,
  handleReset,
  handleDuplicate,
  handleWhich,
  launchClaude,
} from "../src/cli.js";

// Mock launcher to avoid spawning real processes
vi.mock("../src/launcher.js", () => ({
  launch: vi.fn(),
}));

let tmpDir: string;
let exitSpy: ReturnType<typeof vi.spyOn>;
let logSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "claude-switch-cli-test-"));
  initConfig(tmpDir);
  exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
  logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("printUsage", () => {
  it("prints usage text", () => {
    printUsage();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("claude-switch"));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("--help"));
  });
});

describe("printVersion", () => {
  it("prints version", () => {
    printVersion();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("claude-switch"));
  });
});

describe("requireName", () => {
  it("returns name when provided", () => {
    expect(requireName(["work"], "Usage: test")).toBe("work");
  });

  it("exits with error when name is missing", () => {
    requireName([], "Usage: test <name>");
    expect(errorSpy).toHaveBeenCalledWith("Usage: test <name>");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});

describe("runWithErrorHandling", () => {
  it("runs function successfully", () => {
    const fn = vi.fn();
    runWithErrorHandling(fn);
    expect(fn).toHaveBeenCalled();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it("catches errors and exits", () => {
    runWithErrorHandling(() => {
      throw new Error("test error");
    });
    expect(errorSpy).toHaveBeenCalledWith("test error");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});

describe("handleAdd", () => {
  it("creates profile and launches claude", async () => {
    const { launch } = await import("../src/launcher.js");
    handleAdd(["work", "--no-copy"], tmpDir);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Creating profile "work"'));
    expect(launch).toHaveBeenCalled();
  });

  it("exits when name is missing", () => {
    handleAdd([], tmpDir);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("handles duplicate profile error", () => {
    addProfile("work", tmpDir);
    handleAdd(["work"], tmpDir);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("already exists"));
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("copies base config by default when source exists", async () => {
    const { launch } = await import("../src/launcher.js");
    const fakeClaudeDir = path.join(tmpDir, "fake-claude");
    fs.mkdirSync(fakeClaudeDir);
    fs.writeFileSync(path.join(fakeClaudeDir, "settings.json"), '{"theme":"dark"}');

    const origEnv = process.env.CLAUDE_CONFIG_DIR;
    process.env.CLAUDE_CONFIG_DIR = fakeClaudeDir;
    try {
      handleAdd(["work"], tmpDir);
    } finally {
      if (origEnv !== undefined) {
        process.env.CLAUDE_CONFIG_DIR = origEnv;
      } else {
        delete process.env.CLAUDE_CONFIG_DIR;
      }
    }

    expect(launch).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Copied settings from"));
    const profileDir = path.join(tmpDir, "profiles", "work");
    expect(fs.readFileSync(path.join(profileDir, "settings.json"), "utf-8")).toBe(
      '{"theme":"dark"}',
    );
  });

  it("skips copy when --no-copy is passed", async () => {
    const { launch } = await import("../src/launcher.js");
    handleAdd(["work", "--no-copy"], tmpDir);
    expect(launch).toHaveBeenCalled();
    const profileDir = path.join(tmpDir, "profiles", "work");
    expect(fs.readdirSync(profileDir)).toHaveLength(0);
  });

  it("handles --no-copy before name", async () => {
    const { launch } = await import("../src/launcher.js");
    handleAdd(["--no-copy", "work"], tmpDir);
    expect(launch).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Creating profile "work"'));
  });
});

describe("handleRemove", () => {
  it("removes existing profile", () => {
    addProfile("work", tmpDir);
    handleRemove(["work"], tmpDir);
    expect(logSpy).toHaveBeenCalledWith('Profile "work" removed.');
  });

  it("exits when name is missing", () => {
    handleRemove([], tmpDir);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("handles nonexistent profile error", () => {
    handleRemove(["nonexistent"], tmpDir);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("does not exist"));
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});

describe("handleList", () => {
  it("shows empty message when no profiles", () => {
    handleList(tmpDir);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("No profiles configured"));
  });

  it("lists profiles with default marker", () => {
    addProfile("work", tmpDir);
    addProfile("personal", tmpDir);
    handleList(tmpDir);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("work (default)"));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("personal"));
  });
});

describe("handleDefault", () => {
  it("sets default profile", () => {
    addProfile("work", tmpDir);
    addProfile("personal", tmpDir);
    handleDefault(["personal"], tmpDir);
    expect(logSpy).toHaveBeenCalledWith('Default profile set to "personal".');
  });

  it("exits when name is missing", () => {
    handleDefault([], tmpDir);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("handles nonexistent profile error", () => {
    handleDefault(["nonexistent"], tmpDir);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("does not exist"));
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});

describe("handleRule", () => {
  beforeEach(() => {
    addProfile("work", tmpDir);
    addProfile("personal", tmpDir);
  });

  it("adds a rule", () => {
    handleRule(["add", "/code", "work"], tmpDir);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Rule added"));
  });

  it("exits when rule add is missing args", () => {
    handleRule(["add", "/code"], tmpDir);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("exits when rule add has no args", () => {
    handleRule(["add"], tmpDir);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("handles rule add error", () => {
    handleRule(["add", "/code", "nonexistent"], tmpDir);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("does not exist"));
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("removes a rule", () => {
    addRule("/code", "work", tmpDir);
    handleRule(["remove", "/code"], tmpDir);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Rule removed"));
  });

  it("exits when rule remove is missing dir", () => {
    handleRule(["remove"], tmpDir);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("handles rule remove error", () => {
    handleRule(["remove", "/nonexistent"], tmpDir);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("No rule found"));
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("lists rules when empty", () => {
    handleRule(["list"], tmpDir);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("No rules configured"));
  });

  it("lists existing rules", () => {
    addRule("/code", "work", tmpDir);
    handleRule(["list"], tmpDir);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("/code"));
  });

  it("exits on unknown subcommand", () => {
    handleRule(["unknown"], tmpDir);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("Usage: claude-switch rule"));
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});

describe("handleCopyConfig", () => {
  it("copies base config to existing profile", () => {
    addProfile("work", tmpDir);
    const fakeClaudeDir = path.join(tmpDir, "fake-claude");
    fs.mkdirSync(fakeClaudeDir);
    fs.writeFileSync(path.join(fakeClaudeDir, "settings.json"), '{"key":"val"}');

    const origEnv = process.env.CLAUDE_CONFIG_DIR;
    process.env.CLAUDE_CONFIG_DIR = fakeClaudeDir;
    try {
      handleCopyConfig(["work"], tmpDir);
    } finally {
      if (origEnv !== undefined) {
        process.env.CLAUDE_CONFIG_DIR = origEnv;
      } else {
        delete process.env.CLAUDE_CONFIG_DIR;
      }
    }

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Copied config from"));
    const profileDir = path.join(tmpDir, "profiles", "work");
    expect(fs.readFileSync(path.join(profileDir, "settings.json"), "utf-8")).toBe('{"key":"val"}');
  });

  it("exits with error when profile does not exist", () => {
    handleCopyConfig(["nonexistent"], tmpDir);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("does not exist"));
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("exits with error when name is missing", () => {
    handleCopyConfig([], tmpDir);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("reports nothing to copy when source is empty", () => {
    addProfile("work", tmpDir);
    const emptyDir = path.join(tmpDir, "empty-claude");
    fs.mkdirSync(emptyDir);

    const origEnv = process.env.CLAUDE_CONFIG_DIR;
    process.env.CLAUDE_CONFIG_DIR = emptyDir;
    try {
      handleCopyConfig(["work"], tmpDir);
    } finally {
      if (origEnv !== undefined) {
        process.env.CLAUDE_CONFIG_DIR = origEnv;
      } else {
        delete process.env.CLAUDE_CONFIG_DIR;
      }
    }

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Nothing to copy"));
  });

  it("dispatches correctly via run", () => {
    addProfile("work", tmpDir);
    const fakeClaudeDir = path.join(tmpDir, "fake-claude");
    fs.mkdirSync(fakeClaudeDir);
    fs.writeFileSync(path.join(fakeClaudeDir, "file.txt"), "data");

    const origEnv = process.env.CLAUDE_CONFIG_DIR;
    process.env.CLAUDE_CONFIG_DIR = fakeClaudeDir;
    try {
      run(["copy-config", "work"], tmpDir);
    } finally {
      if (origEnv !== undefined) {
        process.env.CLAUDE_CONFIG_DIR = origEnv;
      } else {
        delete process.env.CLAUDE_CONFIG_DIR;
      }
    }

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Copied config from"));
  });
});

describe("handleReset", () => {
  it("resets existing profile", () => {
    const profileDir = addProfile("work", tmpDir);
    fs.writeFileSync(path.join(profileDir, "settings.json"), "{}");

    handleReset(["work"], tmpDir);

    expect(logSpy).toHaveBeenCalledWith('Profile "work" has been reset.');
    expect(fs.readdirSync(profileDir)).toHaveLength(0);
  });

  it("exits with error when profile does not exist", () => {
    handleReset(["nonexistent"], tmpDir);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("does not exist"));
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("exits with error when name is missing", () => {
    handleReset([], tmpDir);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("dispatches correctly via run", () => {
    addProfile("work", tmpDir);
    run(["reset", "work"], tmpDir);
    expect(logSpy).toHaveBeenCalledWith('Profile "work" has been reset.');
  });
});

describe("handleDuplicate", () => {
  it("duplicates existing profile", () => {
    const sourceDir = addProfile("work", tmpDir);
    fs.writeFileSync(path.join(sourceDir, "settings.json"), '{"key":"val"}');

    handleDuplicate(["work", "work-copy"], tmpDir);

    expect(logSpy).toHaveBeenCalledWith('Profile "work-copy" created as a copy of "work".');
    const targetDir = path.join(tmpDir, "profiles", "work-copy");
    expect(fs.readFileSync(path.join(targetDir, "settings.json"), "utf-8")).toBe('{"key":"val"}');
  });

  it("exits with error when source does not exist", () => {
    handleDuplicate(["nonexistent", "copy"], tmpDir);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("does not exist"));
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("exits with error when target already exists", () => {
    addProfile("work", tmpDir);
    addProfile("personal", tmpDir);
    handleDuplicate(["work", "personal"], tmpDir);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("already exists"));
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("exits with error when args are missing", () => {
    handleDuplicate([], tmpDir);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("exits with error when target name is missing", () => {
    addProfile("work", tmpDir);
    handleDuplicate(["work"], tmpDir);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("dispatches correctly via run", () => {
    addProfile("work", tmpDir);
    run(["duplicate", "work", "work-copy"], tmpDir);
    expect(logSpy).toHaveBeenCalledWith('Profile "work-copy" created as a copy of "work".');
  });
});

describe("handleWhich", () => {
  it("shows resolved profile", () => {
    addProfile("work", tmpDir);
    handleWhich(tmpDir);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("work"));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("default"));
  });

  it("exits when no profile can be resolved", () => {
    handleWhich(tmpDir);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("No profile found"));
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});

describe("launchClaude", () => {
  it("resolves profile and launches", async () => {
    addProfile("work", tmpDir);
    const { launch } = await import("../src/launcher.js");
    launchClaude([], tmpDir);
    expect(launch).toHaveBeenCalled();
  });

  it("exits when no profile exists", () => {
    launchClaude([], tmpDir);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("No profile found"));
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});

describe("run", () => {
  it("dispatches --help", () => {
    run(["--help"]);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Usage:"));
  });

  it("dispatches -h", () => {
    run(["-h"]);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("Usage:"));
  });

  it("dispatches --version", () => {
    run(["--version"]);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("claude-switch"));
  });

  it("dispatches -v", () => {
    run(["-v"]);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("claude-switch"));
  });

  it("dispatches list command", () => {
    run(["list"], tmpDir);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("No profiles configured"));
  });

  it("dispatches add command", () => {
    run(["add"], tmpDir);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("dispatches remove command", () => {
    run(["remove"], tmpDir);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("dispatches default command", () => {
    run(["default"], tmpDir);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("dispatches rule command", () => {
    run(["rule", "list"], tmpDir);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("No rules configured"));
  });

  it("dispatches which command", () => {
    run(["which"], tmpDir);
    // No profiles, so it should error
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("falls through to launchClaude for unknown commands", () => {
    // No profiles configured, so launchClaude will error
    run(["--some-unknown-flag"], tmpDir);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("calls launchClaude with empty args when no args given", () => {
    // No profiles, so it will error
    run([], tmpDir);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
