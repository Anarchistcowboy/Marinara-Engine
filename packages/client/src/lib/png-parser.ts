// ──────────────────────────────────────────────
// Utility: Parse SillyTavern PNG character cards
// Extracts JSON from the tEXt chunk with key "chara"
// ──────────────────────────────────────────────

/**
 * Reads a PNG file's tEXt chunks and extracts the "chara" field,
 * which SillyTavern uses to embed base64-encoded character JSON.
 * Returns the parsed JSON object and the raw PNG as a base64 data URL.
 */
export async function parsePngCharacterCard(
  file: File,
): Promise<{ json: Record<string, unknown>; imageDataUrl: string }> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);

  // Verify PNG signature
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < 8; i++) {
    if (bytes[i] !== signature[i]) {
      throw new Error("Not a valid PNG file");
    }
  }

  // Walk chunks looking for tEXt with keyword "chara"
  let offset = 8; // skip signature
  while (offset < bytes.length) {
    // Read chunk length (4 bytes, big-endian)
    const length =
      (bytes[offset] << 24) |
      (bytes[offset + 1] << 16) |
      (bytes[offset + 2] << 8) |
      bytes[offset + 3];
    offset += 4;

    // Read chunk type (4 bytes)
    const type = String.fromCharCode(
      bytes[offset],
      bytes[offset + 1],
      bytes[offset + 2],
      bytes[offset + 3],
    );
    offset += 4;

    if (type === "tEXt") {
      // tEXt chunk: keyword\0text
      const chunkData = bytes.slice(offset, offset + length);

      // Find null separator between keyword and text
      let nullIndex = -1;
      for (let i = 0; i < chunkData.length; i++) {
        if (chunkData[i] === 0) {
          nullIndex = i;
          break;
        }
      }

      if (nullIndex > 0) {
        const keyword = new TextDecoder().decode(chunkData.slice(0, nullIndex));

        if (keyword === "chara") {
          const textData = new TextDecoder().decode(chunkData.slice(nullIndex + 1));
          // Decode base64 → JSON string
          const jsonStr = atob(textData);
          const json = JSON.parse(jsonStr) as Record<string, unknown>;

          // Also create a data URL for the image
          const imageDataUrl = await fileToDataUrl(file);

          return { json, imageDataUrl };
        }
      }
    }

    // Skip chunk data + 4-byte CRC
    offset += length + 4;

    // Safety: stop at IEND
    if (type === "IEND") break;
  }

  throw new Error("No character data found in PNG — this doesn't appear to be a SillyTavern character card");
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
