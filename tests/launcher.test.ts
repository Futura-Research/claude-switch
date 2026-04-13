import { describe, it, expect } from "vitest";
import * as path from "node:path";
import * as os from "node:os";
import * as fs from "node:fs";
import { spawnSync } from "node:child_process";
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

describe("launch integration", () => {
  it("spawns a process with correct env and args", () => {
    // Create a mock "claude" script that prints its env and args
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "claude-switch-launch-"));
    const mockClaude = path.join(tmpDir, "mock-claude");
    const outputFile = path.join(tmpDir, "output.json");

    fs.writeFileSync(
      mockClaude,
      `#!/bin/sh
echo "{\\"configDir\\": \\"$CLAUDE_CONFIG_DIR\\", \\"args\\": \\"$*\\"}" > ${outputFile}
`,
    );
    fs.chmodSync(mockClaude, 0o755);

    // Run the mock directly with spawnSync to test env passing
    const env = buildLaunchEnv("/tmp/test-profile");
    const args = buildLaunchArgs(["--dangerously-skip-permissions"]);
    const result = spawnSync(mockClaude, args, { env, stdio: "pipe" });

    expect(result.status).toBe(0);

    const output = JSON.parse(fs.readFileSync(outputFile, "utf-8"));
    expect(output.configDir).toBe("/tmp/test-profile");
    expect(output.args).toBe("--dangerously-skip-permissions");

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
