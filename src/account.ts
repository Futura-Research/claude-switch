import * as fs from "node:fs";
import * as path from "node:path";

export interface AccountInfo {
  email?: string;
  organization?: string;
}

/**
 * Reads the logged-in account from a profile's config directory so `list` and
 * `which` can show which account a profile is signed into. Returns null when
 * the profile is not authenticated or the agent has no readable account file.
 */
export function readAccountInfo(configDir: string, agentId = "claude"): AccountInfo | null {
  if (agentId !== "claude") {
    return null;
  }

  const claudeJsonPath = path.join(configDir, ".claude.json");
  if (!fs.existsSync(claudeJsonPath)) {
    return null;
  }

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(fs.readFileSync(claudeJsonPath, "utf-8")) as Record<string, unknown>;
  } catch {
    return null;
  }

  const oauth = data.oauthAccount;
  if (!oauth || typeof oauth !== "object") {
    return null;
  }

  const account = oauth as Record<string, unknown>;
  const email = typeof account.emailAddress === "string" ? account.emailAddress : undefined;
  const organization =
    typeof account.organizationName === "string" ? account.organizationName : undefined;

  if (!email && !organization) {
    return null;
  }

  return { email, organization };
}

export function formatAccount(info: AccountInfo): string {
  if (info.email && info.organization) {
    return `${info.email} · ${info.organization}`;
  }
  return info.email ?? info.organization ?? "";
}
