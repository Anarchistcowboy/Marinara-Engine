// ──────────────────────────────────────────────
// Importer: SillyTavern Bulk Import (folder scan)
// ──────────────────────────────────────────────
import { readdir, readFile, stat, copyFile, mkdir } from "fs/promises";
import { join, extname, basename } from "path";
import { existsSync } from "fs";
import { randomUUID } from "crypto";
import type { DB } from "../../db/connection.js";
import { importSTCharacter } from "./st-character.importer.js";
import { importSTChat } from "./st-chat.importer.js";
import { importSTPreset } from "./st-prompt.importer.js";
import { importSTLorebook } from "./st-lorebook.importer.js";
import { characters as charactersTable, personas as personasTable } from "../../db/schema/index.js";
import { createCharactersStorage } from "../storage/characters.storage.js";

const BG_DIR = join(process.cwd(), "data", "backgrounds");
const BG_EXTS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif"]);

// ─── Helpers ───

/** Read PNG tEXt chunk with keyword "chara" → base64 JSON */
function extractCharaFromPng(buf: Buffer): Record<string, unknown> | null {
  // PNG signature: 8 bytes
  if (buf.length < 8) return null;
  let offset = 8; // skip signature

  while (offset < buf.length - 8) {
    const length = buf.readUInt32BE(offset);
    const type = buf.subarray(offset + 4, offset + 8).toString("ascii");

    if (type === "tEXt") {
      const payload = buf.subarray(offset + 8, offset + 8 + length);
      const nullIdx = payload.indexOf(0);
      if (nullIdx >= 0) {
        const keyword = payload.subarray(0, nullIdx).toString("ascii");
        if (keyword === "chara") {
          const b64 = payload.subarray(nullIdx + 1).toString("ascii");
          try {
            const json = Buffer.from(b64, "base64").toString("utf-8");
            return JSON.parse(json);
          } catch {
            return null;
          }
        }
      }
    }

    // Move past length(4) + type(4) + data(length) + crc(4)
    offset += 12 + length;
  }
  return null;
}

/** Try multiple possible ST data folder layouts */
function resolveSTDataDir(rootPath: string): string | null {
  // Common locations:
  // <rootPath>/data/default-user/
  // <rootPath>/public/   (older ST versions)
  // <rootPath>/          (user points directly to data dir)
  const candidates = [
    join(rootPath, "data", "default-user"),
    join(rootPath, "data"),
    join(rootPath, "public"),
    rootPath,
  ];

  for (const c of candidates) {
    // Check if this looks like an ST data dir (has a characters folder)
    if (existsSync(join(c, "characters"))) return c;
  }
  return null;
}

async function listFiles(dir: string, ext?: string): Promise<string[]> {
  if (!existsSync(dir)) return [];
  const entries = await readdir(dir, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && (!ext || extname(e.name).toLowerCase() === ext))
    .map((e) => join(dir, e.name));
}

async function listFilesRecursive(dir: string, ext?: string): Promise<string[]> {
  if (!existsSync(dir)) return [];
  const results: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      results.push(...await listFilesRecursive(full, ext));
    } else if (!ext || extname(e.name).toLowerCase() === ext) {
      results.push(full);
    }
  }
  return results;
}

// ─── Scan ───

export interface STBulkScanResult {
  success: boolean;
  error?: string;
  dataDir?: string;
  characters: { path: string; name: string; format: string }[];
  chats: { path: string; characterName: string }[];
  groupChats: { path: string; groupName: string; members: string[] }[];
  presets: { path: string; name: string }[];
  lorebooks: { path: string; name: string }[];
  backgrounds: { path: string; name: string }[];
  personas: { path: string; name: string }[];
}

