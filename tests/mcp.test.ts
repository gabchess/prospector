import test from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
test("MCP exposes assessment only and rejects approval commands", async () => {
  const client = new Client({ name: "fixture-client", version: "1" });
  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: ["--import", "tsx", "src/mcp.ts"],
    }),
  );
  try {
    const tools = await client.listTools();
    assert.deepEqual(
      tools.tools.map((t) => t.name),
      ["assess_leads"],
    );
    const result = await client.callTool({
      name: "assess_leads",
      arguments: {
        profile: {
          name: "Demo",
          offer: "Automation",
          countries: ["BR"],
          industries: ["software"],
          minEmployees: 1,
          maxEmployees: 200,
          targetRoles: ["Owner"],
          sources: ["manual"],
        },
        leads: [],
      },
    });
    assert(!result.isError);
    const content = result.content as Array<{ type: string; text?: string }>;
    assert.deepEqual(
      JSON.parse(content.find((c) => c.type === "text")!.text!).rows,
      [],
    );
    const rejected = await client.callTool({
      name: "approve_leads",
      arguments: {},
    });
    assert.equal(rejected.isError, true);
  } finally {
    await client.close();
  }
});
