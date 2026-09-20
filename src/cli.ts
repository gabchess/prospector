import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { buildBatch, approve, exportRows, type Batch } from "./model.js";
import { importCsv, toCsv } from "./csv.js";

async function inputText(file: string) {
  const s = await readFile(file, "utf8");
  if (Buffer.byteLength(s) > 10_000_000) throw Error("Input exceeds 10 MB");
  return s;
}
async function json(file: string) {
  return JSON.parse(await inputText(file));
}
async function save(file: string, value: unknown) {
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  await writeFile(
    file,
    typeof value === "string" ? value : JSON.stringify(value, null, 2) + "\n",
    { flag: "wx", mode: 0o600 },
  );
}
async function batch(file: string): Promise<Batch> {
  const raw = await json(file);
  const rebuilt = buildBatch(
    raw.profile,
    raw.rows.map((r: { lead: unknown }) => r.lead),
    new Date(raw.createdAt),
  );
  if (JSON.stringify(raw) !== JSON.stringify(rebuilt))
    throw Error("Invalid or edited batch. Rebuild it.");
  return rebuilt;
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (command === "build" && args.length === 3) {
    const [profile, input, out] = args;
    const raw = input.endsWith(".csv")
      ? importCsv(await inputText(input))
      : await json(input);
    const result = buildBatch(await json(profile), raw);
    await save(out, result);
    console.log(
      JSON.stringify({
        rows: result.rows.length,
        ready: result.rows.filter((r) => r.status === "ready_for_review")
          .length,
        output: out,
      }),
    );
    return;
  }
  if (command === "review" && args.length === 3) {
    if (!process.stdin.isTTY || !process.stdout.isTTY)
      throw Error("Review requires an interactive human terminal");
    const [input, reviewer, out] = args;
    const b = await batch(input),
      ids: string[] = [];
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    try {
      for (const row of b.rows) {
        if (row.status !== "ready_for_review") continue;
        console.log(JSON.stringify(row, null, 2));
        const answer = await rl.question(
          "Approve this exact row for export? [yes/NO] ",
        );
        if (answer.trim().toLowerCase() === "yes") ids.push(row.id);
      }
    } finally {
      rl.close();
    }
    await save(out, approve(b, ids, reviewer));
    console.log(`${ids.length} rows approved. No outreach sent.`);
    return;
  }
  if (command === "export" && args.length === 3) {
    const [input, approval, out] = args;
    const rows = exportRows(await batch(input), await json(approval));
    await save(out, toCsv(rows));
    console.log(`${rows.length} approved rows exported. No outreach sent.`);
    return;
  }
  throw Error(
    "Usage: pnpm run build:leads PROFILE INPUT OUTPUT | pnpm review BATCH REVIEWER APPROVAL | pnpm export:leads BATCH APPROVAL CSV",
  );
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : "Command failed");
  process.exitCode = 1;
});
