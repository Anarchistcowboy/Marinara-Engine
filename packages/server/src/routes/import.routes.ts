// ──────────────────────────────────────────────
// Routes: Import (SillyTavern data)
// ──────────────────────────────────────────────
import type { FastifyInstance } from "fastify";
import { execFile } from "child_process";
import { platform } from "os";
import { importSTChat } from "../services/import/st-chat.importer.js";
import { importSTCharacter } from "../services/import/st-character.importer.js";
import { importSTPreset } from "../services/import/st-prompt.importer.js";
import { importSTLorebook } from "../services/import/st-lorebook.importer.js";
import { scanSTFolder, runSTBulkImport, type STBulkImportOptions } from "../services/import/st-bulk.importer.js";

/**
 * Opens a native OS folder picker and returns the selected path.
 * macOS  → osascript
 * Linux  → zenity / kdialog
 * Windows → PowerShell
 */
function pickFolder(): Promise<string | null> {
  return new Promise((resolve) => {
    const os = platform();

    if (os === "darwin") {
      execFile("osascript", ["-e", 'POSIX path of (choose folder with prompt "Select your SillyTavern folder")'], (err, stdout) => {
        if (err) return resolve(null);
        const p = stdout.trim().replace(/\/$/, "");
        resolve(p || null);
      });
    } else if (os === "win32") {
      const ps = [
        "-NoProfile", "-Command",
        "Add-Type -AssemblyName System.Windows.Forms; $d = New-Object System.Windows.Forms.FolderBrowserDialog; $d.Description = 'Select your SillyTavern folder'; if ($d.ShowDialog() -eq 'OK') { $d.SelectedPath } else { '' }",
      ];
      execFile("powershell.exe", ps, (err, stdout) => {
        if (err) return resolve(null);
        const p = stdout.trim();
        resolve(p || null);
      });
    } else {
      // Linux — try zenity first, then kdialog
      execFile("zenity", ["--file-selection", "--directory", "--title=Select your SillyTavern folder"], (err, stdout) => {
        if (!err && stdout.trim()) return resolve(stdout.trim());
        execFile("kdialog", ["--getexistingdirectory", ".", "--title", "Select your SillyTavern folder"], (err2, stdout2) => {
          if (err2) return resolve(null);
          const p = stdout2.trim();
          resolve(p || null);
        });
      });
    }
  });
}

export async function importRoutes(app: FastifyInstance) {
  /** Import a SillyTavern JSONL chat file. */
  app.post("/st-chat", async (req) => {
    const data = await req.file();
    if (!data) return { error: "No file uploaded" };
    const content = await data.toBuffer();
    return importSTChat(content.toString("utf-8"), app.db);
  });

  /** Import a SillyTavern character (JSON body). */
  app.post("/st-character", async (req) => {
    return importSTCharacter(req.body as Record<string, unknown>, app.db);
  });

  /** Import a SillyTavern prompt preset (JSON body). */
  app.post("/st-preset", async (req) => {
    return importSTPreset(req.body as Record<string, unknown>, app.db);
  });

  /** Import a SillyTavern World Info / lorebook (JSON body). */
  app.post("/st-lorebook", async (req) => {
    return importSTLorebook(req.body as Record<string, unknown>, app.db);
  });

  // ═══════════════════════════════════════════════
  // Bulk Import: Scan + Run from a local ST folder
  // ═══════════════════════════════════════════════

  /** Scan a SillyTavern installation folder, return counts of importable data. */
  app.post("/st-bulk/scan", async (req) => {
    const { folderPath } = req.body as { folderPath: string };
    if (!folderPath || typeof folderPath !== "string") {
      return { success: false, error: "folderPath is required" };
    }
    return scanSTFolder(folderPath.trim());
  });

  /** Run a bulk import from a SillyTavern installation folder. */
  app.post("/st-bulk/run", async (req) => {
    const { folderPath, options } = req.body as {
      folderPath: string;
      options: STBulkImportOptions;
    };
    if (!folderPath || typeof folderPath !== "string") {
      return { success: false, error: "folderPath is required" };
    }
    return runSTBulkImport(folderPath.trim(), options, app.db);
  });

  /** Open a native OS folder picker dialog and return the selected path. */
  app.post("/pick-folder", async () => {
    const selected = await pickFolder();
    if (!selected) return { success: false, error: "No folder selected" };
    return { success: true, path: selected };
  });
}
