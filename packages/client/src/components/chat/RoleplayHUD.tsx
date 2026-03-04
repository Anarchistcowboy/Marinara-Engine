// ──────────────────────────────────────────────
// Chat: Roleplay HUD — immersive world-state overlay
// with RPG stats, inventory, quest tracker & character panel
// ──────────────────────────────────────────────
import { useState } from "react";
import {
  Clock,
  MapPin,
  Cloud,
  Sword,
  Users,
  Heart,
  Zap,
  Star,
  Shield,
  Package,
  Scroll,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Target,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { cn } from "../../lib/utils";
import type { Chat } from "@rpg-engine/shared";
import type {
  GameState,
  PresentCharacter,
  PlayerStats,
  CharacterStat,
  InventoryItem,
  QuestProgress,
} from "@rpg-engine/shared";

interface RoleplayHUDProps {
  chat: Chat;
  characterCount: number;
}

export function RoleplayHUD({ chat, characterCount }: RoleplayHUDProps) {
  const [expanded, setExpanded] = useState(false);
  const meta =
    typeof chat.metadata === "string" ? JSON.parse(chat.metadata) : chat.metadata ?? {};

  // World state can be populated by the world-state agent or manually
  const worldState = meta.worldState ?? {};
  const time = worldState.time ?? worldState.timeOfDay ?? null;
  const location = worldState.location ?? null;
  const weather = worldState.weather ?? null;
  const hasAny = time || location || weather;

  // Game state (from last agent update)
  const gameState = (meta.gameState ?? null) as GameState | null;
  const playerStats = gameState?.playerStats ?? meta.playerStats ?? null;
  const presentCharacters = (gameState?.presentCharacters ?? meta.presentCharacters ?? []) as PresentCharacter[];
  const activeQuests = (playerStats?.activeQuests ?? (meta.activeQuests ?? [])) as QuestProgress[];
  const inventory = (playerStats?.inventory ?? (meta.inventory ?? [])) as InventoryItem[];
  const stats = (playerStats?.stats ?? []) as CharacterStat[];

  const hasGameData = stats.length > 0 || inventory.length > 0 || activeQuests.length > 0 || presentCharacters.length > 0;

  return (
    <div className="rpg-hud pointer-events-none relative z-10">
      {/* Top bar: world info pills */}
      <div className="pointer-events-auto flex items-center gap-1 px-3 py-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {location && <HUDPill icon={<MapPin size={11} />} label={location} color="emerald" />}
          {time && <HUDPill icon={<Clock size={11} />} label={time} color="amber" />}
          {weather && <HUDPill icon={<Cloud size={11} />} label={weather} color="sky" />}
          {!hasAny && <HUDPill icon={<Sword size={11} />} label="Adventure awaits..." color="purple" />}
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          {/* Character count */}
          <div className="flex items-center gap-1 rounded-full bg-black/40 px-2 py-1 text-[10px] text-white/70 backdrop-blur-md">
            <Users size={10} />
            <span>{characterCount}</span>
          </div>
          {/* Expand/collapse game panel */}
          {hasGameData && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 rounded-full bg-black/40 px-2 py-1 text-[10px] text-white/70 backdrop-blur-md transition-all hover:bg-black/60 hover:text-white"
            >
              <Shield size={10} />
              <span>Stats</span>
              {expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
            </button>
          )}
        </div>
      </div>

      {/* Expandable game state panel */}
      {expanded && hasGameData && (
        <div className="pointer-events-auto mx-3 mb-2 animate-message-in rounded-xl border border-white/10 bg-black/60 backdrop-blur-xl">
          <div className="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3">
            {/* Player Stats Column */}
            {stats.length > 0 && (
              <div className="space-y-2">
                <SectionLabel icon={<Heart size={11} />} label="Stats" />
                {stats.map((stat) => (
                  <StatBar key={stat.name} stat={stat} />
                ))}
                {/* RPG Attributes */}
                {playerStats?.attributes && (
                  <div className="grid grid-cols-3 gap-1 pt-1">
                    {Object.entries(playerStats.attributes).map(([key, val]) => (
                      <div key={key} className="text-center rounded-lg bg-white/5 px-1.5 py-1">
                        <span className="text-[9px] uppercase text-white/40 block">{key}</span>
                        <span className="text-sm font-bold text-white/80">{val as number}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Inventory Column */}
            {inventory.length > 0 && (
              <div className="space-y-1.5">
                <SectionLabel icon={<Package size={11} />} label={`Inventory (${inventory.length})`} />
                <div className="max-h-32 overflow-y-auto space-y-1 scrollbar-none">
                  {inventory.map((item, i) => (
                    <div key={i} className="game-inventory-item flex items-center gap-1.5 rounded-lg bg-white/5 px-2 py-1.5">
                      <Package size={10} className="shrink-0 text-amber-400/60" />
                      <span className="flex-1 text-[10px] text-white/80 truncate">{item.name}</span>
                      {item.quantity > 1 && (
                        <span className="text-[9px] text-white/40">×{item.quantity}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quests Column */}
            {activeQuests.length > 0 && (
              <div className="space-y-1.5">
                <SectionLabel icon={<Scroll size={11} />} label={`Quests (${activeQuests.length})`} />
                <div className="max-h-32 overflow-y-auto space-y-1.5 scrollbar-none">
                  {activeQuests.map((quest, i) => (
                    <QuestCard key={quest.questEntryId || i} quest={quest} />
                  ))}
                </div>
              </div>
            )}

            {/* Present Characters */}
            {presentCharacters.length > 0 && (
              <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
                <SectionLabel icon={<Users size={11} />} label="Present Characters" />
                <div className="flex flex-wrap gap-1.5">
                  {presentCharacters.map((char) => (
                    <CharacterPill key={char.characterId ?? char.name} character={char} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ──

function SectionLabel({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1 text-[10px] font-semibold text-white/50 uppercase tracking-wider">
      {icon}
      {label}
    </div>
  );
}

function StatBar({ stat }: { stat: CharacterStat }) {
  const pct = stat.max > 0 ? Math.min(100, Math.max(0, (stat.value / stat.max) * 100)) : 0;
  const colorName = stat.color?.toLowerCase() ?? "";

  // Map color names to CSS classes
  const barColor = colorName.includes("red") || colorName.includes("hp")
    ? "bg-gradient-to-r from-red-500 to-rose-400"
    : colorName.includes("blue") || colorName.includes("mp") || colorName.includes("mana")
      ? "bg-gradient-to-r from-blue-500 to-sky-400"
      : colorName.includes("green") || colorName.includes("stamina")
        ? "bg-gradient-to-r from-emerald-500 to-green-400"
        : colorName.includes("yellow") || colorName.includes("xp") || colorName.includes("gold")
          ? "bg-gradient-to-r from-amber-500 to-yellow-400"
          : colorName.includes("purple")
            ? "bg-gradient-to-r from-purple-500 to-violet-400"
            : "bg-gradient-to-r from-sky-500 to-cyan-400";

  return (
    <div className="game-stats-bar">
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[10px] font-medium text-white/70">{stat.name}</span>
        <span className="text-[9px] text-white/40">{stat.value}/{stat.max}</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div
          className={cn("game-stats-bar-fill h-full rounded-full transition-all duration-500", barColor)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function QuestCard({ quest }: { quest: QuestProgress }) {
  const completed = quest.objectives?.filter((o) => o.completed).length ?? 0;
  const total = quest.objectives?.length ?? 0;

  return (
    <div className="rounded-lg bg-white/5 p-2">
      <div className="flex items-center gap-1.5">
        {quest.completed ? (
          <CheckCircle2 size={11} className="text-emerald-400 shrink-0" />
        ) : (
          <Target size={11} className="text-amber-400 shrink-0" />
        )}
        <span className={cn(
          "text-[10px] font-medium flex-1 truncate",
          quest.completed ? "text-white/40 line-through" : "text-white/80"
        )}>
          {quest.name}
        </span>
        {total > 0 && (
          <span className="text-[9px] text-white/30">{completed}/{total}</span>
        )}
      </div>
      {!quest.completed && quest.objectives?.length > 0 && (
        <div className="mt-1 space-y-0.5 pl-4">
          {quest.objectives.slice(0, 3).map((obj, i) => (
            <div key={i} className="flex items-center gap-1 text-[9px]">
              {obj.completed ? (
                <CheckCircle2 size={8} className="text-emerald-400/60 shrink-0" />
              ) : (
                <Circle size={8} className="text-white/20 shrink-0" />
              )}
              <span className={cn("truncate", obj.completed ? "text-white/30 line-through" : "text-white/50")}>
                {obj.text}
              </span>
            </div>
          ))}
          {quest.objectives.length > 3 && (
            <span className="text-[8px] text-white/20 pl-3">+{quest.objectives.length - 3} more</span>
          )}
        </div>
      )}
    </div>
  );
}

function CharacterPill({ character }: { character: PresentCharacter }) {
  return (
    <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 backdrop-blur-sm">
      <span className="text-xs">{character.emoji || "👤"}</span>
      <span className="text-[10px] font-medium text-white/80">{character.name}</span>
      {character.mood && (
        <span className="text-[9px] text-white/40 italic">{character.mood}</span>
      )}
      {/* Character stat bars (mini) */}
      {character.stats?.length > 0 && (
        <div className="flex gap-0.5">
          {character.stats.slice(0, 2).map((s) => {
            const pct = s.max > 0 ? (s.value / s.max) * 100 : 0;
            return (
              <div key={s.name} className="h-1 w-8 rounded-full bg-white/10 overflow-hidden" title={`${s.name}: ${s.value}/${s.max}`}>
                <div
                  className="h-full rounded-full bg-gradient-to-r from-rose-400 to-pink-400"
                  style={{ width: `${pct}%` }}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function HUDPill({
  icon,
  label,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  color: "emerald" | "amber" | "sky" | "purple";
}) {
  const colorMap = {
    emerald: "from-emerald-500/20 to-emerald-600/10 text-emerald-300 border-emerald-500/20",
    amber: "from-amber-500/20 to-amber-600/10 text-amber-300 border-amber-500/20",
    sky: "from-sky-500/20 to-sky-600/10 text-sky-300 border-sky-500/20",
    purple: "from-purple-500/20 to-purple-600/10 text-purple-300 border-purple-500/20",
  };

  return (
    <div
      className={`flex items-center gap-1 rounded-full border bg-gradient-to-r px-2.5 py-1 text-[10px] font-medium backdrop-blur-md ${colorMap[color]}`}
    >
      {icon}
      <span className="max-w-[100px] truncate">{label}</span>
    </div>
  );
}
