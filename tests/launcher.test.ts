import { describe, it, expect } from "vitest";
import * as path from "node:path";
import * as os from "node:os";
import { buildLaunchEnv, buildLaunchArgs } from "../src/launcher.js";

describe("buildLaunchEnv", () => {
  it("sets CLAUDE_CONFIG_DIR to resolved absolute path", () => {
    const env = buildLaunchEnv("/tmp/profiles/work");
    expect(env.CLAUDE_CONFIG_DIR).toBe("/tmp/profiles/work");
  });

  it("expands tilde in config dir", () => {
    const env = buildLaunchEnv("~/profiles/work");
    expect(env.CLAUDE_CONFIG_DIR).toBe(path.join(os.homedir(), "profiles/work"));
  });

  it("preserves existing env vars", () => {
    const env = buildLaunchEnv("/tmp/profiles/work");
    expect(env.PATH).toBeDefined();
    expect(env.HOME).toBeDefined();
  });
});

describe("buildLaunchArgs", () => {
  it("passes args through unchanged", () => {
    const args = buildLaunchArgs(["--dangerously-skip-permissions", "-p", "fix tests"]);
    expect(args).toEqual(["--dangerously-skip-permissions", "-p", "fix tests"]);
  });

  it("returns empty array for no args", () => {
    expect(buildLaunchArgs([])).toEqual([]);
  });

  it("does not mutate input array", () => {
    const input = ["--flag"];
    const output = buildLaunchArgs(input);
    output.push("extra");
    expect(input).toEqual(["--flag"]);
  });
});
