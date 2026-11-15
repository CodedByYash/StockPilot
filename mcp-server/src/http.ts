import type { IncomingMessage, ServerResponse } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "./createServer.js";

function json(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

/**
 * Whoever can reach this endpoint can call every tool — including the write
 * tools — as the inventory service account. So it fails closed: no
 * MCP_AUTH_TOKEN configured means nothing gets in, and the comparison is
 * constant-time.
 */
function isAuthorized(req: IncomingMessage): boolean {
  const secret = process.env.MCP_AUTH_TOKEN;
  if (!secret) return false;
  const given = Buffer.from(req.headers.authorization ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Remote (Streamable HTTP) version of the same 8-tool server, for Vercel.
 * Stateless: a fresh server + transport per request, so it works on
 * serverless where consecutive requests can land on different instances.
 */
export default async function handler(
  req: IncomingMessage & { body?: unknown },
  res: ServerResponse
): Promise<void> {
  if (!isAuthorized(req)) {
    if (!process.env.MCP_AUTH_TOKEN) {
      return json(res, 503, { error: "MCP_AUTH_TOKEN is not configured" });
    }
    res.setHeader("WWW-Authenticate", "Bearer");
    return json(res, 401, { error: "Unauthorized" });
  }

  // Stateless mode has no session to resume (GET) or terminate (DELETE).
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, {
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method not allowed." },
      id: null,
    });
  }

  const server = createServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on("close", () => {
    void transport.close();
    void server.close();
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error("[inventory-mcp] request failed", err);
    if (!res.headersSent) {
      json(res, 500, {
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
}
