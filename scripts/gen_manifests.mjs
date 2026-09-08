#!/usr/bin/env node
/**
 * STRUCTURAL_INTEGRITY_ONLY
 *
 * Manifest generator. Walks the shipped files and writes:
 *   - release-manifest.json        (path, sha256, bytes per file; self-excluded)
 *   - documentation-manifest.json  (path, sha256 per doc file; claim boundary)
 *
 * The manifests record that the package is structurally intact. They prove no
 * live run, no lead quality, and no outcome for any ICP.
 *
 * Usage:
 *   node scripts/gen_manifests.mjs          # write both manifests
 *   node scripts/gen_manifests.mjs --check  # fail on drift, write nothing
 */
import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

const VERSION = "0.2.0";

/** Never shipped, never hashed. */
const EXCLUDED_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  ".claude",
  "scripts",
]);

/** Real-lead shapes and generated outputs never enter a manifest, even when
 * they exist locally. The sample fixture is shipped and IS listed. */
const EXCLUDED_FILES = new Set([
  "data/companies.csv",
  "data/companies_signals.csv",
  "data/leads_final.csv",
  "data/pending-approval.json",
  "data/agent-log.jsonl",
  "data/raw/crunchbase.json",
  "data/raw/clutch.json",
  ".env",
  ".crunchbase.storageState.json",
  ".crunchbase.search-url",
  ".DS_Store",
]);

const RELEASE_MANIFEST = "release-manifest.json";
const DOCUMENTATION_MANIFEST = "documentation-manifest.json";

/** Docs surface: envelope files plus the docs suite. */
const DOC_PATHS = [
  "CHANGELOG.md",
  "HOST-MATRIX.md",
  "LICENSE-STATUS.md",
  "PROVENANCE.md",
  "README.md",
  "START-HERE.md",
  "Prospector T-NOVA v0.2.0.txt",
  "claude/README.md",
  "codex/prospector/README.md",
  "codex/prospector/SKILL.md",
  "data/README.md",
  "docs/EXAMPLE-WALKTHROUGH.md",
  "docs/EXTEND-YOUR-STACK.md",
  "docs/FIRST-RUN.md",
  "docs/HUMAN-GAPS.md",
  "docs/INSTALL-CLAUDE.md",
  "docs/INSTALL-CODEX.md",
  "docs/OPERATE-PROSPECTOR.md",
  "docs/RECOVERY-AND-EXIT.md",
  "docs/TROUBLESHOOTING.md",
  "docs/TRUST-PRIVACY-AND-AUTHORITY.md",
  "docs/VALIDATION-AND-LIMITS.md",
];

async function walk(dir, rel = "", out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const relPath = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      await walk(path.join(dir, entry.name), relPath, out);
    } else if (entry.isFile()) {
      if (EXCLUDED_FILES.has(relPath)) continue;
      if (relPath === RELEASE_MANIFEST || relPath === DOCUMENTATION_MANIFEST)
        continue;
      out.push(relPath);
    }
  }
  return out;
}

async function sha256(file) {
  const buf = await readFile(file);
  return createHash("sha256").update(buf).digest("hex");
}

async function main() {
  const checkMode = process.argv.includes("--check");
  const files = (await walk(REPO_ROOT)).sort();

  const releaseFiles = [];
  for (const rel of files) {
    const abs = path.join(REPO_ROOT, rel);
    const [hash, info] = await Promise.all([sha256(abs), stat(abs)]);
    releaseFiles.push({ path: rel, sha256: hash, bytes: info.size });
  }

  const release = {
    format: "cd-customer-release/v1",
    product: "prospector",
    product_name: "Prospector",
    version: VERSION,
    targets: ["codex", "claude"],
    license_status: "MIT (code); see LICENSE-STATUS.md",
    files: releaseFiles,
  };

  const docFiles = [];
  for (const rel of DOC_PATHS) {
    const abs = path.join(REPO_ROOT, rel);
    docFiles.push({ path: rel, sha256: await sha256(abs) });
  }
  const documentation = {
    format: "cd-documentation-manifest/v1",
    product: "prospector",
    version: VERSION,
    claim_boundary:
      "Documents structure and intended behavior of the pipeline. Proves no live run, no lead quality, and no outcome for any ICP except the installer's own verified runs.",
    files: docFiles,
  };

  const releaseText = `${JSON.stringify(release, null, 2)}\n`;
  const docText = `${JSON.stringify(documentation, null, 2)}\n`;

  if (checkMode) {
    let drift = false;
    for (const [name, text] of [
      [RELEASE_MANIFEST, releaseText],
      [DOCUMENTATION_MANIFEST, docText],
    ]) {
      const abs = path.join(REPO_ROOT, name);
      let current = null;
      try {
        current = await readFile(abs, "utf8");
      } catch {
        /* missing file is drift */
      }
      if (current !== text) {
        console.error(`manifest drift: ${name} is stale or missing`);
        drift = true;
      }
    }
    if (drift) {
      console.error("run: pnpm manifests");
      process.exit(1);
    }
    console.log(
      `manifests in sync: ${releaseFiles.length} release files, ${docFiles.length} documented`,
    );
    return;
  }

  const { writeFile } = await import("node:fs/promises");
  await writeFile(path.join(REPO_ROOT, RELEASE_MANIFEST), releaseText, "utf8");
  await writeFile(
    path.join(REPO_ROOT, DOCUMENTATION_MANIFEST),
    docText,
    "utf8",
  );
  console.log(
    `wrote ${RELEASE_MANIFEST} (${releaseFiles.length} files) and ${DOCUMENTATION_MANIFEST} (${docFiles.length} files)`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
