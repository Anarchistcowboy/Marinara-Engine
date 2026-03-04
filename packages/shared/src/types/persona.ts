// ──────────────────────────────────────────────
// User Persona Types
// ──────────────────────────────────────────────

/** A user persona (the player's character/identity). */
export interface Persona {
  id: string;
  name: string;
  description: string;
  personality: string;
  scenario: string;
  backstory: string;
  appearance: string;
  /** Avatar image path */
  avatarPath: string | null;
  /** Whether this is the currently active persona */
  isActive: boolean;
  /** Name display color/gradient (CSS value) */
  nameColor: string;
  /** Dialogue highlight color — quoted text bold + colored */
  dialogueColor: string;
  /** Chat bubble / dialogue box background color */
  boxColor: string;
  createdAt: string;
  updatedAt: string;
}
