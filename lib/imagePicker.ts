// The same "read a <input type=file> image as a data URL" FileReader
// dance was copy-pasted into HomeAgent's image attach and the chat page's
// story upload — pulled out once. Resolves with null for a non-image pick
// (including the user cancelling the file dialog) rather than rejecting,
// since callers treat both the same way (just do nothing).
export function readImageFile(e: React.ChangeEvent<HTMLInputElement>): Promise<{ dataUrl: string; mimeType: string } | null> {
  const file = e.target.files?.[0];
  e.target.value = "";
  if (!file || !file.type.startsWith("image/")) return Promise.resolve(null);
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(typeof reader.result === "string" ? { dataUrl: reader.result, mimeType: file.type } : null);
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}
