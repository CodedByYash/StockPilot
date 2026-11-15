import { ResolverNotFoundError } from './resolvers.js';
import { ApiClientError } from './apiClient.js';

/**
 * Every tool handler must return this exact shape (confirmed against the
 * installed @modelcontextprotocol/sdk's CallToolResultSchema — see the
 * comment in index.ts). These two helpers keep that shape in one place so
 * no tool file has to reconstruct it by hand or drift from it.
 */
export function textResult(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}

export function errorResult(text: string) {
  return { content: [{ type: 'text' as const, text }], isError: true };
}

/**
 * Every tool's structure is the same: try the real work, and if it fails
 * for a reason the assistant should relay in plain language (an unknown
 * SKU, insufficient stock, a validation error from the API) rather than
 * crash the whole tool call, wrap it here. Genuinely unexpected errors
 * still surface (with their message) rather than being swallowed.
 */
export async function runTool(fn: () => Promise<string>) {
  try {
    const text = await fn();
    return textResult(text);
  } catch (err) {
    if (err instanceof ResolverNotFoundError) return errorResult(err.message);
    if (err instanceof ApiClientError) return errorResult(err.message);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return errorResult(`Unexpected error: ${message}`);
  }
}
