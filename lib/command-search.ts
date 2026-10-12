export type Command = {
  id: string;
  label: string;
  detail: string;
  keywords?: string;
  disabled?: boolean;
  run: () => void;
};
export function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}
export function searchCommands(commands: Command[], query: string): Command[] {
  const words = normalizeSearch(query).trim().split(/\s+/).filter(Boolean);
  const matches = commands.filter((command) => {
    const text = normalizeSearch(
      `${command.label} ${command.detail} ${command.keywords ?? ""}`,
    );
    return words.every((word) => text.includes(word));
  });
  if (!words.length) return matches;
  const phrase = words.join(" ");
  const rank = (command: Command) => {
    const label = normalizeSearch(command.label);
    return label === phrase
      ? 0
      : label.startsWith(phrase)
        ? 1
        : label.includes(phrase)
          ? 2
          : 3;
  };
  return matches.sort((a, b) => rank(a) - rank(b));
}
