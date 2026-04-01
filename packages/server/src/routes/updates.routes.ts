// ──────────────────────────────────────────────
// Updates: Check for new versions and apply updates
// ──────────────────────────────────────────────
import type { FastifyInstance } from "fastify";
import { APP_VERSION } from "@marinara-engine/shared";
import { execFile } from "child_process";
import { existsSync } from "fs";
import { resolve } from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

const GITHUB_REPO = "SpicyMarinara/Marinara-Engine";
const GITHUB_API = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

// ── Cached release info (15-min TTL) ──
let cachedRelease: {
  latestVersion: string;
  releaseUrl: string;
  releaseNotes: string;
  publishedAt: string;
} | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 15 * 60_000;

/** Detect whether this install is a git repo. */
function isGitInstall(): boolean {
  // Walk up from packages/server/dist to monorepo root
  const monorepoRoot = resolve(process.cwd(), "..", "..");
  return existsSync(resolve(monorepoRoot, ".git"));
}

/** Get the monorepo root (two levels up from packages/server). */
function getMonorepoRoot(): string {
  return resolve(process.cwd(), "..", "..");
}

/** Compare semver strings. Returns true if b > a. */
function isNewerVersion(current: string, latest: string): boolean {
  const parse = (v: string) => v.replace(/^v/, "").split(".").map(Number);
  const a = parse(current);
  const b = parse(latest);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    if (bv > av) return true;
    if (bv < av) return false;
  }
  return false;
}

export async function updatesRoutes(app: FastifyInstance) {
  // ── Check for updates ──
  // GET /api/updates/check
  // Fetches the latest release from GitHub, caches for 15 minutes.
  app.get("/check", async (_req, reply) => {
    const now = Date.now();

    // Return cached if fresh
    if (cachedRelease && now - cacheTimestamp < CACHE_TTL_MS) {
      return {
        currentVersion: APP_VERSION,
        ...cachedRelease,
        updateAvailable: isNewerVersion(APP_VERSION, cachedRelease.latestVersion),
        installType: isGitInstall() ? "git" : "standalone",
      };
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);

      const res = await fetch(GITHUB_API, {
        headers: {
          Accept: "application/vnd.github.v3+json",
          "User-Agent": `MarinaraEngine/${APP_VERSION}`,
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        return reply.status(502).send({
          error: `GitHub API returned ${res.status}`,
          currentVersion: APP_VERSION,
          updateAvailable: false,
        });
      }

      const data = (await res.json()) as {
        tag_name: string;
        html_url: string;
        body: string;
        published_at: string;
      };

      const latestVersion = data.tag_name.replace(/^v/, "");
      cachedRelease = {
        latestVersion,
        releaseUrl: data.html_url,
        releaseNotes: data.body ?? "",
        publishedAt: data.published_at,
      };
      cacheTimestamp = now;

      return {
        currentVersion: APP_VERSION,
        ...cachedRelease,
        updateAvailable: isNewerVersion(APP_VERSION, latestVersion),
        installType: isGitInstall() ? "git" : "standalone",
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.status(502).send({
        error: `Failed to check for updates: ${message}`,
        currentVersion: APP_VERSION,
        updateAvailable: false,
      });
    }
  });

  // ── Apply update (git installs only) ──
  // POST /api/updates/apply
  // Runs git pull, pnpm install, rebuild, then signals the process to restart.
  app.post("/apply", async (_req, reply) => {
    if (!isGitInstall()) {
      return reply.status(400).send({
        error:
          "Auto-update is only available for git-based installs. For Docker, run: docker compose pull && docker compose up -d",
        installType: "standalone",
      });
    }

    const root = getMonorepoRoot();

    try {
      // Step 1: git pull
      const { stdout: pullOut } = await execFileAsync("git", ["pull"], {
        cwd: root,
        timeout: 60_000,
      });

      if (pullOut.includes("Already up to date")) {
        return { status: "already_up_to_date", message: "Already on the latest version." };
      }

      // Step 2: pnpm install
      await execFileAsync("pnpm", ["install", "--frozen-lockfile"], {
        cwd: root,
        timeout: 120_000,
      });

      // Step 3: Rebuild all packages
      await execFileAsync("pnpm", ["build"], {
        cwd: root,
        timeout: 300_000,
      });

      // Step 4: Signal restart — exit with code 0 so the start script re-launches.
      // Send response first, then schedule exit.
      const result = {
        status: "updated",
        message: "Update applied successfully. The server will restart momentarily.",
      };

      // Give Fastify time to flush the response, then exit
      setTimeout(() => {
        console.log("[Update] Restarting server after update...");
        process.exit(0);
      }, 500);

      return result;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.status(500).send({
        error: `Update failed: ${message}`,
        hint: "You can try running the update manually: git pull && pnpm install && pnpm build",
      });
    }
  });
}
