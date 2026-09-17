// Client only renders **bold** literally (see the system prompt's "no
// markdown" instruction) plus normalizing a stray leading "* " into a
// bullet glyph for models that ignore that instruction anyway.
export function renderInline(text: string) {
  const normalized = text.replace(/^\s*\*(?!\*)\s+/gm, "• ");
  const parts = normalized.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i} className="font-semibold">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}
