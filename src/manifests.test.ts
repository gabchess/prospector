import { execFileSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Manifest drift test. The checked-in manifests must match what the
 * generator produces from the working tree. STRUCTURAL_INTEGRITY_ONLY: a
 * green check proves the package is intact, not that any run happened.
 */

const REPO_ROOT = path.resolve(__dirname, "..");

describe("release manifests", () => {
  it("release-manifest.json and documentation-manifest.json are in sync", () => {
    const out = execFileSync(
      "node",
      [path.join(REPO_ROOT, "scripts", "gen_manifests.mjs"), "--check"],
      { cwd: REPO_ROOT, encoding: "utf8" },
    );
    expect(out).toContain("manifests in sync");
  });

  it("release manifest excludes real-lead shapes and lists the skill packages", async () => {
    const manifest = JSON.parse(
      await import("node:fs/promises").then((fs) =>
        fs.readFile(path.join(REPO_ROOT, "release-manifest.json"), "utf8"),
      ),
    );
    const paths = manifest.files.map((f: { path: string }) => f.path);
    expect(manifest.format).toBe("cd-customer-release/v1");
    expect(manifest.product).toBe("prospector");
    expect(manifest.version).toBe("0.2.0");
    // real-lead shapes never ship
    for (const banned of [
      "data/companies.csv",
      "data/leads_final.csv",
      "data/companies_signals.csv",
      "data/pending-approval.json",
    ]) {
      expect(paths).not.toContain(banned);
    }
    // the fixtures and packages do
    expect(paths).toContain("data/sample-companies.csv");
    expect(paths).toContain("codex/prospector/SKILL.md");
    expect(paths).toContain("claude/prospector-v0.2.0.zip");
    // the release manifest never lists itself
    expect(paths).not.toContain("release-manifest.json");
    for (const file of manifest.files) {
      expect(file.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(file.bytes).toBeGreaterThan(0);
    }
  });

  it("documentation manifest carries an honest claim boundary", async () => {
    const manifest = JSON.parse(
      await import("node:fs/promises").then((fs) =>
        fs.readFile(
          path.join(REPO_ROOT, "documentation-manifest.json"),
          "utf8",
        ),
      ),
    );
    expect(manifest.format).toBe("cd-documentation-manifest/v1");
    expect(manifest.claim_boundary).toContain("Proves no live run");
    expect(manifest.files.length).toBeGreaterThan(10);
    for (const file of manifest.files) {
      expect(file.sha256).toMatch(/^[a-f0-9]{64}$/);
    }
  });
});
