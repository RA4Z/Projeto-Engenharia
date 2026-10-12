"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { searchCommands, type Command } from "@/lib/command-search";

export default function CommandPalette({
  commands,
  onClose,
}: {
  commands: Command[];
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const matches = useMemo(
    () => searchCommands(commands, query),
    [commands, query],
  );
  const visible = matches.slice(0, 60);
  const available = visible.filter((command) => !command.disabled);
  const highlighted =
    available[Math.min(active, Math.max(0, available.length - 1))];
  useEffect(() => {
    input.current?.focus();
  }, []);
  useEffect(() => {
    if (highlighted)
      document
        .getElementById(`command-${highlighted.id}`)
        ?.scrollIntoView?.({ block: "nearest" });
  }, [highlighted?.id]);
  const choose = (command: Command) => {
    if (!command.disabled) {
      onClose();
      command.run();
    }
  };
  return (
    <div
      className="modal-backdrop command-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="command-palette"
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="command-title"
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            onClose();
          }
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            input.current?.focus();
            setActive((index) =>
              available.length
                ? (index +
                    (e.key === "ArrowDown" ? 1 : -1) +
                    available.length) %
                  available.length
                : 0,
            );
          }
          if (e.key === "Enter" && e.target === input.current && highlighted) {
            e.preventDefault();
            choose(highlighted);
          }
          if (e.key === "Tab") {
            const items = Array.from(
              ref.current!.querySelectorAll<HTMLElement>(
                "input,button:not(:disabled)",
              ),
            );
            const index = items.indexOf(document.activeElement as HTMLElement);
            if (e.shiftKey && index <= 0) {
              e.preventDefault();
              items.at(-1)?.focus();
            } else if (!e.shiftKey && index === items.length - 1) {
              e.preventDefault();
              items[0]?.focus();
            }
          }
        }}
      >
        <div className="command-header">
          <h2 id="command-title">Busca rápida</h2>
          <button aria-label="Fechar busca rápida" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="command-input">
          <Search size={18} />
          <input
            ref={input}
            aria-label="Buscar ações, equipamentos e cabos"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded="true"
            aria-controls="command-results"
            aria-activedescendant={
              highlighted ? `command-${highlighted.id}` : undefined
            }
            placeholder="Buscar ações, equipamentos e cabos…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
          />
        </div>
        <div
          id="command-results"
          className="command-results"
          role="listbox"
          aria-label="Resultados da busca"
        >
          {visible.map((command) => (
            <button
              id={`command-${command.id}`}
              key={command.id}
              role="option"
              aria-selected={command.id === highlighted?.id}
              disabled={command.disabled}
              className={command.id === highlighted?.id ? "active" : ""}
              onClick={() => choose(command)}
            >
              <strong>{command.label}</strong>
              <small>{command.detail}</small>
            </button>
          ))}
          {!visible.length && (
            <p role="status">
              Nenhum resultado. Tente o nome ou o tipo do equipamento.
            </p>
          )}
        </div>
        <div className="command-footer">
          ↑↓ navegar · Enter executar · Esc fechar{" "}
          <span>
            {matches.length} resultados
            {matches.length > 60 ? " · refine a busca para ver mais" : ""}
          </span>
        </div>
      </div>
    </div>
  );
}
