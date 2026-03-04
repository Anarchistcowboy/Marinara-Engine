// ──────────────────────────────────────────────
// Sprite Overlay — VN-style character sprites in chat
// Shows character sprites on the left/right of the roleplay view.
// Expression is determined by the last assistant message's detected emotion
// or can be manually set via the Expression Engine agent.
// ──────────────────────────────────────────────
import { useState, useEffect, useMemo } from "react";
import { useCharacterSprites, type SpriteInfo } from "../../hooks/use-characters";
import { cn } from "../../lib/utils";

interface SpriteOverlayProps {
  /** IDs of characters in this chat */
  characterIds: string[];
  /** The last N messages to detect expressions from */
  messages: Array<{ role: string; characterId?: string | null; content: string }>;
}

/** Simple keyword-based expression detection from message text. */
function detectExpression(text: string): string {
  const lower = text.toLowerCase();
  const patterns: [string, RegExp][] = [
    ["angry", /\b(anger|angry|furious|rage|yells?|shouts?|snarls?|growls?|seeth)/i],
    ["sad", /\b(sad|sorrow|cry|cries|crying|tears|weep|sob|mourn|grief|melanchol)/i],
    ["happy", /\b(happy|joy|laugh|smile|smiles|grin|grins|cheer|delight|beam|beaming|giggl)/i],
    ["surprised", /\b(surpris|shock|astonish|gasp|gasps|wide.?eye|startle|stun)/i],
    ["scared", /\b(scare|fear|afraid|terrif|frighten|tremble|trembling|shiver|panic)/i],
    ["embarrassed", /\b(embarrass|blush|blushes|flustered|sheepish|shy|avert)/i],
    ["love", /\b(love|adore|affection|heart|kiss|embrace|cherish)/i],
    ["thinking", /\b(think|ponder|consider|contemplat|muse|hmm|wonder)/i],
    ["laughing", /\b(laugh|laughing|laughter|haha|LOL|chuckle|cackle|snicker|giggle)/i],
    ["worried", /\b(worr|anxious|nervous|uneasy|fret|concern|dread)/i],
    ["disgusted", /\b(disgust|repuls|revolt|gross|nausea|sicken)/i],
    ["smirk", /\b(smirk|sly|mischiev|devious|wink|tease|teasing)/i],
    ["crying", /\b(crying|cried|weeping|tears stream|sobbing)/i],
    ["determined", /\b(determin|resolv|steadfast|unwaver|resolute|clench)/i],
    ["hurt", /\b(hurt|pain|wound|wince|grimace|ache|suffer)/i],
  ];

  for (const [expression, regex] of patterns) {
    if (regex.test(lower)) return expression;
  }
  return "neutral";
}

/** Position mapping for multiple characters */
const POSITIONS: Record<number, string[]> = {
  1: ["center"],
  2: ["left", "right"],
  3: ["left", "center", "right"],
};

export function SpriteOverlay({ characterIds, messages }: SpriteOverlayProps) {
  // Track current expression per character
  const [expressions, setExpressions] = useState<Record<string, string>>({});

  // Detect expressions from most recent messages (for each character)
  useEffect(() => {
    if (!messages?.length) return;
    const newExpressions: Record<string, string> = {};

    // Look at last few assistant messages to detect expressions
    const recentAssistant = messages
      .filter((m) => m.role === "assistant")
      .slice(-5);

    for (const msg of recentAssistant) {
      if (msg.characterId) {
        newExpressions[msg.characterId] = detectExpression(msg.content);
      }
    }

    // For characters without recent messages, check if we have character ids
    for (const id of characterIds) {
      if (!newExpressions[id]) {
        // Find the latest message from this character
        const lastMsg = [...messages].reverse().find(
          (m) => m.characterId === id && m.role === "assistant"
        );
        if (lastMsg) {
          newExpressions[id] = detectExpression(lastMsg.content);
        } else {
          newExpressions[id] = "neutral";
        }
      }
    }

    setExpressions(newExpressions);
  }, [messages, characterIds]);

  if (characterIds.length === 0) return null;

  // Only show first 3 characters max
  const visibleChars = characterIds.slice(0, 3);
  const positions = POSITIONS[Math.min(visibleChars.length, 3)] ?? POSITIONS[3]!;

  return (
    <div className="rpg-sprite-container pointer-events-none absolute inset-0 z-10 overflow-hidden">
      {visibleChars.map((charId, i) => (
        <CharacterSprite
          key={charId}
          characterId={charId}
          expression={expressions[charId] ?? "neutral"}
          position={positions[i] ?? "center"}
        />
      ))}
    </div>
  );
}

function CharacterSprite({
  characterId,
  expression,
  position,
}: {
  characterId: string;
  expression: string;
  position: string;
}) {
  const { data: sprites } = useCharacterSprites(characterId);
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  // Find the best matching sprite for the current expression
  const spriteUrl = useMemo(() => {
    if (!sprites || !(sprites as SpriteInfo[]).length) return null;
    const spriteList = sprites as SpriteInfo[];

    // Exact match
    const exact = spriteList.find((s) => s.expression === expression);
    if (exact) return exact.url;

    // Fall back to neutral
    const neutral = spriteList.find((s) => s.expression === "neutral" || s.expression === "default");
    if (neutral) return neutral.url;

    // Just use the first available
    return spriteList[0]?.url ?? null;
  }, [sprites, expression]);

  // Animate in/out when sprite changes
  useEffect(() => {
    if (spriteUrl) {
      setCurrentUrl(spriteUrl);
      // Small delay before showing for smooth transition
      requestAnimationFrame(() => setIsVisible(true));
    } else {
      setIsVisible(false);
    }
  }, [spriteUrl]);

  if (!currentUrl) return null;

  return (
    <div
      className={cn(
        "rpg-sprite-character absolute bottom-0 transition-all duration-500 ease-out",
        position === "left" && "rpg-sprite-left",
        position === "right" && "rpg-sprite-right",
        position === "center" && "rpg-sprite-center",
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4",
      )}
    >
      <img
        src={currentUrl}
        alt={`${expression} sprite`}
        className="max-h-[60vh] w-auto object-contain drop-shadow-[0_0_20px_rgba(0,0,0,0.5)]"
        draggable={false}
      />
    </div>
  );
}