export async function scanSTFolder(rootPath: string): Promise<STBulkScanResult> {
  // Validate
  if (!existsSync(rootPath)) {
    return { success: false, error: "Folder does not exist", characters: [], chats: [], groupChats: [], presets: [], lorebooks: [], backgrounds: [], personas: [] };
  }

  const dataDir = resolveSTDataDir(rootPath);
  if (!dataDir) {
    return {
      success: false,
      error: "Could not find SillyTavern data directory. Make sure the path points to your SillyTavern installation folder.",
      characters: [],
      chats: [],
      groupChats: [],
      presets: [],
      lorebooks: [],
      backgrounds: [],
      personas: [],
    };
  }

  const characters: STBulkScanResult["characters"] = [];
  const chats: STBulkScanResult["chats"] = [];
  const groupChats: STBulkScanResult["groupChats"] = [];
  const presets: STBulkScanResult["presets"] = [];
  const lorebooks: STBulkScanResult["lorebooks"] = [];
  const backgrounds: STBulkScanResult["backgrounds"] = [];
  const personas: STBulkScanResult["personas"] = [];

  // 1. Characters — JSON and PNG files in characters/
  const charDir = join(dataDir, "characters");
  if (existsSync(charDir)) {
    const entries = await readdir(charDir, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isFile()) continue;
      const ext = extname(e.name).toLowerCase();
      const fullPath = join(charDir, e.name);

      if (ext === ".json") {
        try {
          const raw = JSON.parse(await readFile(fullPath, "utf-8"));
          const name = raw?.data?.name ?? raw?.char_name ?? raw?.name ?? basename(e.name, ".json");
          characters.push({ path: fullPath, name: String(name), format: "json" });
        } catch {
          // skip
        }
      } else if (ext === ".png") {
        try {
          const buf = await readFile(fullPath);
          const card = extractCharaFromPng(buf);
          if (card) {
            const d = card.data as Record<string, unknown> | undefined;
            const name = d?.name ?? card.char_name ?? card.name ?? basename(e.name, ".png");
            characters.push({ path: fullPath, name: String(name), format: "png" });
          }
        } catch {
          // skip
        }
      }
    }
  }

  // 2. Chats — JSONL files in chats/<character_name>/ subfolders
  const chatsDir = join(dataDir, "chats");
  if (existsSync(chatsDir)) {
    const jsonlFiles = await listFilesRecursive(chatsDir, ".jsonl");
    for (const f of jsonlFiles) {
      try {
        const content = await readFile(f, "utf-8");
        const firstLine = content.split("\n")[0];
        if (firstLine) {
          const header = JSON.parse(firstLine);
          const charName = header.character_name ?? basename(join(f, ".."));
          chats.push({ path: f, characterName: String(charName) });
        }
      } catch {
        // skip
      }
    }
  }

  // 3. Presets — JSON files in TextGen Settings/ and OpenAI Settings/
  for (const folder of ["TextGen Settings", "OpenAI Settings", "textgen settings", "openai settings"]) {
    const presetDir = join(dataDir, folder);
    const files = await listFiles(presetDir, ".json");
    for (const f of files) {
      try {
        const raw = JSON.parse(await readFile(f, "utf-8"));
        const name = raw.name ?? basename(f, ".json");
        presets.push({ path: f, name: String(name) });
      } catch {
        // skip
      }
    }
  }

  // 4. Lorebooks / World Info — JSON files in worlds/
  const worldsDir = join(dataDir, "worlds");
  if (existsSync(worldsDir)) {
    const files = await listFiles(worldsDir, ".json");
    for (const f of files) {
      try {
        const raw = JSON.parse(await readFile(f, "utf-8"));
        const name = raw.name ?? basename(f, ".json");
        lorebooks.push({ path: f, name: String(name) });
      } catch {
        // skip
      }
    }
  }

  // 5. Backgrounds — image files in backgrounds/
  for (const folder of ["backgrounds", "Backgrounds"]) {
    const bgDir = join(dataDir, folder);
    if (!existsSync(bgDir)) continue;
    const entries = await readdir(bgDir, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isFile()) continue;
      const ext = extname(e.name).toLowerCase();
      if (BG_EXTS.has(ext)) {
        backgrounds.push({ path: join(bgDir, e.name), name: e.name });
      }
    }
    break; // only use the first matching folder
  }

  // 6. Group chats — groups/ (metadata) + group chats/ (JSONL files)
  const groupsDir = join(dataDir, "groups");
  const groupChatsDir = join(dataDir, "group chats");
  if (existsSync(groupsDir)) {
    // Build map: groupId → group metadata
    const groupMetaMap = new Map<string, { name: string; members: string[] }>();
    const groupFiles = await listFiles(groupsDir, ".json");
    for (const f of groupFiles) {
      try {
        const raw = JSON.parse(await readFile(f, "utf-8"));
        const gId = raw.id ?? basename(f, ".json");
        const gName = raw.name ?? "Unnamed Group";
        // Members can be an array of filenames (e.g. "char.png") or character names
        const members: string[] = (raw.members ?? []).map((m: string) => {
          // Strip file extensions to get character name
          return m.replace(/\.(png|json)$/i, "");
        });
        groupMetaMap.set(String(gId), { name: String(gName), members });
      } catch {
        // skip
      }
    }

    // Scan group chat JSONL files
    if (existsSync(groupChatsDir)) {
      const gcEntries = await readdir(groupChatsDir, { withFileTypes: true });
      for (const e of gcEntries) {
        if (!e.isDirectory()) continue;
        const groupId = e.name;
        const meta = groupMetaMap.get(groupId);
        if (!meta) continue;

        const gcFolder = join(groupChatsDir, groupId);
        const jsonlFiles = await listFiles(gcFolder, ".jsonl");
        for (const f of jsonlFiles) {
          groupChats.push({ path: f, groupName: meta.name, members: meta.members });
        }
      }
    }

    // Also check for group chats stored directly as JSONL in a flat structure
    if (existsSync(groupChatsDir) && groupChats.length === 0) {
      const flatJsonl = await listFiles(groupChatsDir, ".jsonl");
      for (const f of flatJsonl) {
        try {
          const content = await readFile(f, "utf-8");
          const firstLine = content.split("\n")[0];
          if (firstLine) {
            const header = JSON.parse(firstLine);
            const chatId = header.chat_id ?? header.group_id;
            const meta = chatId ? groupMetaMap.get(String(chatId)) : null;
            const gName = meta?.name ?? "Group Chat";
            const members = meta?.members ?? [];
            groupChats.push({ path: f, groupName: gName, members });
          }
        } catch {
          // skip
        }
      }
    }
  }

  // 7. User Personas — PNG/JPG files in User Avatars/
  const PERSONA_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp"]);
  for (const folder of ["User Avatars", "user avatars"]) {
    const avatarDir = join(dataDir, folder);
    if (!existsSync(avatarDir)) continue;
    const entries = await readdir(avatarDir, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isFile()) continue;
      const ext = extname(e.name).toLowerCase();
      if (PERSONA_EXTS.has(ext)) {
        const name = basename(e.name, ext);
        personas.push({ path: join(avatarDir, e.name), name });
      }
    }
    break;
  }

  return { success: true, dataDir, characters, chats, groupChats, presets, lorebooks, backgrounds, personas };
}

