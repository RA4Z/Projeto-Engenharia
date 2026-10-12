"use client";

import { useState } from "react";
import { BookOpen, ChevronRight, Play } from "lucide-react";
import { firstCircuitSteps } from "@/lib/onboarding";

const shortcuts = [
  ["V", "Selecionar"],
  ["H", "Navegar"],
  ["C", "Conectar"],
  ["F", "Enquadrar"],
  ["Shift + F", "Enquadrar seleção"],
  ["Ctrl + Z", "Desfazer"],
  ["Ctrl + Shift + Z", "Refazer"],
  ["Ctrl + D", "Duplicar"],
  ["Ctrl + C / V", "Copiar / colar equipamentos"],
  ["Ctrl + A", "Selecionar tudo"],
  ["Setas / Shift + setas", "Mover 1 / 10 px"],
  ["Esc", "Limpar seleção"],
  ["Delete", "Excluir"],
  ["Ctrl + S", "Exportar JSON"],
  ["Shift + arraste", "Selecionar área"],
];

export default function LearningCenter({
  onTour,
  onClose,
}: {
  onTour: () => void;
  onClose: () => void;
}) {
  const [page, setPage] = useState<"tutorial" | "shortcuts">("tutorial");
  return (
    <>
      <div className="modal-icon">
        <BookOpen size={25} />
      </div>
      <span className="section-eyebrow">APRENDA NO SEU RITMO</span>
      <h2 id="modal-title">Do primeiro símbolo ao circuito.</h2>
      <p>
        Faça um passeio pelo editor ou siga o tutorial para criar seu primeiro
        projeto.
      </p>
      <button
        className="primary-button full-width learning-tour"
        onClick={onTour}
      >
        <Play size={16} /> Iniciar tour guiado <span>10 passos</span>
      </button>
      <div
        className="learning-tabs"
        role="group"
        aria-label="Conteúdo da ajuda"
      >
        <button
          aria-pressed={page === "tutorial"}
          onClick={() => setPage("tutorial")}
        >
          Primeiro circuito
        </button>
        <button
          aria-pressed={page === "shortcuts"}
          onClick={() => setPage("shortcuts")}
        >
          Atalhos e dicas
        </button>
      </div>
      {page === "tutorial" ? (
        <ol
          className="circuit-tutorial"
          aria-label="Tutorial do primeiro circuito"
        >
          {firstCircuitSteps.map(([title, description], index) => (
            <li key={title}>
              <b>{String(index + 1).padStart(2, "0")}</b>
              <div>
                <h3>{title}</h3>
                <p>{description}</p>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <>
          <div className="shortcuts">
            {shortcuts.map(([key, name]) => (
              <div key={key}>
                <span>{name}</span>
                <kbd>{key}</kbd>
              </div>
            ))}
          </div>
          <p className="help-note">
            Use o botão do meio do mouse para mover a área e a roda para ajustar
            o zoom. No Mac, use ⌘ no lugar de Ctrl. Ao editar campos, os atalhos
            de texto funcionam normalmente.
          </p>
        </>
      )}
      <p className="help-note">
        Os projetos ficam neste navegador; guarde backups em JSON. Modelo
        radial, sem circuitos fechados ou dupla alimentação. Consulte as
        premissas dos cálculos preliminares em Análise.
      </p>
      <button className="secondary-button full-width" onClick={onClose}>
        Voltar ao editor <ChevronRight size={16} />
      </button>
    </>
  );
}
