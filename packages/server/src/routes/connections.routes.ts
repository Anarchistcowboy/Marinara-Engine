// ──────────────────────────────────────────────
// Routes: Connections
// ──────────────────────────────────────────────
import type { FastifyInstance } from "fastify";
import { createConnectionSchema } from "@rpg-engine/shared";
import { createConnectionsStorage } from "../services/storage/connections.storage.js";
import { createLLMProvider } from "../services/llm/provider-registry.js";

export async function connectionsRoutes(app: FastifyInstance) {
  const storage = createConnectionsStorage(app.db);

  app.get("/", async () => {
    return storage.list();
  });

  app.get<{ Params: { id: string } }>("/:id", async (req, reply) => {
    const conn = await storage.getById(req.params.id);
    if (!conn) return reply.status(404).send({ error: "Connection not found" });
    // Mask key in response
    return { ...conn, apiKeyEncrypted: conn.apiKeyEncrypted ? "••••••••" : "" };
  });

  app.post("/", async (req) => {
    const input = createConnectionSchema.parse(req.body);
    return storage.create(input);
  });

  app.patch<{ Params: { id: string } }>("/:id", async (req) => {
    const data = createConnectionSchema.partial().parse(req.body);
    return storage.update(req.params.id, data);
  });

  app.delete<{ Params: { id: string } }>("/:id", async (req, reply) => {
    await storage.remove(req.params.id);
    return reply.status(204).send();
  });

  // Test connection (sends a tiny ping to the API)
  app.post<{ Params: { id: string } }>("/:id/test", async (req, reply) => {
    const conn = await storage.getWithKey(req.params.id);
    if (!conn) return reply.status(404).send({ error: "Connection not found" });

    const start = Date.now();
    try {
      // Simple models list fetch to verify the key works
      const { PROVIDERS } = await import("@rpg-engine/shared");
      const provider = PROVIDERS[conn.provider as keyof typeof PROVIDERS];
      const baseUrl = conn.baseUrl || provider?.defaultBaseUrl || "";

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (provider?.usesAuthHeader) {
        headers["Authorization"] = `Bearer ${conn.apiKey}`;
      }
      if (provider?.apiKeyHeader) {
        headers[provider.apiKeyHeader] = conn.apiKey;
      }

      // Google uses ?key= query param instead of headers
      let testUrl = `${baseUrl}${provider?.modelsEndpoint ?? "/models"}`;
      if (conn.provider === "google") {
        testUrl += `?key=${conn.apiKey}`;
      }

      const res = await fetch(testUrl, { headers });
      const latencyMs = Date.now() - start;

      if (res.ok) {
        return { success: true, message: "Connection successful", latencyMs, modelName: conn.model };
      } else {
        const body = await res.text();
        return { success: false, message: `API returned ${res.status}: ${body.slice(0, 200)}`, latencyMs, modelName: null };
      }
    } catch (err) {
      return {
        success: false,
        message: `Connection failed: ${err instanceof Error ? err.message : "Unknown error"}`,
        latencyMs: Date.now() - start,
        modelName: null,
      };
    }
  });

  // ── Test message — sends "hi" to the model and returns the response ──
  app.post<{ Params: { id: string } }>("/:id/test-message", async (req, reply) => {
    const conn = await storage.getWithKey(req.params.id);
    if (!conn) return reply.status(404).send({ error: "Connection not found" });

    if (!conn.model) {
      return reply.status(400).send({ error: "No model configured. Set a model first." });
    }

    const { PROVIDERS } = await import("@rpg-engine/shared");
    const providerDef = PROVIDERS[conn.provider as keyof typeof PROVIDERS];
    const baseUrl = conn.baseUrl || providerDef?.defaultBaseUrl || "";

    if (!baseUrl) {
      return reply.status(400).send({ error: "No base URL configured" });
    }

    const start = Date.now();
    try {
      const provider = createLLMProvider(conn.provider, baseUrl, conn.apiKey);

      let fullResponse = "";
      for await (const chunk of provider.chat(
        [{ role: "user", content: "hi" }],
        {
          model: conn.model,
          temperature: 0.7,
          maxTokens: 200,
          stream: false,
        },
      )) {
        fullResponse += chunk;
      }

      const latencyMs = Date.now() - start;
      return {
        success: true,
        response: fullResponse.slice(0, 500),
        latencyMs,
        model: conn.model,
      };
    } catch (err) {
      return {
        success: false,
        response: "",
        latencyMs: Date.now() - start,
        error: err instanceof Error ? err.message : "Unknown error",
        model: conn.model,
      };
    }
  });
}
