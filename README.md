# 🍝 RPG Engine (Marinara Engine)

**AI Chat & Roleplay Frontend** — Conversation, Roleplay, Visual Novel modes with full character management, sprite systems, combat encounters, and more.

A local-first application that connects to any OpenAI-compatible API (OpenAI, Anthropic, Google, OpenRouter, Mistral, Cohere, or any custom endpoint).

---

## Installation

### Option A: Desktop Installer (Recommended)

Download the latest installer from the [Releases](https://github.com/your-repo/rpg-engine/releases) page:

| Platform | File |
|----------|------|
| Windows | `RPG-Engine-Setup-x.x.x.exe` |
| macOS | `RPG-Engine-x.x.x-arm64.dmg` (Apple Silicon) / `RPG-Engine-x.x.x-x64.dmg` (Intel) |
| Linux | `RPG-Engine-x.x.x.AppImage` |

Just run the installer and launch. Everything is bundled — no extra setup needed.

---

### Option B: Run from Source (No Installer)

If you'd rather not run an `.exe` (perfectly understandable!), you can run RPG Engine directly from source. This is the exact same app — just without the Electron desktop wrapper.

#### Prerequisites

- **[Node.js](https://nodejs.org/) v20 or newer** — download from [nodejs.org](https://nodejs.org/en/download)
- **[pnpm](https://pnpm.io/)** — install via `corepack enable` (included with Node.js) or `npm install -g pnpm`
- **[Git](https://git-scm.com/)** — to clone the repository

#### Quick Start (one command)

**Windows:**
```
git clone https://github.com/your-repo/rpg-engine.git
cd rpg-engine
start.bat
```

**macOS / Linux:**
```bash
git clone https://github.com/your-repo/rpg-engine.git
cd rpg-engine
chmod +x start.sh
./start.sh
```

The start script will automatically:
1. Check that Node.js and pnpm are installed
2. Install all dependencies (first run only)
3. Build the application
4. Initialize the database
5. Start the server and open your browser to `http://localhost:7860`

#### Manual Step-by-Step

If you prefer to do it yourself:

```bash
# 1. Clone the repository
git clone https://github.com/your-repo/rpg-engine.git
cd rpg-engine

# 2. Install dependencies
pnpm install

# 3. Build everything
pnpm build

# 4. Initialize the database
pnpm db:push

# 5. Copy and configure environment (optional)
cp .env.example .env
# Edit .env if you want to change the port or add an encryption key

# 6. Start the server
cd packages/server
node dist/index.js
```

Then open **http://localhost:7860** in your browser. That's it — no account, no cloud, everything runs locally.

#### Updating

```bash
git pull
pnpm install
pnpm build
pnpm db:push
```

Then restart the server.

---

## Development

```bash
# Start both server + client in dev mode (hot reload)
pnpm dev

# Server only (port 7860)
pnpm dev:server

# Client only (port 5173, proxies API to server)
pnpm dev:client
```

### Building Desktop Installers

To build the Electron desktop app yourself:

```bash
# Install Electron dependencies
pnpm install

# Build for your current platform
pnpm package

# Build for a specific platform
pnpm package:win    # Windows .exe installer
pnpm package:mac    # macOS .dmg
pnpm package:linux  # Linux .AppImage
```

Output goes to the `release/` directory.

> **Note:** Cross-platform builds may require additional tools (e.g., Wine for building Windows on macOS/Linux). Building for your own platform always works.

---

## Project Structure

```
rpg-engine/
├── packages/
│   ├── shared/          # TypeScript types & schemas (shared between client/server)
│   ├── server/          # Fastify API server + SQLite database
│   └── client/          # React frontend (Vite + Tailwind v4)
├── electron/            # Electron desktop wrapper
│   ├── main.cjs         # Main process (starts server + window)
│   └── resources/       # App icons
├── start.bat            # Windows launcher script
├── start.sh             # macOS/Linux launcher script
├── data/                # Runtime data (database, avatars, etc.)
└── .env.example         # Environment configuration template
```

## Configuration

Copy `.env.example` to `.env` to customize:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `7860` | Server port |
| `HOST` | `0.0.0.0` | Bind address |
| `DATABASE_URL` | `file:./data/rpg-engine.db` | SQLite database path |
| `ENCRYPTION_KEY` | *(empty)* | AES key for API key encryption at rest |
| `LOG_LEVEL` | `info` | Logging verbosity (`debug`, `info`, `warn`, `error`) |
| `CORS_ORIGINS` | `http://localhost:5173` | Allowed CORS origins (comma-separated) |

---

## Features

- **Multiple Chat Modes** — Conversation, Roleplay, Visual Novel (coming soon)
- **Character Management** — Import/create characters with avatars, personality, backstories
- **Persona System** — User personas with custom appearances
- **Sprite System** — Character expression sprites with automatic switching
- **Combat Encounters** — Turn-based RPG combat with AI-generated scenarios
- **Agent System** — World-state tracking, prose guardian, continuity checker, custom agents
- **Lorebooks** — World-building entries with keyword triggers
- **Preset Management** — Save/load generation parameters
- **Multi-Provider** — OpenAI, Anthropic, Google, OpenRouter, Mistral, Cohere, custom APIs
- **Chat Branching** — Branch conversations at any point
- **Group Chats** — Multiple characters in one conversation
- **Regex Scripts** — Custom text processing with regex find/replace
- **SillyTavern Import** — Migrate characters, chats, presets, and settings
- **Export** — Save chats as JSON or Markdown
- **Backgrounds & Weather** — Custom chat backgrounds with dynamic weather effects
- **Fully Local** — No accounts, no cloud, no telemetry

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Tailwind CSS v4, Framer Motion, Zustand, React Query |
| Backend | Fastify 5, Drizzle ORM, SQLite (better-sqlite3) |
| Desktop | Electron 33, electron-builder |
| Shared | TypeScript 5, Zod |
| Build | Vite 6, pnpm workspaces |

---

## License

[AGPL-3.0](LICENSE)
