import "dotenv/config";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./createServer.js";

async function main() {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Nothing goes to stdout after this — stdout is the JSON-RPC channel.
  // Status/debug output must go to stderr instead.
  console.error("[inventory-mcp] connected over stdio, 8 tools registered");
}

main().catch((err) => {
  console.error("[inventory-mcp] fatal error", err);
  process.exit(1);
});
