"use client";
import { memo, useMemo, useState } from "react";
import { Search, Plus, ArrowDownToLine, Pencil } from "lucide-react";
import type { Project } from "@/lib/project";
import { equipmentSize } from "@/lib/geometry";
import { catalog } from "@/lib/catalog";
import { normalizeSearch } from "@/lib/command-search";
import OverlayDialog from "./overlay-dialog";
import { cablePath } from "@/lib/cable-path";
import { canvasGeometry } from "@/lib/canvas-geometry";

const ProjectThumbnail = memo(function ProjectThumbnail({
  project,
}: {
  project: Project;
}) {
  const drawing = useMemo(() => {
    const nodes = new Map(project.nodes.map((n) => [n.id, n]));
    const boxes = project.nodes.map((n) => ({
      id: n.id,
      type: n.type,
      x: n.position.x + (n.parentId ? nodes.get(n.parentId)!.position.x : 0),
      y: n.position.y + (n.parentId ? nodes.get(n.parentId)!.position.y : 0),
      ...equipmentSize(n.type),
    }));
    const indexed = new Map(boxes.map((b) => [b.id, b]));
    const waypoints = project.edges.flatMap((e) => e.layout?.waypoints ?? []);
    const minX = Math.min(
        0,
        ...boxes.map((b) => b.x),
        ...waypoints.map((p) => p.x),
      ),
      minY = Math.min(
        0,
        ...boxes.map((b) => b.y),
        ...waypoints.map((p) => p.y),
      );
    const maxX = Math.max(
        300,
        ...boxes.map((b) => b.x + b.width),
        ...waypoints.map((p) => p.x),
      ),
      maxY = Math.max(
        200,
        ...boxes.map((b) => b.y + b.height),
        ...waypoints.map((p) => p.y),
      );
    return {
      boxes: boxes.filter(
        (_, i) => i % Math.max(1, Math.ceil(boxes.length / 160)) === 0,
      ),
      indexed,
      viewBox: `${minX - 30} ${minY - 30} ${maxX - minX + 60} ${maxY - minY + 60}`,
    };
  }, [project.nodes, project.edges]);
  return (
    <svg
      viewBox={drawing.viewBox}
      role="img"
      aria-label={`Miniatura de ${project.name}`}
    >
      {project.edges
        .filter(
          (_, i) =>
            i % Math.max(1, Math.ceil(project.edges.length / 200)) === 0,
        )
        .map((e) => {
          const a = drawing.indexed.get(e.from),
            b = drawing.indexed.get(e.to);
          const source =
            a &&
            canvasGeometry(a.type).handles.find(
              (h) =>
                h.id ===
                (e.sourceHandle ?? (a.type === "BUSBAR" ? "out-1" : "out")),
            );
          const target =
            b && canvasGeometry(b.type).handles.find((h) => h.id === "in");
          return a && b && source && target ? (
            <path
              key={e.id}
              d={
                cablePath(
                  { x: a.x + source.x + 3.5, y: a.y + source.y + 3.5 },
                  { x: b.x + target.x + 3.5, y: b.y + target.y + 3.5 },
                  e.layout,
                ).path
              }
              stroke="#577869"
              strokeWidth="4"
              fill="none"
            />
          ) : null;
        })}
      {drawing.boxes.map((b) => (
        <rect
          key={b.id}
          x={b.x}
          y={b.y}
          width={b.width}
          height={b.height}
          rx="9"
          fill={b.type === "PANEL" ? "#ebf3e9" : "white"}
          fillOpacity={b.type === "PANEL" ? 0.25 : 1}
          stroke={catalog[b.type].color}
          strokeWidth="4"
        />
      ))}
      {!project.nodes.length && (
        <text x="150" y="110" textAnchor="middle" fill="#567360" fontSize="20">
          Projeto vazio
        </text>
      )}
    </svg>
  );
});
export default function ProjectsOverview({
  projects,
  activeId,
  onClose,
  onOpen,
  onNew,
  onRename,
  onExport,
}: {
  projects: Project[];
  activeId: string;
  onClose: () => void;
  onOpen: (id: string) => void;
  onNew: () => void;
  onRename: (id: string) => void;
  onExport: (project: Project) => void;
}) {
  const [query, setQuery] = useState(""),
    [sort, setSort] = useState("recent");
  const filtered = useMemo(
    () =>
      projects
        .filter((p) =>
          normalizeSearch(p.name).includes(normalizeSearch(query).trim()),
        )
        .sort((a, b) =>
          sort === "name"
            ? a.name.localeCompare(b.name, "pt-BR")
            : b.updatedAt.localeCompare(a.updatedAt),
        ),
    [projects, query, sort],
  );
  return (
    <OverlayDialog
      title="Seus projetos"
      onClose={onClose}
      className="projects-dialog"
    >
      <div className="projects-controls">
        <label className="projects-search">
          <Search size={17} />
          <input
            data-autofocus
            aria-label="Buscar projetos"
            placeholder="Buscar projeto…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <select
          aria-label="Ordenar projetos"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="recent">Mais recentes</option>
          <option value="name">Nome A–Z</option>
        </select>
        <button className="primary-button" onClick={onNew}>
          <Plus size={16} />
          Novo projeto
        </button>
      </div>
      <p className="dialog-description">
        {projects.length}{" "}
        {projects.length === 1 ? "projeto salvo" : "projetos salvos"} neste
        navegador. Exporte JSON para guardar uma cópia.
      </p>
      <div className="project-cards" role="list" aria-label="Projetos locais">
        {filtered.map((p) => (
          <article
            key={p.projectId}
            role="listitem"
            className={`project-card ${p.projectId === activeId ? "active" : ""}`}
          >
            <button
              className="project-open"
              aria-label={`Abrir projeto ${p.name}`}
              onClick={() => onOpen(p.projectId)}
            >
              <ProjectThumbnail project={p} />
              <strong>{p.name}</strong>
            </button>
            <div className="project-card-meta">
              <span>
                {p.nodes.length} equipamentos · {p.edges.length} cabos
              </span>
              <time dateTime={p.updatedAt}>
                Atualizado em{" "}
                {new Date(p.updatedAt).toLocaleString("pt-BR", {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </time>
            </div>
            <div className="project-card-actions">
              <span>{p.projectId === activeId ? "Projeto aberto" : ""}</span>
              <button
                aria-label={`Renomear ${p.name}`}
                onClick={() => onRename(p.projectId)}
                title="Renomear"
              >
                <Pencil size={16} />
              </button>
              <button
                aria-label={`Exportar JSON de ${p.name}`}
                onClick={() => onExport(p)}
                title="Exportar JSON"
              >
                <ArrowDownToLine size={16} />
              </button>
            </div>
          </article>
        ))}
        {!filtered.length && (
          <p className="projects-empty" role="status">
            Nenhum projeto encontrado. Tente outro nome.
          </p>
        )}
      </div>
    </OverlayDialog>
  );
}
