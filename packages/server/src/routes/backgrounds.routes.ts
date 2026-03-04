// ──────────────────────────────────────────────
// Routes: Chat Backgrounds (upload, list, delete, serve)
// ──────────────────────────────────────────────
import type { FastifyInstance } from "fastify";
import { existsSync, mkdirSync, readdirSync, unlinkSync } from "fs";
import { join, extname } from "path";
import { pipeline } from "stream/promises";
import { createWriteStream } from "fs";
import { randomUUID } from "crypto";

const BG_DIR = join(process.cwd(), "data", "backgrounds");

// Ensure directory exists
function ensureDir() {
  if (!existsSync(BG_DIR)) {
    mkdirSync(BG_DIR, { recursive: true });
  }
}

const ALLOWED_EXTS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif"]);

export async function backgroundsRoutes(app: FastifyInstance) {
  // List all backgrounds
  app.get("/", async () => {
    ensureDir();
    const files = readdirSync(BG_DIR).filter((f) => {
      const ext = extname(f).toLowerCase();
      return ALLOWED_EXTS.has(ext);
    });
    return files.map((filename) => ({
      filename,
      url: `/api/backgrounds/file/${encodeURIComponent(filename)}`,
    }));
  });

  // Upload a new background
  app.post("/upload", async (req, reply) => {
    ensureDir();
    const data = await req.file();
    if (!data) {
      return reply.status(400).send({ error: "No file uploaded" });
    }

    const ext = extname(data.filename).toLowerCase();
    if (!ALLOWED_EXTS.has(ext)) {
      return reply.status(400).send({ error: `Unsupported file type: ${ext}` });
    }

    const safeName = `${randomUUID()}${ext}`;
    const filePath = join(BG_DIR, safeName);

    await pipeline(data.file, createWriteStream(filePath));

    return {
      success: true,
      filename: safeName,
      url: `/api/backgrounds/file/${safeName}`,
    };
  });

  // Serve a background file
  app.get("/file/:filename", async (req, reply) => {
    ensureDir();
    const { filename } = req.params as { filename: string };

    // Prevent path traversal
    if (filename.includes("..") || filename.includes("/")) {
      return reply.status(400).send({ error: "Invalid filename" });
    }

    const filePath = join(BG_DIR, filename);
    if (!existsSync(filePath)) {
      return reply.status(404).send({ error: "Not found" });
    }

    const ext = extname(filename).toLowerCase();
    const mimeMap: Record<string, string> = {
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".webp": "image/webp",
      ".avif": "image/avif",
    };

    const { createReadStream } = await import("fs");
    const stream = createReadStream(filePath);
    return reply
      .header("Content-Type", mimeMap[ext] ?? "application/octet-stream")
      .header("Cache-Control", "public, max-age=31536000, immutable")
      .send(stream);
  });

  // Delete a background
  app.delete("/:filename", async (req, reply) => {
    ensureDir();
    const { filename } = req.params as { filename: string };

    if (filename.includes("..") || filename.includes("/")) {
      return reply.status(400).send({ error: "Invalid filename" });
    }

    const filePath = join(BG_DIR, filename);
    if (!existsSync(filePath)) {
      return reply.status(404).send({ error: "Not found" });
    }

    unlinkSync(filePath);
    return { success: true };
  });
}
