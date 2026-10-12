export type EditorAction =
  | "undo"
  | "redo"
  | "export"
  | "duplicate"
  | "copy"
  | "paste"
  | "selectAll"
  | "delete"
  | "clear"
  | "select"
  | "pan"
  | "connect"
  | "fit"
  | "fitSelection"
  | "help"
  | "nudge"
  | "commands";

const modifiedActions: Partial<Record<string, EditorAction>> = {
  y: "redo",
  s: "export",
  d: "duplicate",
  c: "copy",
  v: "paste",
  a: "selectAll",
  k: "commands",
};
const plainActions: Partial<Record<string, EditorAction>> = {
  delete: "delete",
  backspace: "delete",
  escape: "clear",
  v: "select",
  h: "pan",
  c: "connect",
};

export function editorAction(
  event: Pick<
    KeyboardEvent,
    "key" | "ctrlKey" | "metaKey" | "shiftKey" | "altKey"
  >,
): EditorAction | undefined {
  if (event.altKey) return;
  const key = event.key.toLowerCase();
  if (event.ctrlKey || event.metaKey) {
    if (key === "z") return event.shiftKey ? "redo" : "undo";
    if (event.shiftKey) return;
    return modifiedActions[key];
  }
  if (["arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key))
    return "nudge";
  if (key === "f") return event.shiftKey ? "fitSelection" : "fit";
  if (key === "?") return "help";
  if (event.shiftKey) return;
  return plainActions[key];
}
