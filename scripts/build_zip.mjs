#!/usr/bin/env node
/**
 * STRUCTURAL_INTEGRITY_ONLY
 *
 * Builds claude/prospector-v0.2.0.zip from the codex skill tree. Single root
 * folder "prospector/" with SKILL.md at its top, full interior. The engine
 * (src/) does NOT ride inside; see claude/README.md.
 *
 * Usage: node scripts/build_zip.mjs
 */
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const SKILL_DIR = path.join(REPO_ROOT, "codex", "prospector");
const OUT_DIR = path.join(REPO_ROOT, "claude");
const OUT_ZIP = path.join(OUT_DIR, "prospector-v0.2.0.zip");

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  await rm(OUT_ZIP, { force: true });
  // -X keeps the archive free of mac metadata; run from codex/ so the single
  // root inside the zip is "prospector/".
  const res = spawnSync(
    "zip",
    ["-r", "-X", OUT_ZIP, "prospector", "-x", "*.DS_Store"],
    { cwd: path.join(REPO_ROOT, "codex"), stdio: "inherit" },
  );
  if (res.status !== 0) {
    throw new Error(`zip exited with status ${res.status}`);
  }
  console.log(`wrote ${path.relative(REPO_ROOT, OUT_ZIP)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
