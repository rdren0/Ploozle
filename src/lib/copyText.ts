/**
 * Puts text on the clipboard, reporting whether it got there.
 *
 * This panel lives in Owlbear's iframe, and the clipboard API is only available
 * there if the embedding page delegates it, which an extension has no say in.
 * The older route of copying a selection needs no such permission, so it stands
 * in when the API is missing or refuses.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return copySelection(text);
  }
}

function copySelection(text: string): boolean {
  const previousFocus = document.activeElement as HTMLElement | null;
  const field = document.createElement("textarea");
  field.value = text;
  field.readOnly = true;
  field.style.position = "fixed";
  field.style.opacity = "0";
  document.body.appendChild(field);
  field.select();
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    field.remove();
    previousFocus?.focus?.();
  }
}
