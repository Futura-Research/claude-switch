import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { readAccountInfo, formatAccount } from "../src/account.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "claude-switch-account-test-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("readAccountInfo", () => {
  it("reads email and organization from .claude.json", () => {
    fs.writeFileSync(
      path.join(tmpDir, ".claude.json"),
      JSON.stringify({
        oauthAccount: { emailAddress: "dev@acme.com", organizationName: "Acme" },
      }),
    );

    expect(readAccountInfo(tmpDir)).toEqual({ email: "dev@acme.com", organization: "Acme" });
  });

  it("returns email only when organization is absent", () => {
    fs.writeFileSync(
      path.join(tmpDir, ".claude.json"),
      JSON.stringify({ oauthAccount: { emailAddress: "me@personal.dev" } }),
    );

    expect(readAccountInfo(tmpDir)).toEqual({ email: "me@personal.dev", organization: undefined });
  });

  it("returns null when .claude.json is missing", () => {
    expect(readAccountInfo(tmpDir)).toBeNull();
  });

  it("returns null when there is no oauthAccount", () => {
    fs.writeFileSync(path.join(tmpDir, ".claude.json"), JSON.stringify({ theme: "dark" }));
    expect(readAccountInfo(tmpDir)).toBeNull();
  });

  it("returns null when oauthAccount has no email or organization", () => {
    fs.writeFileSync(
      path.join(tmpDir, ".claude.json"),
      JSON.stringify({ oauthAccount: { accountUuid: "abc" } }),
    );
    expect(readAccountInfo(tmpDir)).toBeNull();
  });

  it("returns null on invalid JSON", () => {
    fs.writeFileSync(path.join(tmpDir, ".claude.json"), "not-json");
    expect(readAccountInfo(tmpDir)).toBeNull();
  });

  it("returns null for non-claude agents", () => {
    fs.writeFileSync(
      path.join(tmpDir, ".claude.json"),
      JSON.stringify({ oauthAccount: { emailAddress: "dev@acme.com" } }),
    );
    expect(readAccountInfo(tmpDir, "codex")).toBeNull();
  });
});

describe("formatAccount", () => {
  it("joins email and organization with a separator", () => {
    expect(formatAccount({ email: "dev@acme.com", organization: "Acme" })).toBe(
      "dev@acme.com · Acme",
    );
  });

  it("shows email alone", () => {
    expect(formatAccount({ email: "dev@acme.com" })).toBe("dev@acme.com");
  });

  it("shows organization alone", () => {
    expect(formatAccount({ organization: "Acme" })).toBe("Acme");
  });

  it("returns an empty string when neither field is set", () => {
    expect(formatAccount({})).toBe("");
  });
});
