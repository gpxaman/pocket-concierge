/** Splits a growing text buffer into complete sentences (kept) + an incomplete tail (returned as rest). */
export function cutSentences(buffer: string): { sentences: string[]; rest: string } {
  const parts = buffer.split(/(?<=[.!?\n])\s*/);
  if (parts.length <= 1) return { sentences: [], rest: buffer };
  const rest = parts.pop() ?? "";
  return { sentences: parts.map((p) => p.trim()).filter(Boolean), rest };
}
