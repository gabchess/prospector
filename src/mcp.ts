import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { buildBatch, Lead, Profile } from "./model.js";
const server = new McpServer({ name: "prospector", version: "0.3.0" });
server.registerTool(
  "assess_leads",
  {
    title: "Assess B2B lead evidence",
    description:
      "Check supplied leads against a profile. Returns fit, missing evidence and a suggested review step. No network access, approval, export or outreach.",
    inputSchema: { profile: Profile, leads: z.array(Lead).max(5000) },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  async ({ profile, leads }) => ({
    content: [
      { type: "text", text: JSON.stringify(buildBatch(profile, leads)) },
    ],
  }),
);
await server.connect(new StdioServerTransport());
