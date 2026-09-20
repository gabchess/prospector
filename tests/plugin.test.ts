import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, realpathSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const json = (path: string) => JSON.parse(readFileSync(join(root, path), "utf8"));
const plugin = "plugins/prospector";

test("host catalogs install the same versioned, dependency-free skill", () => {
  const codex = json(".agents/plugins/marketplace.json");
  const claude = json(".claude-plugin/marketplace.json");
  assert.equal(codex.name, "prospector");
  assert.equal(claude.name, codex.name);
  assert.equal(codex.plugins[0].source.path, "./" + plugin);
  assert.equal(claude.plugins[0].source, "./" + plugin);
  for (const host of ["codex", "claude"]) {
    const manifest = json(plugin + "/." + host + "-plugin/plugin.json");
    assert.equal(manifest.name, "prospector");
    const version = json("package.json").version;
    assert.equal(manifest.version.split("+")[0], version);
    if (host === "codex") {
      assert.ok(manifest.version === version || /^\+codex\.\d{14}$/.test(manifest.version.slice(version.length)));
    } else assert.equal(manifest.version, version);
    assert.equal(manifest.skills.replace(/\/$/, ""), "./skills");
    assert.equal(manifest.hooks, undefined);
    assert.equal(manifest.mcpServers, undefined);
  }
});

test("bundled Markdown references resolve inside the installed plugin", () => {
  const base = realpathSync(join(root, plugin));
  const walk = (directory: string): string[] =>
    readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? walk(path) : [path];
    });
  for (const file of walk(base).filter((path) => path.endsWith(".md"))) {
    const content = readFileSync(file, "utf8");
    for (const match of content.matchAll(/\]\(([^)]+)\)/g)) {
      const target = match[1];
      if (/^https:\/\//.test(target) || target.startsWith("#")) continue;
      const resolved = realpathSync(resolve(dirname(file), target.split("#")[0]));
      assert.ok(!relative(base, resolved).startsWith(".."), file + ": " + target);
    }
  }
});
