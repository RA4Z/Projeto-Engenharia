"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
} from "react";
import {
  ReactFlowProvider,
  type Connection,
  type Edge,
  type ReactFlowInstance,
  type Viewport,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BookOpen,
  Cable as CableIcon,
  Check,
  CheckCircle2,
  Copy,
  ClipboardPaste,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Folder,
  FolderOpen,
  Grid2X2,
  Hand,
  Layers3,
  LayoutPanelLeft,
  Maximize,
  MousePointer2,
  Pencil,
  Plus,
  Redo2,
  Search,
  Trash2,
  Undo2,
  X,
  Zap,
  Minus,
  PanelLeftClose,
  PanelRightClose,
} from "lucide-react";
import {
  cableDefaults,
  catalog,
  equipmentTypes,
  type EquipmentType,
  type Properties,
} from "@/lib/catalog";
import { analyze, number } from "@/lib/calculations";
import {
  connectionError,
  createEquipment,
  createProject,
  deleteItems,
  parseProject,
  serializeProject,
  STORAGE_KEY,
  uid,
  type Project,
} from "@/lib/project";
import type { EquipmentFlowNode } from "@/lib/canvas-state";
import {
  clampEquipmentPosition,
  sameViewport,
  nextEquipmentLabel,
} from "@/lib/geometry";
import DiagramCanvas from "./diagram-canvas";
import { restoreWorkspace } from "@/lib/workspace-storage";
import {
  captureSelection,
  insertFragment,
  nudgeSelection,
  type SelectionFragment,
} from "@/lib/editing";
import { editorAction } from "@/lib/shortcuts";
import Inspector from "./inspector";
import Symbol from "./symbol";

type Modal =
  | { type: "create" | "rename"; name: string }
  | { type: "delete"; projectId: string; name: string }
  | { type: "help" }
  | null;
type History = { past: Project[]; future: Project[] };

