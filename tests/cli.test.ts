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
    handleAdd(["work"], tmpDir);
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
