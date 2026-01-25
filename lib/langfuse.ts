// Langfuse client configuration for tracing AI calls
import { Langfuse } from "langfuse";

// Increase max listeners to prevent warning in development with hot-reloading
// Langfuse registers beforeExit listeners for flushing traces
if (typeof process !== 'undefined' && process.setMaxListeners) {
  process.setMaxListeners(20);
}

// Use global singleton pattern to survive Next.js hot-reloading in development
const globalForLangfuse = globalThis as unknown as {
  langfuse: Langfuse | undefined;
};

export const langfuse = globalForLangfuse.langfuse ?? new Langfuse({
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  baseUrl: process.env.LANGFUSE_BASE_URL,
});

if (process.env.NODE_ENV !== 'production') {
  globalForLangfuse.langfuse = langfuse;
}

// Helper to ensure all traces are flushed before process exits
export async function flushLangfuse() {
  await langfuse.flushAsync();
}