// ─── Bulk Import ───

export interface STBulkImportOptions {
  characters: boolean;
  chats: boolean;
  groupChats: boolean;
  presets: boolean;
  lorebooks: boolean;
  backgrounds: boolean;
  personas: boolean;
}

export interface STBulkImportResult {
  success: boolean;
  error?: string;
  imported: {
    characters: number;
    chats: number;
    groupChats: number;
    presets: number;
    lorebooks: number;
    backgrounds: number;
    personas: number;
  };
  errors: string[];
}

export async function runSTBulkImport(
  rootPath: string,
  options: STBulkImportOptions,
  db: DB,
): Promise<STBulkImportResult> {
  const scanResult = await scanSTFolder(rootPath);
  if (!scanResult.success || !scanResult.dataDir) {
    return {
      success: false,
      error: scanResult.error ?? "Scan failed",
      imported: { characters: 0, chats: 0, groupChats: 0, presets: 0, lorebooks: 0, backgrounds: 0, personas: 0 },
      errors: [],
    };
  }

  const imported = { characters: 0, chats: 0, groupChats: 0, presets: 0, lorebooks: 0, backgrounds: 0, personas: 0 };
  const errors: string[] = [];

  // Import characters
  if (options.characters) {
    for (const ch of scanResult.characters) {
      try {
        if (ch.format === "png") {
          const buf = await readFile(ch.path);
          const card = extractCharaFromPng(buf);
          if (card) {
            // Attach avatar as data URL
            const b64 = buf.toString("base64");
            const dataUrl = `data:image/png;base64,${b64}`;
            (card as Record<string, unknown>)._avatarDataUrl = dataUrl;
            await importSTCharacter(card as Record<string, unknown>, db);
            imported.characters++;
          }
        } else {
          const raw = JSON.parse(await readFile(ch.path, "utf-8"));
          await importSTCharacter(raw, db);
          imported.characters++;
        }
      } catch (err) {
        errors.push(`Character "${ch.name}": ${(err as Error).message}`);
      }
    }
  }

  // Build a name → characterId map for linking chats to characters
  // We look at ALL characters in DB (including ones just imported)
  const charNameToId = new Map<string, string>();
  try {
    const allChars = await db.select().from(charactersTable);
    for (const ch of allChars) {
      try {
        const data = JSON.parse(ch.data);
        const name = (data?.name ?? "").toLowerCase().trim();
        if (name) charNameToId.set(name, ch.id);
      } catch {
        // skip
      }
    }
  } catch {
    // DB read failed, continue without linking
  }

  // Import chats (with character linking)
  // Generate one groupId per character name so all chats for the same character
  // are grouped together (like ST "chat files" / branches).
  if (options.chats) {
    const charGroupIds = new Map<string, string>();
    for (const ct of scanResult.chats) {
      try {
        const content = await readFile(ct.path, "utf-8");
        const charId = charNameToId.get(ct.characterName.toLowerCase().trim()) ?? null;
        const groupKey = ct.characterName.toLowerCase().trim();
        if (!charGroupIds.has(groupKey)) {
          charGroupIds.set(groupKey, randomUUID());
        }
        await importSTChat(content, db, {
          characterId: charId,
          chatName: ct.characterName,
          groupId: charGroupIds.get(groupKey)!,
        });
        imported.chats++;
      } catch (err) {
        errors.push(`Chat "${ct.characterName}": ${(err as Error).message}`);
      }
    }
  }

  // Import group chats
  if (options.groupChats) {
    const gcGroupIds = new Map<string, string>();
    for (const gc of scanResult.groupChats) {
      try {
        const content = await readFile(gc.path, "utf-8");
        // Build speaker→characterId map from member names
        const speakerMap: Record<string, string> = {};
        for (const memberName of gc.members) {
          const cid = charNameToId.get(memberName.toLowerCase().trim());
          if (cid) speakerMap[memberName] = cid;
        }
        const groupKey = gc.groupName.toLowerCase().trim();
        if (!gcGroupIds.has(groupKey)) {
          gcGroupIds.set(groupKey, randomUUID());
        }
        await importSTChat(content, db, {
          chatName: gc.groupName,
          speakerMap,
          mode: "roleplay",
          groupId: gcGroupIds.get(groupKey)!,
        });
        imported.groupChats++;
      } catch (err) {
        errors.push(`Group chat "${gc.groupName}": ${(err as Error).message}`);
      }
    }
  }

  // Import presets
  if (options.presets) {
    for (const pr of scanResult.presets) {
      try {
        const raw = JSON.parse(await readFile(pr.path, "utf-8"));
        await importSTPreset(raw, db, pr.name);
        imported.presets++;
      } catch (err) {
        errors.push(`Preset "${pr.name}": ${(err as Error).message}`);
      }
    }
  }

  // Import lorebooks
  if (options.lorebooks) {
    for (const lb of scanResult.lorebooks) {
      try {
        const raw = JSON.parse(await readFile(lb.path, "utf-8"));
        await importSTLorebook(raw, db);
        imported.lorebooks++;
      } catch (err) {
        errors.push(`Lorebook "${lb.name}": ${(err as Error).message}`);
      }
    }
  }

  // Import backgrounds
  if (options.backgrounds) {
    // Ensure our backgrounds directory exists
    if (!existsSync(BG_DIR)) {
      await mkdir(BG_DIR, { recursive: true });
    }
    for (const bg of scanResult.backgrounds) {
      try {
        const ext = extname(bg.name).toLowerCase();
        const destName = `${randomUUID()}${ext}`;
        await copyFile(bg.path, join(BG_DIR, destName));
        imported.backgrounds++;
      } catch (err) {
        errors.push(`Background "${bg.name}": ${(err as Error).message}`);
      }
    }
  }

  // Import personas
  if (options.personas) {
    const storage = createCharactersStorage(db);
    const AVATAR_DIR = join(process.cwd(), "data", "avatars");
    if (!existsSync(AVATAR_DIR)) {
      await mkdir(AVATAR_DIR, { recursive: true });
    }
    for (const p of scanResult.personas) {
      try {
        // Copy avatar image
        const ext = extname(p.path).toLowerCase();
        const destName = `${randomUUID()}${ext}`;
        await copyFile(p.path, join(AVATAR_DIR, destName));
        const avatarPath = `/api/avatars/file/${destName}`;
        await storage.createPersona(p.name, "", avatarPath);
        imported.personas++;
      } catch (err) {
        errors.push(`Persona "${p.name}": ${(err as Error).message}`);
      }
    }
  }

  return { success: true, imported, errors };
}
