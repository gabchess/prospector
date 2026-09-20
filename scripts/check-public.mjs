import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
const files = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  { encoding: "utf8" },
)
  .split("\0")
  .filter(Boolean);
const allowed =
  /^(?:src\/[^/]+\.ts|tests\/[^/]+\.test\.ts|scripts\/check-public\.mjs|plugins\/prospector\/(?:\.codex-plugin\/plugin\.json|\.claude-plugin\/plugin\.json|skills\/prospector\/(?:SKILL\.md|(?:references|assets|examples)\/[a-z-]+\.md))|examples\/[a-z-]+\.json|\.agents\/plugins\/marketplace\.json|\.claude-plugin\/marketplace\.json|docs\/engine\.md|(?:README|CHANGELOG|HOST-MATRIX|LICENSE|PROVENANCE)\.md|\.gitignore|package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|tsconfig\.json)$/;
let failed = false;
for (const file of files) {
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch (e) {
    if (e.code === "ENOENT") continue;
    throw e;
  }
  if (!allowed.test(file)) {
    console.error("Unreviewed public path:", file);
    failed = true;
  }
  if (file === "scripts/check-public.mjs") continue;
  if (
    /\/Users\/|\/home\/|sk_live_[A-Za-z0-9]|gh[pousr]_[A-Za-z0-9]{20}|-----BEGIN .*PRIVATE KEY/.test(
      text,
    )
  ) {
    console.error("Private marker or credential candidate:", file);
    failed = true;
  }
}
if (failed) process.exitCode = 1;
else console.log("Public file boundary passed.");
