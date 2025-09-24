import fs from "fs";
import path from "path";

export function getAppVersion(): string {
  try {
    const pkgPath = path.join(process.cwd(), "package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    return String(pkg.version ?? "0.0.0");
  } catch {
    return "unknown";
  }
}

export function getGitSha(): string {
  return process.env.GIT_SHA?.slice(0, 12) ?? "unknown";
}
