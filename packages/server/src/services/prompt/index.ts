// ──────────────────────────────────────────────
// Prompt Service — Public exports
// ──────────────────────────────────────────────
export { assemblePrompt, type AssemblerInput, type AssemblerOutput } from "./assembler.js";
export { wrapContent, wrapGroup } from "./format-engine.js";
export { expandMarker, type MarkerContext, type ExpandedMarker } from "./marker-expander.js";
export { mergeAdjacentMessages, squashLeadingSystemMessages } from "./merger.js";