function WorkspaceInner() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeId, setActiveId] = useState("");
  const [ready, setReady] = useState(false);
  const [canSave, setCanSave] = useState(true);
  const [saved, setSaved] = useState<"saving" | "saved" | "error">("saved");
  const [selection, setSelection] = useState<string[]>([]);
  const selectionIds = useMemo(() => new Set(selection), [selection]);
  const [history, setHistory] = useState<History>({ past: [], future: [] });
  const [mode, setMode] = useState<"select" | "pan" | "connect">("select");
  const [snap, setSnap] = useState(true);
  const [showMap, setShowMap] = useState(false);
  const [leftOpen, setLeftOpen] = useState(true),
    [rightOpen, setRightOpen] = useState(true);
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [tab, setTab] = useState<"properties" | "analysis">("properties");
  const [modal, setModal] = useState<Modal>(null);
  const [toast, setToast] = useState<{
    message: string;
    error?: boolean;
  } | null>(null);
  const [flow, setFlow] = useState<ReactFlowInstance<
    EquipmentFlowNode,
    Edge
  > | null>(null);
  const [zoom, setZoom] = useState(1);
  const [newDemo, setNewDemo] = useState(false);
  const [clipboard, setClipboard] = useState<SelectionFragment | null>(null);
  const pasteCount = useRef(0);
  const importBusy = useRef(false);
  const latestProjects = useRef(projects);
  useEffect(() => {
    latestProjects.current = projects;
  }, [projects]);
  const inputRef = useRef<HTMLInputElement>(null),
    canvasRef = useRef<HTMLDivElement>(null);
  const project = projects.find((p) => p.projectId === activeId);
  const analysis = useMemo(
    () => (project ? analyze(project) : null),
    [project?.nodes, project?.edges],
  );
  const notify = useCallback(
    (message: string, error = false) => setToast({ message, error }),
    [],
  );
  useEffect(() => {
    setLeftOpen(window.innerWidth >= 800);
    setRightOpen(window.innerWidth >= 570);
    let restored: ReturnType<typeof restoreWorkspace>;
    try {
      restored = restoreWorkspace(localStorage);
    } catch {
      const demo = createProject("Instalação industrial", true);
      restored = {
        projects: [demo],
        activeId: demo.projectId,
        canSave: false,
        recovered: true,
      };
    }
    setProjects(restored.projects);
    setActiveId(restored.activeId);
    setCanSave(restored.canSave);
    if (restored.recovered)
      notify(
        restored.canSave
          ? "Os projetos válidos foram recuperados. Uma cópia dos dados anteriores foi preservada para recuperação."
          : "Não foi possível guardar a cópia de recuperação. Os dados anteriores foram mantidos; exporte seus projetos em JSON.",
        true,
      );
    setReady(true);
  }, [notify]);
  useEffect(() => {
    if (!ready || !projects.length) return;
    if (!canSave) {
      setSaved("error");
      return;
    }
    setSaved("saving");
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ projects, activeId }),
        );
        setSaved("saved");
      } catch {
        setSaved("error");
        notify(
          "O navegador não conseguiu salvar. Exporte seus projetos em JSON para preservá-los.",
          true,
        );
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [projects, activeId, ready, notify, canSave]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 7000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (!project || !flow) return;
    const timer = setTimeout(() => {
      const v = project.viewport;
      if (!project.nodes.length) {
        void flow.setViewport(v);
      } else if (v.x === 0 && v.y === 0) {
        void flow.fitView({ padding: 0.15, maxZoom: 0.8, duration: 0 });
      } else void flow.setViewport(v);
    }, 90);
    return () => clearTimeout(timer);
  }, [project?.projectId, flow]);
  useEffect(() => {
    const handler = () => {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ projects, activeId }),
        );
      } catch {}
    };
    if (ready && canSave) window.addEventListener("pagehide", handler);
    return () => window.removeEventListener("pagehide", handler);
  }, [ready, projects, activeId, canSave]);

  const remember = useCallback(
    (snapshot: Project) =>
      setHistory((h) => ({
        past: [...h.past, snapshot].slice(-60),
        future: [],
      })),
    [],
  );
  const commit = useCallback(
    (next: Project, record = true) => {
      if (!project || next === project || next.projectId !== project.projectId)
        return;
      if (record) remember(project);
      setProjects((prev) =>
        prev.map((p) =>
          p.projectId === next.projectId
            ? { ...next, updatedAt: new Date().toISOString() }
            : p,
        ),
      );
    },
    [project, remember],
  );
  const saveViewport = useCallback((projectId: string, viewport: Viewport) => {
    setProjects((previous) => {
      let changed = false;
      const next = previous.map((item) => {
        if (
          item.projectId !== projectId ||
          sameViewport(item.viewport, viewport)
        )
          return item;
        changed = true;
        return { ...item, viewport };
      });
      return changed ? next : previous;
    });
  }, []);
  const showProperties = useCallback(() => setTab("properties"), []);
  const selectProject = (id: string) => {
    if (id === activeId) return;
    setActiveId(id);
    setSelection([]);
    setHistory({ past: [], future: [] });
    setQuery("");
  };
  const undo = useCallback(() => {
    if (!project || !history.past.length) return;
    const previous = history.past[history.past.length - 1];
    setHistory({
      past: history.past.slice(0, -1),
      future: [project, ...history.future],
    });
    setProjects((prev) =>
      prev.map((p) => (p.projectId === activeId ? previous : p)),
    );
    setSelection([]);
  }, [project, history, activeId]);
  const redo = useCallback(() => {
    if (!project || !history.future.length) return;
    const next = history.future[0];
    setHistory({
      past: [...history.past, project],
      future: history.future.slice(1),
    });
    setProjects((prev) =>
      prev.map((p) => (p.projectId === activeId ? next : p)),
    );
    setSelection([]);
  }, [project, history, activeId]);
  const removeSelection = useCallback(() => {
    if (!project || !selection.length) return;
    commit(deleteItems(project, selection));
    setSelection([]);
  }, [project, selection, commit]);
  const exportProject = useCallback(() => {
    if (!project) return;
    try {
      const blob = new Blob([serializeProject(project)], {
        type: "application/json;charset=utf-8",
      });
      const url = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = url;
      a.download = `${project.name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9-]/g, "-")
        .toLowerCase()}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      notify("Projeto exportado em JSON.");
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Não foi possível exportar.",
        true,
      );
    }
  }, [project, notify]);
  const duplicate = useCallback(() => {
    if (!project) return;
    try {
      const next = insertFragment(
        project,
        captureSelection(project, selection),
        { duplicate: true },
      );
      if (next.project === project) return;
      commit(next.project);
      setSelection(next.selection);
      setMode("select");
      notify(
        `${next.selection.length} ${next.selection.length === 1 ? "equipamento duplicado" : "equipamentos duplicados"}.`,
      );
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Não foi possível duplicar.",
        true,
      );
    }
  }, [project, selection, commit, notify]);
  const copySelection = useCallback(() => {
    if (!project) return;
    const fragment = captureSelection(project, selection);
    if (!fragment.nodes.length) {
      notify(
        "Selecione equipamentos para copiar. As conexões internas são incluídas.",
      );
      return;
    }
    setClipboard(fragment);
    pasteCount.current = 0;
    notify(
      `${fragment.nodes.length} ${fragment.nodes.length === 1 ? "equipamento copiado" : "equipamentos copiados"}. Cole neste ou em outro projeto.`,
    );
  }, [project, selection, notify]);
  const pasteSelection = useCallback(() => {
    if (!project || !clipboard || !flow || !canvasRef.current) return;
    try {
      const box = canvasRef.current.getBoundingClientRect();
      const center = flow.screenToFlowPosition({
        x: box.x + box.width / 2,
        y: box.y + box.height / 2,
      });
      const offset = pasteCount.current * 40;
      const next = insertFragment(project, clipboard, {
        center: { x: center.x + offset, y: center.y + offset },
      });
      commit(next.project);
      setSelection(next.selection);
      setMode("select");
      pasteCount.current++;
      notify(
        `${next.selection.length} ${next.selection.length === 1 ? "equipamento colado" : "equipamentos colados"}.`,
      );
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Não foi possível colar.",
        true,
      );
    }
  }, [project, clipboard, flow, commit, notify]);
  const fitSelection = useCallback(() => {
    if (!project || !flow) return;
    const ids = new Set(selection);
    for (const edge of project.edges)
      if (ids.has(edge.id)) {
        ids.add(edge.from);
        ids.add(edge.to);
      }
    const nodes = project.nodes
      .filter((n) => ids.has(n.id))
      .map((n) => ({ id: n.id }));
    if (nodes.length)
      void flow.fitView({
        nodes,
        padding: { top: "130px", bottom: "65px", x: "40px" },
        maxZoom: 1.2,
        duration: 200,
      });
  }, [project, selection, flow]);
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        modal ||
        !(target instanceof HTMLElement) ||
        target.closest(
          'input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]',
        )
      )
        return;
      const action = editorAction(event);
      if (!action) return;
      if (action === "nudge") {
        if (
          mode !== "select" ||
          !project ||
          !project.nodes.some((n) => selection.includes(n.id))
        )
          return;
        event.preventDefault();
        // Own the gesture before React Flow handles focused nodes, so it is saved and undoable.
        event.stopPropagation();
        const step = event.shiftKey ? 10 : 1;
        const dx =
          event.key === "ArrowLeft"
            ? -step
            : event.key === "ArrowRight"
              ? step
              : 0;
        const dy =
          event.key === "ArrowUp"
            ? -step
            : event.key === "ArrowDown"
              ? step
              : 0;
        commit(nudgeSelection(project, selection, dx, dy), !event.repeat);
        return;
      }
      event.preventDefault();
      switch (action) {
        case "undo":
          undo();
          break;
        case "redo":
          redo();
          break;
        case "export":
          exportProject();
          break;
        case "duplicate":
          if (!event.repeat) duplicate();
          break;
        case "copy":
          if (!event.repeat) copySelection();
          break;
        case "paste":
          if (!event.repeat) pasteSelection();
          break;
        case "selectAll":
          setMode("select");
          setSelection(
            project
              ? [
                  ...project.nodes.map((n) => n.id),
                  ...project.edges.map((e) => e.id),
                ]
              : [],
          );
          break;
        case "delete":
          removeSelection();
          break;
        case "clear":
          setSelection([]);
          setMode("select");
          break;
        case "select":
          setMode("select");
          break;
        case "pan":
          setMode("pan");
          break;
        case "connect":
          setMode("connect");
          break;
        case "fit":
          void flow?.fitView({ padding: 0.22, maxZoom: 1, duration: 200 });
          break;
        case "fitSelection":
          fitSelection();
          break;
        case "help":
          setModal({ type: "help" });
          break;
      }
    };
    window.addEventListener("keydown", handle, true);
    return () => window.removeEventListener("keydown", handle, true);
  }, [
    modal,
    mode,
    project,
    selection,
    commit,
    undo,
    redo,
    exportProject,
    duplicate,
    copySelection,
    pasteSelection,
    fitSelection,
    removeSelection,
    flow,
  ]);

  const connect = useCallback(
    (connection: Connection) => {
      if (!project || !connection.source || !connection.target) return;
      const error = connectionError(
        project,
        connection.source,
        connection.target,
      );
      if (error) {
        notify(error, true);
        return;
      }
      const cable = {
        id: uid("cable"),
        from: connection.source,
        to: connection.target,
        sourceHandle: connection.sourceHandle ?? "out",
        label: `C-${String(project.edges.length + 1).padStart(2, "0")}`,
        properties: { ...cableDefaults },
      };
      commit({ ...project, edges: [...project.edges, cable] });
      setSelection([cable.id]);
    },
    [project, commit, notify],
  );
  const addEquipment = (
    type: EquipmentType,
    point?: { x: number; y: number },
  ) => {
    if (!project || !flow || !canvasRef.current) return;
    if (project.nodes.length >= 2000) {
      notify("Limite de 2.000 equipamentos por projeto.", true);
      return;
    }
    const box = canvasRef.current.getBoundingClientRect();
    const selected = project.nodes.find((n) => n.id === selection[0]);
    const selectedParent = project.nodes.find(
      (n) => n.id === selected?.parentId,
    );
    const position =
      point ??
      (selected
        ? selected.type === "PANEL"
          ? { x: selected.position.x + 120, y: selected.position.y + 110 }
          : {
              x: selected.position.x + (selectedParent?.position.x ?? 0) + 84,
              y: selected.position.y + (selectedParent?.position.y ?? 0) + 220,
            }
        : flow.screenToFlowPosition({
            x: box.left + box.width / 2,
            y: box.top + box.height / 2,
          }));
    position.x = Math.round((position.x - 84) / 20) * 20;
    position.y = Math.round((position.y - 40) / 20) * 20;
    const panel =
      type !== "PANEL"
        ? project.nodes.find(
            (n) =>
              n.type === "PANEL" &&
              position.x >= n.position.x &&
              position.x < n.position.x + 620 &&
              position.y >= n.position.y + 44 &&
              position.y < n.position.y + 550,
          )
        : undefined;
    const adjusted = panel
      ? {
          x: Math.max(
            0,
            Math.min(
              type === "BUSBAR" ? 320 : 440,
              position.x - panel.position.x,
            ),
          ),
          y: Math.max(44, Math.min(430, position.y - panel.position.y)),
        }
      : clampEquipmentPosition({ type }, position);
    const equipment = createEquipment(
      type,
      adjusted,
      nextEquipmentLabel(project, type),
      panel?.id,
    );
    commit({
      ...project,
      nodes: [...project.nodes, equipment].sort(
        (a, b) => Number(Boolean(a.parentId)) - Number(Boolean(b.parentId)),
      ),
    });
    setSelection([equipment.id]);
    setTab("properties");
    setMode("select");
    if (!point)
      void flow.setCenter(
        position.x + (type === "PANEL" ? 310 : type === "BUSBAR" ? 150 : 84),
        position.y + (type === "PANEL" ? 275 : 60),
        { zoom: Math.min(flow.getZoom(), 0.85), duration: 200 },
      );
    notify(
      `${catalog[type].name} na área de trabalho. Arraste para posicionar.`,
    );
  };
  const updateItem = (
    id: string,
    patch: { label?: string; properties?: Properties },
  ) => {
    if (!project) return;
    const original =
      project.nodes.find((n) => n.id === id) ??
      project.edges.find((e) => e.id === id);
    if (
      !original ||
      JSON.stringify({ ...original, ...patch }) === JSON.stringify(original)
    )
      return;
    commit({
      ...project,
      nodes: project.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)),
      edges: project.edges.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    });
  };
  const changeParent = (id: string, parentId: string) => {
    if (!project) return;
    const node = project.nodes.find((n) => n.id === id)!;
    const currentParent = project.nodes.find((n) => n.id === node.parentId),
      nextParent = project.nodes.find((n) => n.id === parentId);
    const absolute = {
      x: node.position.x + (currentParent?.position.x ?? 0),
      y: node.position.y + (currentParent?.position.y ?? 0),
    };
    const position = nextParent
      ? {
          x: Math.max(
            0,
            Math.min(
              node.type === "BUSBAR" ? 320 : 440,
              absolute.x - nextParent.position.x,
            ),
          ),
          y: Math.max(44, Math.min(430, absolute.y - nextParent.position.y)),
        }
      : absolute;
    commit({
      ...project,
      nodes: project.nodes.map((n) =>
        n.id === id ? { ...n, parentId: parentId || undefined, position } : n,
      ),
    });
  };
  const focusItem = (id: string) => {
    setSelection([id]);
    setTab("properties");
    setRightOpen(true);
    if (window.innerWidth < 800) setLeftOpen(false);
    const n = project?.nodes.find((n) => n.id === id);
    if (n)
      void flow?.fitView({
        nodes: [{ id }],
        padding: 0.8,
        maxZoom: 0.9,
        minZoom: 0.4,
        duration: 250,
      });
  };
  const importFile = async (file: File) => {
    if (importBusy.current) {
      notify("Uma importação já está em andamento.", true);
      return;
    }
    if (latestProjects.current.length >= 100) {
      notify(
        "Limite de 100 projetos locais. Exporte e remova um projeto antes de importar.",
        true,
      );
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      notify("O arquivo deve ter no máximo 10 MB.", true);
      return;
    }
    importBusy.current = true;
    try {
      const imported = parseProject(JSON.parse(await file.text()));
      if (
        latestProjects.current.some((p) => p.projectId === imported.projectId)
      ) {
        imported.projectId = uid("proj");
        imported.name = `${imported.name.slice(0, 85)} · importado`;
      }
      setProjects((prev) => [...prev, imported]);
      selectProject(imported.projectId);
      notify(
        "Projeto importado. Equipamentos, cabos e parâmetros restaurados.",
      );
    } catch (error) {
      notify(
        error instanceof SyntaxError
          ? "O arquivo não contém um JSON válido."
          : error instanceof Error
            ? error.message
            : "Não foi possível importar o arquivo.",
        true,
      );
    } finally {
      importBusy.current = false;
    }
  };
  const submitModal = () => {
    if (!modal) return;
    if (modal.type === "create" && modal.name.trim()) {
      if (projects.length >= 100) {
        notify(
          "Limite de 100 projetos locais. Exporte e remova um projeto para criar outro.",
          true,
        );
        return;
      }
      const next = createProject(modal.name.trim(), newDemo);
      setProjects((prev) => [...prev, next]);
      selectProject(next.projectId);
      setModal(null);
      setNewDemo(false);
    } else if (modal.type === "rename" && modal.name.trim() && project) {
      commit({ ...project, name: modal.name.trim() });
      setModal(null);
    } else if (modal.type === "delete") {
      let remaining = projects.filter((p) => p.projectId !== modal.projectId);
      if (!remaining.length) remaining = [createProject("Novo projeto")];
      setProjects(remaining);
      if (activeId === modal.projectId) selectProject(remaining[0].projectId);
      setModal(null);
      notify("Projeto removido deste navegador.");
    }
  };
  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    const type = event.dataTransfer.getData(
      "application/ampai-equipment",
    ) as EquipmentType;
    if (equipmentTypes.includes(type) && flow)
      addEquipment(
        type,
        flow.screenToFlowPosition({ x: event.clientX, y: event.clientY }),
      );
    else if (event.dataTransfer.files[0])
      void importFile(event.dataTransfer.files[0]);
  };
  const toggleCollapse = (id: string) =>
    setCollapsed((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );

  if (!ready || !project || !analysis)
    return (
      <div className="loading-workspace">
        <div className="brand-mark">
          <Zap size={24} />
        </div>
        <span>Preparando seu workspace…</span>
      </div>
    );
  const filteredNodes = project.nodes.filter(
    (n) =>
      n.label.toLowerCase().includes(query.toLowerCase()) ||
      catalog[n.type].name.toLowerCase().includes(query.toLowerCase()),
  );
  const selectedEquipmentCount = project.nodes.filter((n) =>
    selectionIds.has(n.id),
  ).length;
  const selectedCableCount = project.edges.filter((e) =>
    selectionIds.has(e.id),
  ).length;
  const selectedCount = selectedEquipmentCount + selectedCableCount;
  const renderTreeNode = (node: Project["nodes"][number], child = false) => {
    const children = query
      ? []
      : project.nodes.filter((n) => n.parentId === node.id);
    return (
      <div key={node.id}>
        <div
          className={`tree-row ${child ? "child" : ""} ${selection.includes(node.id) ? "selected" : ""}`}
        >
          <button className="tree-element" onClick={() => focusItem(node.id)}>
            {node.type === "PANEL" ? (
              <LayoutPanelLeft size={15} />
            ) : (
              <Symbol type={node.type} size={17} />
            )}
            <span>{node.label}</span>
          </button>
          {children.length > 0 && (
            <button
              className="tree-toggle"
              aria-label={`${collapsed.includes(node.id) ? "Expandir" : "Recolher"} ${node.label}`}
              onClick={() => toggleCollapse(node.id)}
            >
              {collapsed.includes(node.id) ? (
                <ChevronRight size={13} />
              ) : (
                <ChevronDown size={13} />
              )}
            </button>
          )}
        </div>
        {!collapsed.includes(node.id) &&
          children
            .filter((n) => !query || filteredNodes.includes(n))
            .map((n) => renderTreeNode(n, true))}
      </div>
    );
  };
  return (
    <div
      className={`workspace ${!leftOpen ? "left-closed" : ""} ${!rightOpen ? "right-closed" : ""}`}
    >
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <Zap size={21} fill="currentColor" />
          </div>
          <span>
            Amp<span className="brand-ai">AI</span>
          </span>
          <span className="brand-tag">WORKSPACE</span>
        </div>
        <div className="project-breadcrumb">
          <span>Projetos</span>
          <ChevronRight size={13} />
          <button
            title="Renomear projeto"
            onClick={() => setModal({ type: "rename", name: project.name })}
          >
            {project.name}
            <Pencil size={12} />
          </button>
        </div>
        <div className={`save-status ${saved}`}>
          <span className="green-dot" />
          {saved === "saved"
            ? "Salvo neste navegador"
            : saved === "saving"
              ? "Salvando…"
              : "Falha ao salvar"}
        </div>
        <div className="topbar-actions">
          <button
            className="secondary-button import-button"
            onClick={() => inputRef.current?.click()}
          >
            <ArrowUpFromLine size={15} />
            Importar
          </button>
          <button className="primary-button" onClick={exportProject}>
            <ArrowDownToLine size={15} />
            Exportar JSON
          </button>
          <button
            className="avatar"
            title="Workspace local"
            onClick={() => setModal({ type: "help" })}
          >
            EN
          </button>
        </div>
      </header>
      <aside className="left-sidebar">
        <div className="sidebar-section-label">
          <span>SEU WORKSPACE</span>
          <button
            className="icon-button"
            title="Novo projeto"
            aria-label="Novo projeto"
            onClick={() => {
              setNewDemo(false);
              setModal({ type: "create", name: "" });
            }}
          >
            <Plus size={16} />
          </button>
        </div>
        <div className="projects-list">
          {projects.map((p) => (
            <div
              className={`project-row ${p.projectId === activeId ? "active" : ""}`}
              key={p.projectId}
            >
              <button
                className="project-select"
                onClick={() => selectProject(p.projectId)}
              >
                {p.projectId === activeId ? (
                  <FolderOpen size={17} />
                ) : (
                  <Folder size={17} />
                )}
                <span>{p.name}</span>
              </button>
              <button
                className="project-delete"
                title={`Excluir ${p.name}`}
                aria-label={`Excluir projeto ${p.name}`}
                onClick={() =>
                  setModal({
                    type: "delete",
                    projectId: p.projectId,
                    name: p.name,
                  })
                }
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
        <button
          className="new-project"
          onClick={() => {
            setNewDemo(false);
            setModal({ type: "create", name: "" });
          }}
        >
          <Plus size={15} />
          Novo projeto
        </button>
        <div className="sidebar-divider" />
        <div className="sidebar-section-label">
          <span>ELEMENTOS DO PROJETO</span>
          <span className="sidebar-counter">{project.nodes.length}</span>
        </div>
        <div className="sidebar-search">
          <Search size={14} />
          <input
            aria-label="Buscar elementos"
            placeholder="Buscar elemento…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              className="icon-button"
              aria-label="Limpar busca"
              onClick={() => setQuery("")}
            >
              <X size={12} />
            </button>
          )}
        </div>
        <div className="element-tree">
          {query
            ? filteredNodes.map((n) => renderTreeNode(n))
            : project.nodes
                .filter((n) => !n.parentId)
                .map((n) => renderTreeNode(n))}
          {filteredNodes.length === 0 && (
            <p className="tree-empty">
              {query
                ? "Nenhum elemento encontrado."
                : "Seu projeto começa aqui. Adicione um equipamento da biblioteca."}
            </p>
          )}
          {project.edges.length > 0 && !query && (
            <>
              <button
                className="cable-tree-heading"
                onClick={() => toggleCollapse("cables")}
              >
                <ChevronRight
                  className={!collapsed.includes("cables") ? "rotated" : ""}
                  size={13}
                />
                <CableIcon size={14} />
                <span>Cabos e conexões</span>
                <span>{project.edges.length}</span>
              </button>
              {!collapsed.includes("cables") &&
                project.edges.map((e) => (
                  <button
                    className={`cable-tree-row ${selection.includes(e.id) ? "selected" : ""}`}
                    key={e.id}
                    onClick={() => focusItem(e.id)}
                  >
                    <span>{e.label}</span>
                    <small>{e.properties.section_mm2} mm²</small>
                  </button>
                ))}
            </>
          )}
        </div>
        <div className="sidebar-bottom">
          <div className="local-badge">
            <div className="local-badge-icon">
              <Folder size={17} />
            </div>
            <div>
              <b>Seu projeto, com você.</b>
              <span>Arquivos JSON portáveis</span>
            </div>
          </div>
          <button
            className="help-button"
            onClick={() => setModal({ type: "help" })}
          >
            <CircleHelp size={16} />
            Guia e atalhos<kbd>?</kbd>
          </button>
        </div>
      </aside>
      <main className="main-workspace">
        <div className="canvas-titlebar">
          <div>
            <span className="workspace-eyebrow">ENGENHARIA ELÉTRICA</span>
            <h1>
              Diagrama unifilar <span>01</span>
            </h1>
          </div>
          <div className="view-actions">
            <button
              className="icon-button"
              title={leftOpen ? "Ocultar árvore" : "Mostrar árvore"}
              aria-label={leftOpen ? "Ocultar árvore" : "Mostrar árvore"}
              onClick={() => setLeftOpen(!leftOpen)}
            >
              <PanelLeftClose size={17} />
            </button>
            <button
              className="icon-button"
              title={
                rightOpen ? "Ocultar propriedades" : "Mostrar propriedades"
              }
              aria-label={
                rightOpen ? "Ocultar propriedades" : "Mostrar propriedades"
              }
              onClick={() => setRightOpen(!rightOpen)}
            >
              <PanelRightClose size={17} />
            </button>
            <span className="view-divider" />
            <button
              className={`text-tool ${snap ? "active" : ""}`}
              onClick={() => setSnap(!snap)}
              title="Ativar ou desativar alinhamento à grade"
            >
              <Grid2X2 size={14} />
              Grade magnética
              <span className="toggle">
                <i />
              </span>
            </button>
          </div>
        </div>
        <div className="library-bar">
          <div className="library-label">
            <BookOpen size={15} />
            <span>Biblioteca</span>
          </div>
          <div className="library-items">
            {equipmentTypes
              .filter((t) => t !== "TIE")
              .map((type) => (
                <button
                  key={type}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("application/ampai-equipment", type);
                    e.dataTransfer.effectAllowed = "copy";
                  }}
                  title={`Adicionar ${catalog[type].name} · clique ou arraste`}
                  aria-label={`Adicionar ${catalog[type].name}`}
                  className="library-item"
                  onClick={() => addEquipment(type)}
                >
                  <Symbol type={type} size={23} />
                  <span>{catalog[type].short}</span>
                </button>
              ))}
            <button
              draggable
              onDragStart={(e) =>
                e.dataTransfer.setData("application/ampai-equipment", "TIE")
              }
              className="library-item"
              title="Adicionar acoplamento TIE"
              aria-label="Adicionar acoplamento TIE"
              onClick={() => addEquipment("TIE")}
            >
              <Symbol type="TIE" size={23} />
              <span>TIE</span>
            </button>
          </div>
        </div>
        <div
          className={`canvas-area canvas-mode-${mode}`}
          ref={canvasRef}
          onDrop={onDrop}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
          }}
        >
          <DiagramCanvas
            key={project.projectId}
            project={project}
            analysis={analysis}
            selection={selection}
            onSelection={setSelection}
            mode={mode}
            snap={snap}
            showMap={showMap}
            onInit={setFlow}
            onConnect={connect}
            onCommit={commit}
            onProperties={showProperties}
            onZoom={setZoom}
            onViewport={saveViewport}
          />

          <div className="canvas-toolbar">
            <button
              className={mode === "select" ? "active" : ""}
              title="Selecionar e mover (V)"
              aria-label="Selecionar e mover"
              aria-pressed={mode === "select"}
              onClick={() => setMode("select")}
            >
              <MousePointer2 size={19} />
              <kbd>V</kbd>
            </button>
            <button
              className={mode === "pan" ? "active" : ""}
              title="Mover área de trabalho (H)"
              aria-label="Mover área de trabalho"
              aria-pressed={mode === "pan"}
              onClick={() => setMode("pan")}
            >
              <Hand size={19} />
              <kbd>H</kbd>
            </button>
            <span />
            <button
              className={mode === "connect" ? "active" : ""}
              title="Conectar equipamentos (C)"
              aria-label="Conectar equipamentos"
              aria-pressed={mode === "connect"}
              onClick={() => {
                setMode("connect");
                notify(
                  "Arraste da porta inferior de um equipamento até a porta superior de outro.",
                );
              }}
            >
              <CableIcon size={19} />
              <kbd>C</kbd>
            </button>
            <span />
            <button
              disabled={!history.past.length}
              title="Desfazer (Ctrl+Z)"
              aria-label="Desfazer"
              onClick={undo}
            >
              <Undo2 size={18} />
            </button>
            <button
              disabled={!history.future.length}
              title="Refazer (Ctrl+Shift+Z)"
              aria-label="Refazer"
              onClick={redo}
            >
              <Redo2 size={18} />
            </button>
            <span />
            <button
              disabled={!clipboard}
              title="Colar equipamentos copiados (Ctrl+V)"
              aria-label="Colar equipamentos"
              onClick={pasteSelection}
            >
              <ClipboardPaste size={18} />
            </button>
          </div>
          {selectedCount > 0 && (
            <div
              className="selection-actions"
              role="toolbar"
              aria-label="Ações da seleção"
            >
              <span>
                {selectedCount} selecionado{selectedCount === 1 ? "" : "s"}
              </span>
              <button
                title="Enquadrar seleção (Shift+F)"
                aria-label="Enquadrar seleção"
                onClick={fitSelection}
              >
                <Maximize size={16} />
              </button>
              <button
                disabled={!selectedEquipmentCount}
                title="Copiar seleção (Ctrl+C)"
                aria-label="Copiar seleção"
                onClick={copySelection}
              >
                <Copy size={16} />
              </button>
              <button
                disabled={!selectedEquipmentCount}
                title="Duplicar seleção (Ctrl+D)"
                aria-label="Duplicar seleção"
                onClick={duplicate}
              >
                <Layers3 size={16} />
              </button>
              <button
                title="Excluir seleção (Delete)"
                aria-label="Excluir seleção"
                onClick={removeSelection}
              >
                <Trash2 size={16} />
              </button>
              <button
                title="Limpar seleção (Esc)"
                aria-label="Limpar seleção"
                onClick={() => setSelection([])}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {project.nodes.length === 0 && (
            <div className="empty-canvas">
              <div>
                <Layers3 size={35} />
              </div>
              <span className="section-eyebrow">DO CONCEITO À CONEXÃO</span>
              <h2>
                Uma tela em branco.
                <br />
                Infinitas possibilidades.
              </h2>
              <p>
                Adicione o primeiro equipamento pela biblioteca
                <br />e dê forma ao seu projeto de engenharia.
              </p>
              <button
                className="primary-button"
                onClick={() => addEquipment("SOURCE")}
              >
                <Plus size={16} />
                Adicionar alimentação
              </button>
            </div>
          )}
          <div className="canvas-bottom">
            <div className="zoom-control">
              <button
                aria-label="Diminuir zoom"
                title="Diminuir zoom"
                onClick={() => void flow?.zoomOut({ duration: 150 })}
              >
                <Minus size={15} />
              </button>
              <span>{Math.round(zoom * 100)}%</span>
              <button
                aria-label="Aumentar zoom"
                title="Aumentar zoom"
                onClick={() => void flow?.zoomIn({ duration: 150 })}
              >
                <Plus size={15} />
              </button>
              <span className="zoom-divider" />
              <button
                aria-label="Enquadrar diagrama"
                title="Enquadrar diagrama (F)"
                onClick={() =>
                  void flow?.fitView({
                    padding: 0.22,
                    maxZoom: 1,
                    duration: 250,
                  })
                }
              >
                <Maximize size={15} />
              </button>
              <button
                className={showMap ? "active" : ""}
                aria-label="Mostrar minimapa"
                title="Minimapa"
                onClick={() => setShowMap(!showMap)}
              >
                <Layers3 size={15} />
              </button>
            </div>
            <span className="canvas-hint">
              {mode === "pan"
                ? "Arraste para navegar pelo diagrama"
                : mode === "connect"
                  ? "Arraste entre as portas para conectar"
                  : selectedEquipmentCount > 0
                    ? "Setas para ajuste fino · Shift + setas para mover 10 px"
                    : "Arraste para selecionar · Scroll para zoom · H para navegar"}
            </span>
            <button
              className="canvas-help"
              aria-label="Ajuda do editor"
              onClick={() => setModal({ type: "help" })}
            >
              <CircleHelp size={18} />
            </button>
          </div>
        </div>
        <footer className="statusbar">
          <div>
            <span className="status-dot" />
            Workspace local
            <span className="status-separator" />
            {project.nodes.length} equipamentos<span>·</span>
            {project.edges.length} conexões
          </div>
          <button
            onClick={() => {
              setTab("analysis");
              setRightOpen(true);
            }}
          >
            <Zap size={12} />
            {number(analysis.total.active)} kW de demanda
            <span className="status-separator" />
            {analysis.issues.some((i) => i.severity === "warning") ? (
              <>
                <span className="amber-dot" />
                Verificar circuito
              </>
            ) : (
              <>
                <CheckCircle2 size={12} />
                Grafo consistente
              </>
            )}
          </button>
        </footer>
      </main>
      <Inspector
        project={project}
        analysis={analysis}
        selection={selectedCount === 1 ? (selection[0] ?? null) : null}
        selectionSummary={
          selectedCount > 1
            ? { equipment: selectedEquipmentCount, cables: selectedCableCount }
            : undefined
        }
        tab={tab}
        onTab={setTab}
        onUpdate={updateItem}
        onDelete={removeSelection}
        onDuplicate={duplicate}
        onParent={changeParent}
        onClear={() => setSelection([])}
        onSelect={focusItem}
      />
      <input
        type="file"
        accept=".json,application/json"
        hidden
        ref={inputRef}
        aria-label="Importar projeto JSON"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void importFile(file);
          e.target.value = "";
        }}
      />
      {toast && (
        <div
          className={`toast ${toast.error ? "error" : ""}`}
          role={toast.error ? "alert" : "status"}
        >
          {toast.error ? <CircleHelp size={17} /> : <Check size={17} />}
          <span>{toast.message}</span>
          <button aria-label="Fechar mensagem" onClick={() => setToast(null)}>
            <X size={14} />
          </button>
        </div>
      )}
      {modal && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setModal(null);
          }}
        >
          <div
            className={`modal ${modal.type === "help" ? "help-modal" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            onKeyDown={(e) => {
              if (e.key === "Escape") setModal(null);
              if (e.key === "Tab") {
                const elements = e.currentTarget.querySelectorAll<HTMLElement>(
                  "button:not(:disabled),input,select,a[href]",
                );
                const first = elements[0],
                  last = elements[elements.length - 1];
                if (e.shiftKey && document.activeElement === first) {
                  e.preventDefault();
                  last?.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                  e.preventDefault();
                  first?.focus();
                }
              }
            }}
          >
            <button
              className="modal-close icon-button"
              aria-label="Fechar janela"
              onClick={() => setModal(null)}
            >
              <X size={19} />
            </button>
            {modal.type === "help" ? (
              <>
                <div className="modal-icon">
                  <BookOpen size={25} />
                </div>
                <span className="section-eyebrow">BEM-VINDO AO AMPAI</span>
                <h2 id="modal-title">Ideias que se conectam.</h2>
                <p>
                  Um workspace de engenharia elétrica, do primeiro equipamento
                  ao circuito completo.
                </p>
                <div className="help-steps">
                  <div>
                    <b>01</b>
                    <span>
                      <strong>Monte seu diagrama</strong>Clique ou arraste
                      símbolos da biblioteca. Solte dentro de um painel para
                      criar subelementos.
                    </span>
                  </div>
                  <div>
                    <b>02</b>
                    <span>
                      <strong>Conecte e configure</strong>Arraste entre portas.
                      Selecione equipamentos e cabos para editar parâmetros no
                      painel de propriedades.
                    </span>
                  </div>
                  <div>
                    <b>03</b>
                    <span>
                      <strong>Leve seu trabalho com você</strong>Os projetos
                      ficam neste navegador. Exporte JSON para backup ou importe
                      para continuar em outro dispositivo.
                    </span>
                  </div>
                </div>
                <div className="shortcuts">
                  {[
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
                  ].map(([key, name]) => (
                    <div key={key}>
                      <span>{name}</span>
                      <kbd>{key}</kbd>
                    </div>
                  ))}
                </div>
                <p className="help-note">
                  Modelo radial, sem circuitos fechados ou dupla alimentação. Os
                  cálculos são preliminares; consulte suas premissas na aba
                  Análise.
                </p>
                <button
                  className="primary-button full-width"
                  onClick={() => setModal(null)}
                >
                  Vamos projetar
                  <ChevronRight size={16} />
                </button>
              </>
            ) : modal.type === "delete" ? (
              <>
                <div className="modal-icon danger">
                  <Trash2 size={25} />
                </div>
                <h2 id="modal-title">Excluir projeto?</h2>
                <p>
                  “{modal.name}” e seus elementos serão removidos deste
                  navegador. Exporte um JSON se quiser guardar uma cópia.
                </p>
                <div className="modal-actions">
                  <button
                    className="secondary-button"
                    onClick={() => setModal(null)}
                  >
                    Cancelar
                  </button>
                  <button className="danger-button solid" onClick={submitModal}>
                    Excluir projeto
                  </button>
                </div>
              </>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  submitModal();
                }}
              >
                <div className="modal-icon">
                  <FolderOpen size={25} />
                </div>
                <span className="section-eyebrow">SEU PRÓXIMO PROJETO</span>
                <h2 id="modal-title">
                  {modal.type === "create"
                    ? "Vamos dar forma à sua ideia."
                    : "Um nome para o seu projeto."}
                </h2>
                <p>
                  {modal.type === "create"
                    ? "Crie um workspace e comece a conectar seus equipamentos."
                    : "O nome ajuda você a organizar seus diagramas."}
                </p>
                <label className="property-field">
                  <span>Nome do projeto</span>
                  <input
                    className="text-input"
                    aria-label="Nome do projeto"
                    autoFocus
                    placeholder="Ex.: Subestação · Unidade 02"
                    maxLength={100}
                    required
                    value={modal.name}
                    onChange={(e) =>
                      setModal({ ...modal, name: e.target.value })
                    }
                  />
                </label>
                {modal.type === "create" && (
                  <label className="demo-checkbox">
                    <input
                      type="checkbox"
                      checked={newDemo}
                      onChange={(e) => setNewDemo(e.target.checked)}
                    />
                    <span>Começar com um diagrama de exemplo</span>
                  </label>
                )}
                <div className="modal-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => setModal(null)}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="primary-button"
                    disabled={!modal.name.trim()}
                  >
                    {modal.type === "create" ? "Criar projeto" : "Salvar nome"}
                    <ChevronRight size={15} />
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
export default function Workspace() {
  return (
    <ReactFlowProvider>
      <WorkspaceInner />
    </ReactFlowProvider>
  );
}
