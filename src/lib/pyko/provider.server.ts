// Server-only Lovable AI Gateway provider adapter for Pyko.
// Reads LOVABLE_API_KEY inside the handler; never at module scope.

import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export const PYKO_DEFAULT_MODEL = "openai/gpt-5.4-mini";

export function createPykoProvider() {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Pyko: LOVABLE_API_KEY is not configured.");
  return createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    supportsStructuredOutputs: true,
    headers: {
      "Lovable-API-Key": key,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
  });
}
