"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type MouseEvent,
} from "react";
import { flushSync } from "react-dom";
import {
  ReactFlowProvider,
  type Connection,
  type Edge,
  type ReactFlowInstance,
  type Viewport,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "driver.js/dist/driver.css";
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
  LockKeyhole,
  UnlockKeyhole,
} from "lucide-react";
import {
  cableDefaults,
  catalog,
  equipmentTypes,
  type EquipmentType,
  type Properties,
} from "@/lib/catalog";
import { number } from "@/lib/calculations";
import {
  connectionError,
  createEquipment,
  createProject,
  deleteItems,
  parseProjectText,
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
  nextCableLabel,
  reparentEquipment,
} from "@/lib/geometry";
import DiagramCanvas from "./diagram-canvas";
import { useProjectAnalysis } from "./use-project-analysis";
import { useProjectViewport } from "./use-project-viewport";
import { restoreWorkspace } from "@/lib/workspace-storage";
import {
  captureSelection,
  insertFragment,
  nudgeSelection,
  updateProjectItem,
  selectionEquipmentIds,
  type SelectionFragment,
} from "@/lib/editing";
import { editorAction } from "@/lib/shortcuts";
import { fileStem } from "@/lib/files";
import { searchProjectItems } from "@/lib/project-search";
import Inspector from "./inspector";
import Symbol from "./symbol";
import GuidedTour from "./guided-tour";
import LearningCenter from "./learning-center";
import ExportPreview from "./export-preview";
import ProjectsOverview from "./projects-overview";
import { feedingCircuit } from "@/lib/circuit-focus";
import { updateCableLayout } from "@/lib/cable-path";
import { equipmentSize } from "@/lib/geometry";
import ActionMenu from "./action-menu";
import CommandPalette from "./command-palette";
import type { Command } from "@/lib/command-search";
import {
  arrangementActions,
  arrangeSelection,
  movableSelection,
  setPositionLock,
  updateBatchProperties,
  type Arrangement,
} from "@/lib/qol-editing";
import {
  rememberOnboarding,
  shouldOfferTour,
  type TourPanel,
} from "@/lib/onboarding";

type Modal =
  | { type: "create" | "rename"; name: string; projectId?: string }
  | { type: "delete"; projectId: string; name: string }
  | { type: "help" }
  | null;
type History = { past: Project[]; future: Project[] };
type ToastAction = {
  label: string;
  run: () => void;
  undoSnapshot?: Project;
  projectId?: string;
};

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
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [exportPreview, setExportPreview] = useState<{
    project: Project;
    format: "png" | "pdf";
  } | null>(null);
  const [circuitId, setCircuitId] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const paletteFocus = useRef<HTMLElement | null>(null);
  const [actionMenu, setActionMenu] = useState<{
    x: number;
    y: number;
    kind: "context" | "arrange";
  } | null>(null);
  const [tourActive, setTourActive] = useState(false);
  const [welcome, setWelcome] = useState(false);
  const tourLayout = useRef<{
    leftOpen: boolean;
    rightOpen: boolean;
    tab: "properties" | "analysis";
    focus: HTMLElement | null;
  } | null>(null);
  const [toast, setToast] = useState<{
    message: string;
    error?: boolean;
    action?: ToastAction;
  } | null>(null);
  const [flow, setFlow] = useState<ReactFlowInstance<
    EquipmentFlowNode,
    Edge
  > | null>(null);
  const [zoom, setZoom] = useState(1);
  const [newDemo, setNewDemo] = useState(false);
  const [clipboard, setClipboard] = useState<SelectionFragment | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const undoAction = useRef(() => {});
  const exportRef = useRef<HTMLDivElement>(null);
  const pasteCount = useRef(0);
  const importBusy = useRef(false);
  const latestProjects = useRef(projects);
  useLayoutEffect(() => {
    latestProjects.current = projects;
  }, [projects]);
  const inputRef = useRef<HTMLInputElement>(null),
    canvasRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const closeMenu = useCallback(() => {
    setActionMenu(null);
    canvasRef.current?.focus({ preventScroll: true });
  }, []);
  const closePalette = useCallback(() => {
    flushSync(() => setPaletteOpen(false));
    const target = paletteFocus.current;
    (target?.isConnected ? target : canvasRef.current)?.focus({
      preventScroll: true,
    });
  }, []);
  const openPalette = useCallback(() => {
    if (modal || tourActive || overviewOpen || exportPreview) return;
    paletteFocus.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    flushSync(() => paletteFocus.current?.blur());
    setActionMenu(null);
    setExportOpen(false);
    setPaletteOpen(true);
  }, [modal, tourActive, overviewOpen, exportPreview]);
  useEffect(() => {
    setActionMenu(null);
    setPaletteOpen(false);
  }, [activeId, tourActive, modal]);
  const project = projects.find((p) => p.projectId === activeId);
  const backgroundBlocked = paletteOpen || overviewOpen || !!exportPreview;
  const focusedCircuit = useMemo(() => {
    const result =
      project && circuitId ? feedingCircuit(project, circuitId) : null;
    return result?.nodes.size ? result : null;
  }, [project?.nodes, project?.edges, circuitId]);
  const focusNodes = useProjectViewport(project, flow, canvasRef);
  const {
    nodes: filteredNodes,
    edges: filteredEdges,
    query: searchQuery,
  } = useMemo(
    () => searchProjectItems(project, query),
    [project?.nodes, project?.edges, query],
  );
  const treeChildren = useMemo(() => {
    const children = new Map<string, Project["nodes"]>();
    for (const node of project?.nodes ?? []) {
      if (!node.parentId) continue;
      const members = children.get(node.parentId) ?? [];
      members.push(node);
      children.set(node.parentId, members);
    }
    return children;
  }, [project?.nodes]);
  const analysis = useProjectAnalysis(project);
  const notify = useCallback(
    (message: string, error = false, action?: ToastAction) =>
      setToast({ message, error, action }),
    [],
  );
  useEffect(() => {
    if (!ready) return;
    try {
      setWelcome(shouldOfferTour(localStorage));
    } catch {
      /* Storage can be unavailable. */
    }
  }, [ready]);
  const dismissWelcome = () => {
    setWelcome(false);
    try {
      rememberOnboarding(localStorage, "dismissed");
    } catch {
      /* Optional preference. */
    }
  };
  const startTour = () => {
    if (tourActive) return;
    tourLayout.current = {
      leftOpen,
      rightOpen,
      tab,
      focus:
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null,
    };
    dismissWelcome();
    setModal(null);
    setExportOpen(false);
    setTourActive(true);
  };
  const prepareTour = useCallback((panel?: TourPanel) => {
    setLeftOpen(panel === "projects");
    setRightOpen(panel === "properties" || panel === "analysis");
    if (panel === "properties" || panel === "analysis") setTab(panel);
  }, []);
  const finishTour = useCallback(
    (completed: boolean) => {
      setTourActive(false);
      const previous = tourLayout.current;
      if (previous) {
        setLeftOpen(previous.leftOpen);
        setRightOpen(previous.rightOpen);
        setTab(previous.tab);
        requestAnimationFrame(() => {
          const target = previous.focus?.isConnected
            ? previous.focus
            : document.querySelector<HTMLElement>('[data-tour="help"]');
          target?.focus({ preventScroll: true });
        });
      }
      if (completed) {
        try {
          rememberOnboarding(localStorage, "completed");
        } catch {
          /* Optional preference. */
        }
        notify(
          "Tour concluído! O tutorial do primeiro circuito está na ajuda.",
        );
      }
    },
    [notify],
  );
  const tourError = useCallback(() => {
    notify(
      "Não foi possível abrir o tour. Consulte o tutorial na ajuda e tente novamente.",
      true,
    );
    setModal({ type: "help" });
  }, [notify]);
  useEffect(() => {
    if (!modal) return;
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    (
      modalRef.current?.querySelector<HTMLInputElement>("input") ??
      modalRef.current?.querySelector<HTMLButtonElement>("button")
    )?.focus();
    return () => {
      if (previous?.isConnected) previous.focus();
    };
  }, [modal?.type]);
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
    const box = canvasRef.current?.getBoundingClientRect();
    const savedViewport =
      box && box.width > 0 && box.height > 0
        ? { ...viewport, canvasWidth: box.width, canvasHeight: box.height }
        : viewport;
    setProjects((previous) => {
      let changed = false;
      const next = previous.map((item) => {
        if (
          item.projectId !== projectId ||
          sameViewport(item.viewport, savedViewport)
        )
          return item;
        changed = true;
        return { ...item, viewport: savedViewport };
      });
      return changed ? next : previous;
    });
  }, []);
  const showProperties = useCallback(() => {
    setTab("properties");
    if (window.innerWidth < 570) setRightOpen(true);
  }, []);
  const selectProject = (id: string) => {
    if (id === activeId) return;
    setActiveId(id);
    setSelection([]);
    setHistory({ past: [], future: [] });
    setQuery("");
    setCircuitId(null);
    setToast(null);
  };
  const undo = useCallback(() => {
    if (!project || !history.past.length) return;
    const previous = history.past[history.past.length - 1];
    setHistory({
      past: history.past.slice(0, -1),
      future: [project, ...history.future],
    });
    setProjects((prev) =>
      prev.map((p) =>
        p.projectId === activeId
          ? {
              ...previous,
              viewport: project.viewport,
              updatedAt: new Date().toISOString(),
            }
          : p,
      ),
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
      prev.map((p) =>
        p.projectId === activeId
          ? {
              ...next,
              viewport: project.viewport,
              updatedAt: new Date().toISOString(),
            }
          : p,
      ),
    );
    setSelection([]);
  }, [project, history, activeId]);
  useLayoutEffect(() => {
    undoAction.current = undo;
  }, [undo]);
  const removeSelection = useCallback(() => {
    if (!project || !selection.length) return;
    commit(deleteItems(project, selection));
    setSelection([]);
    notify("Elementos removidos do diagrama.", false, {
      label: "Desfazer",
      run: () => undoAction.current(),
      undoSnapshot: project,
    });
  }, [project, selection, commit, notify]);
  const exportProject = useCallback(() => {
    const current = latestProjects.current.find(
      (item) => item.projectId === activeId,
    );
    if (!current) return;
    try {
      const blob = new Blob([serializeProject(current)], {
        type: "application/json;charset=utf-8",
      });
      const url = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = url;
      a.download = `${fileStem(current.name)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      notify("Projeto exportado em JSON.");
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Não foi possível exportar.",
        true,
      );
    }
  }, [activeId, notify]);
  const exportVisual = useCallback(
    (format: "png" | "pdf") => {
      if (!project) return;
      setExportOpen(false);
      setExportPreview({ project, format });
    },
    [project],
  );
  useEffect(() => {
    if (!exportOpen) return;
    const close = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !exportRef.current?.contains(event.target)
      )
        setExportOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setExportOpen(false);
        exportRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
      }
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", escape, true);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", escape, true);
    };
  }, [exportOpen]);
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
    const nodes = selectionEquipmentIds(project, selection).map((id) => ({
      id,
    }));
    if (nodes.length)
      void flow.fitView({
        includeHiddenNodes: true,
        nodes,
        padding: { top: "24px", bottom: "65px", x: "40px" },
        maxZoom: 1.2,
        duration: 200,
      });
  }, [project, selection, flow]);
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        modal ||
        tourActive ||
        overviewOpen ||
        exportPreview ||
        !(target instanceof HTMLElement)
      )
        return;
      const action = editorAction(event);
      if (action === "commands") {
        event.preventDefault();
        event.stopPropagation();
        if (!event.repeat) paletteOpen ? closePalette() : openPalette();
        return;
      }
      if (paletteOpen) return;
      if (
        target.closest("[data-cable-control]") &&
        ["nudge", "delete", "clear"].includes(action ?? "")
      )
        return;
      if (actionMenu) {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          closeMenu();
        }
        return;
      }
      if (
        event.repeat &&
        action &&
        ["export", "copy", "paste", "duplicate"].includes(action)
      ) {
        event.preventDefault();
        return;
      }
      if (
        target.closest(
          'input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]',
        )
      ) {
        if (action === "export") {
          event.preventDefault();
          flushSync(() => target.blur());
          exportProject();
        }
        return;
      }
      if (exportOpen && event.key === "Escape") return;
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
          void flow?.fitView({
            includeHiddenNodes: true,
            padding: {
              top: "24px",
              bottom: "65px",
              x: "40px",
            },
            maxZoom: 1,
            duration: 200,
          });
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
    tourActive,
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
    exportOpen,
    overviewOpen,
    exportPreview,
    paletteOpen,
    openPalette,
    closePalette,
    actionMenu,
    closeMenu,
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
        label: nextCableLabel(project),
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
    position.x = snap
      ? Math.round((position.x - 84) / 20) * 20
      : position.x - 84;
    position.y = snap
      ? Math.round((position.y - 40) / 20) * 20
      : position.y - 40;
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
    commit(updateProjectItem(project, id, patch));
  };
  const changeParent = (id: string, parentId: string) => {
    if (project) commit(reparentEquipment(project, id, parentId));
  };
  const focusItem = (id: string) => {
    setSelection([id]);
    setTab("properties");
    setRightOpen(true);
    if (window.innerWidth < 800) setLeftOpen(false);
    if (project) focusNodes(selectionEquipmentIds(project, [id]));
  };
  const traceItem = (id: string) => {
    if (!project) return;
    if (circuitId === id) {
      setCircuitId(null);
      return;
    }
    const circuit = feedingCircuit(project, id);
    if (!circuit.nodes.size) return;
    setCircuitId(id);
    focusNodes([...circuit.nodes]);
    if (!circuit.supplied)
      notify("O caminho destacado ainda não chega a uma alimentação.", true, {
        label: "Ver análise",
        run: () => {
          setTab("analysis");
          setRightOpen(true);
        },
        projectId: project.projectId,
      });
  };
  const addCableBend = (id: string) => {
    if (!project) return;
    const edge = project.edges.find((e) => e.id === id);
    if (!edge || (edge.layout?.waypoints?.length ?? 0) >= 20) return;
    const absolute = (nodeId: string) => {
      const n = project.nodes.find((n) => n.id === nodeId)!;
      const parent = project.nodes.find((p) => p.id === n.parentId);
      return {
        x:
          n.position.x +
          (parent?.position.x ?? 0) +
          equipmentSize(n.type).width / 2,
        y:
          n.position.y +
          (parent?.position.y ?? 0) +
          equipmentSize(n.type).height / 2,
      };
    };
    const source = edge.layout?.waypoints?.at(-1) ?? absolute(edge.from),
      target = absolute(edge.to);
    commit(
      updateCableLayout(project, id, {
        ...edge.layout,
        waypoints: [
          ...(edge.layout?.waypoints ?? []),
          {
            x: Math.round((source.x + target.x) / 2 + 60),
            y: Math.round((source.y + target.y) / 2),
          },
        ],
      }),
    );
    setMode("select");
    notify(
      "Dobra adicionada. Arraste o ponto do cabo; use Delete sobre o ponto para removê-lo.",
    );
  };
  const resetCable = (id: string) => {
    if (project) commit(updateCableLayout(project, id));
  };
  const exportNamedProject = (item: Project) => {
    try {
      const url = URL.createObjectURL(
        new Blob([serializeProject(item)], {
          type: "application/json;charset=utf-8",
        }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `${fileStem(item.name)}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      notify(`Projeto ${item.name} exportado em JSON.`);
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Não foi possível exportar.",
        true,
      );
    }
  };
  const lockSelection = (locked: boolean) => {
    if (!project) return;
    commit(setPositionLock(project, selection, locked));
  };
  const selectTreeItem = (event: MouseEvent<HTMLElement>, id: string) => {
    if (!event.ctrlKey && !event.metaKey) {
      focusItem(id);
      return;
    }
    setSelection((previous) =>
      previous.includes(id)
        ? previous.filter((item) => item !== id)
        : [...previous, id],
    );
    setTab("properties");
    setRightOpen(true);
  };
  const arrange = (action: Arrangement) => {
    if (!project) return;
    try {
      commit(arrangeSelection(project, selection, action));
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "Não foi possível organizar a seleção.",
        true,
      );
    }
  };
  const batchUpdate = (patch: Properties) => {
    if (!project) return;
    try {
      commit(updateBatchProperties(project, selection, patch));
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "Não foi possível editar a seleção.",
        true,
      );
    }
  };
  const showContextMenu = useCallback(
    (x: number, y: number, id?: string) => {
      if (modal || tourActive || paletteOpen) return;
      setExportOpen(false);
      if (id)
        setSelection((previous) => (previous.includes(id) ? previous : [id]));
      else setSelection([]);
      setActionMenu({ x, y, kind: "context" });
    },
    [modal, tourActive, paletteOpen],
  );
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
      const imported = parseProjectText(await file.text());
      if (latestProjects.current.length >= 100)
        throw new Error(
          "Limite de 100 projetos locais. Exporte e remova um projeto antes de importar.",
        );
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
      const renamed = projects.find(
        (p) => p.projectId === (modal.projectId ?? activeId),
      );
      if (renamed?.projectId === activeId)
        commit({ ...renamed, name: modal.name.trim() });
      else if (renamed)
        setProjects((previous) =>
          previous.map((p) =>
            p.projectId === renamed.projectId
              ? {
                  ...p,
                  name: modal.name.trim(),
                  updatedAt: new Date().toISOString(),
                }
              : p,
          ),
        );
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
  const selectedEquipmentCount = project.nodes.filter((n) =>
    selectionIds.has(n.id),
  ).length;
  const selectedCableCount = project.edges.filter((e) =>
    selectionIds.has(e.id),
  ).length;
  const selectedCount = selectedEquipmentCount + selectedCableCount;
  const selectedCable =
    selectedCount === 1
      ? project.edges.find((e) => e.id === selection[0])
      : undefined;
  const canTrace =
    selectedCount === 1 &&
    project.nodes.find((n) => n.id === selection[0])?.type !== "PANEL";
  const movableCount = movableSelection(project, selection).length;
  const ownLocked = project.nodes.some(
    (n) => selectionIds.has(n.id) && n.locked,
  );
  const layoutActions = arrangementActions.map(([action, label]) => ({
    label,
    disabled:
      movableCount < (action === "horizontal" || action === "vertical" ? 3 : 2),
    run: () => arrange(action),
  }));
  const renameSelected = () => {
    setTab("properties");
    setRightOpen(true);
    requestAnimationFrame(() => {
      const field = document.querySelector<HTMLInputElement>(
        'input[aria-label="Nome do elemento"]',
      );
      field?.focus();
      field?.select();
    });
  };
  const commandNodes = paletteOpen
    ? new Map(project.nodes.map((n) => [n.id, n]))
    : null;
  const commandList: Command[] = paletteOpen
    ? [
        {
          id: "fit",
          label: "Enquadrar diagrama",
          detail: "Ação · F",
          run: () =>
            void flow?.fitView({
              includeHiddenNodes: true,
              padding: 0.2,
              maxZoom: 1,
              duration: 200,
            }),
        },
        {
          id: "fit-selection",
          label: "Enquadrar seleção",
          detail: "Ação · Shift+F",
          disabled: !selectedCount,
          run: fitSelection,
        },
        {
          id: "undo",
          label: "Desfazer",
          detail: "Ação · Ctrl+Z",
          disabled: !history.past.length,
          run: undo,
        },
        {
          id: "redo",
          label: "Refazer",
          detail: "Ação · Ctrl+Shift+Z",
          disabled: !history.future.length,
          run: redo,
        },
        {
          id: "export",
          label: "Exportar projeto JSON",
          detail: "Ação · Ctrl+S",
          run: exportProject,
        },
        {
          id: "import",
          label: "Importar projeto JSON",
          detail: "Ação",
          run: () => inputRef.current?.click(),
        },
        {
          id: "analysis",
          label: "Abrir análise do projeto",
          detail: "Ação",
          run: () => {
            setTab("analysis");
            setRightOpen(true);
          },
        },
        {
          id: "help",
          label: "Abrir tutorial e ajuda",
          detail: "Ação · ?",
          run: () => setModal({ type: "help" }),
        },
        {
          id: "copy",
          label: "Copiar seleção",
          detail: "Ação · Ctrl+C",
          disabled: !selectedEquipmentCount,
          run: copySelection,
        },
        {
          id: "paste",
          label: "Colar equipamentos",
          detail: "Ação · Ctrl+V",
          disabled: !clipboard,
          run: pasteSelection,
        },
        {
          id: "duplicate",
          label: "Duplicar seleção",
          detail: "Ação · Ctrl+D",
          disabled: !selectedEquipmentCount,
          run: duplicate,
        },
        {
          id: "lock",
          label: "Bloquear posição",
          detail: "Ação · seleção",
          disabled: !selectedEquipmentCount,
          run: () => lockSelection(true),
        },
        {
          id: "unlock",
          label: "Desbloquear posição",
          detail: "Ação · seleção",
          disabled: !selectedEquipmentCount,
          run: () => lockSelection(false),
        },
        ...layoutActions.map((a, i) => ({
          id: `layout-${i}`,
          label: a.label,
          detail: "Ação · seleção",
          disabled: a.disabled,
          run: a.run,
        })),
        ...equipmentTypes.map((type) => ({
          id: `add-${type}`,
          label: `Adicionar ${catalog[type].name}`,
          detail: "Biblioteca de equipamentos",
          keywords: catalog[type].category,
          run: () => addEquipment(type),
        })),
        ...project.nodes.map((n) => ({
          id: `node-${n.id}`,
          label: n.label,
          detail: `Equipamento · ${catalog[n.type].name}`,
          keywords: n.parentId ? commandNodes?.get(n.parentId)?.label : "",
          run: () => focusItem(n.id),
        })),
        ...project.edges.map((e) => ({
          id: `edge-${e.id}`,
          label: e.label || "Cabo",
          detail: `Cabo · ${e.properties.section_mm2} mm²`,
          keywords: `${commandNodes?.get(e.from)?.label} ${commandNodes?.get(e.to)?.label}`,
          run: () => focusItem(e.id),
        })),
      ]
    : [];
  const renderTreeNode = (node: Project["nodes"][number], child = false) => {
    const children = searchQuery ? [] : (treeChildren.get(node.id) ?? []);
    return (
      <div key={node.id}>
        <div
          className={`tree-row ${child ? "child" : ""} ${selection.includes(node.id) ? "selected" : ""}`}
        >
          <button
            className="tree-element"
            onClick={(event) => selectTreeItem(event, node.id)}
            aria-pressed={selectionIds.has(node.id)}
          >
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
          children.map((n) => renderTreeNode(n, true))}
      </div>
    );
  };
  return (
    <div
      className={`workspace ${!leftOpen ? "left-closed" : ""} ${!rightOpen ? "right-closed" : ""}`}
      inert={tourActive}
    >
      <GuidedTour
        active={tourActive}
        onPrepare={prepareTour}
        onExit={finishTour}
        onError={tourError}
      />
      <header
        className="topbar"
        inert={backgroundBlocked}
        aria-hidden={backgroundBlocked || undefined}
      >
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
            className="secondary-button overview-button"
            aria-label="Visão geral dos projetos"
            title="Visão geral dos projetos"
            onClick={() => {
              setExportOpen(false);
              setOverviewOpen(true);
            }}
          >
            <FolderOpen size={16} />
          </button>
          <button
            className="secondary-button quick-search-button"
            aria-label="Busca rápida (Ctrl+K)"
            title="Busca rápida (Ctrl+K)"
            onClick={openPalette}
          >
            <Search size={15} />
            <span>Buscar</span>
            <kbd>Ctrl K</kbd>
          </button>
          <button
            className="secondary-button import-button"
            data-tour="import"
            aria-label="Importar projeto JSON"
            onClick={() => inputRef.current?.click()}
          >
            <ArrowUpFromLine size={15} />
            Importar
          </button>
          <div className="export-control" ref={exportRef} data-tour="export">
            <button
              className="primary-button"
              disabled={!!exportPreview}
              aria-expanded={exportOpen}
              aria-controls="export-options"
              onClick={() => setExportOpen((v) => !v)}
            >
              <ArrowDownToLine size={15} />
              Exportar
              <ChevronDown size={13} />
            </button>
            {exportOpen && (
              <div
                className="export-options"
                id="export-options"
                role="group"
                aria-label="Formatos de exportação"
              >
                <button
                  onClick={() => {
                    setExportOpen(false);
                    exportProject();
                  }}
                >
                  <strong>Projeto JSON</strong>
                  <small>Backup e edição em outro dispositivo</small>
                </button>
                <button
                  disabled={!project.nodes.length}
                  onClick={() => void exportVisual("png")}
                >
                  <strong>Diagrama PNG</strong>
                  <small>Imagem completa em alta resolução</small>
                </button>
                <button
                  disabled={!project.nodes.length}
                  onClick={() => void exportVisual("pdf")}
                >
                  <strong>Diagrama PDF</strong>
                  <small>Prévia, papel e orientação da página</small>
                </button>
                {!project.nodes.length && (
                  <p>Adicione um equipamento para exportar o diagrama.</p>
                )}
              </div>
            )}
          </div>
          <button
            className="avatar"
            title="Workspace local"
            onClick={() => setModal({ type: "help" })}
          >
            EN
          </button>
        </div>
      </header>
      <aside
        className="left-sidebar"
        data-tour="projects"
        inert={backgroundBlocked}
        aria-hidden={backgroundBlocked || undefined}
      >
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
            onChange={(e) => {
              setQuery(e.target.value);
              if (e.target.value.trim())
                setCollapsed((previous) =>
                  previous.includes("cables")
                    ? previous.filter((id) => id !== "cables")
                    : previous,
                );
            }}
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
          {searchQuery
            ? filteredNodes.map((n) => renderTreeNode(n))
            : project.nodes
                .filter((n) => !n.parentId)
                .map((n) => renderTreeNode(n))}
          {filteredNodes.length === 0 && filteredEdges.length === 0 && (
            <p className="tree-empty">
              {searchQuery
                ? "Nenhum elemento encontrado."
                : "Seu projeto começa aqui. Adicione um equipamento da biblioteca."}
            </p>
          )}
          {filteredEdges.length > 0 && (
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
                <span>{filteredEdges.length}</span>
              </button>
              {!collapsed.includes("cables") &&
                filteredEdges.map((e) => (
                  <button
                    className={`cable-tree-row ${selection.includes(e.id) ? "selected" : ""}`}
                    key={e.id}
                    onClick={(event) => selectTreeItem(event, e.id)}
                    aria-pressed={selectionIds.has(e.id)}
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
            Tutorial e tour<kbd>?</kbd>
          </button>
        </div>
      </aside>
      <main
        className="main-workspace"
        inert={backgroundBlocked}
        aria-hidden={backgroundBlocked || undefined}
      >
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
        <div className="library-bar" data-tour="library">
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
        <div className="canvas-controls-dock">
          <div className="canvas-toolbar" data-tour="tools">
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
                aria-label="Organizar seleção"
                title="Alinhar e distribuir equipamentos"
                disabled={movableCount < 2}
                aria-haspopup="menu"
                aria-expanded={actionMenu?.kind === "arrange"}
                onClick={(e) => {
                  const box = e.currentTarget.getBoundingClientRect();
                  setActionMenu(
                    actionMenu
                      ? null
                      : { x: box.left, y: box.bottom + 6, kind: "arrange" },
                  );
                }}
              >
                <Grid2X2 size={16} />
              </button>
              <button
                aria-label={
                  ownLocked ? "Desbloquear posição" : "Bloquear posição"
                }
                title={ownLocked ? "Desbloquear posição" : "Bloquear posição"}
                disabled={!selectedEquipmentCount}
                onClick={() => lockSelection(!ownLocked)}
              >
                {ownLocked ? (
                  <UnlockKeyhole size={16} />
                ) : (
                  <LockKeyhole size={16} />
                )}
              </button>
              <button
                title="Limpar seleção (Esc)"
                aria-label="Limpar seleção"
                onClick={() => setSelection([])}
              >
                <X size={16} />
              </button>
              <button
                aria-label="Destacar circuito completo"
                title="Destacar caminho da alimentação"
                disabled={!canTrace}
                aria-pressed={!!focusedCircuit}
                onClick={() => traceItem(selection[0])}
              >
                <Zap size={16} />
              </button>
            </div>
          )}
          {focusedCircuit && (
            <div className="circuit-focus-chip" role="status">
              <Zap size={14} />
              <span>
                Alimentação de <b>{focusedCircuit.label}</b> ·{" "}
                {focusedCircuit.nodes.size} equipamentos
              </span>
              <button
                aria-label="Sair do destaque do circuito"
                onClick={() => setCircuitId(null)}
              >
                <X size={15} />
              </button>
            </div>
          )}
          {selectedCable && (
            <div className="cable-actions-dock">
              <span>{selectedCable.label}</span>
              <button
                className="secondary-button"
                onClick={() => addCableBend(selectedCable.id)}
                disabled={(selectedCable.layout?.waypoints?.length ?? 0) >= 20}
              >
                Adicionar dobra
              </button>
              <button
                className="secondary-button"
                disabled={!selectedCable.layout}
                onClick={() => resetCable(selectedCable.id)}
              >
                Restaurar trajeto e rótulo
              </button>
              <small>Arraste o rótulo ou os pontos do cabo.</small>
            </div>
          )}
        </div>
        <div
          className={`canvas-area canvas-mode-${mode}`}
          ref={canvasRef}
          tabIndex={-1}
          aria-label="Área do diagrama"
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
            onContextMenu={showContextMenu}
            focusedCircuit={focusedCircuit}
            onMessage={notify}
          />

          {welcome && !modal && !tourActive && (
            <section className="welcome-card" aria-label="Boas-vindas ao AmpAI">
              <button
                className="icon-button welcome-close"
                aria-label="Dispensar boas-vindas"
                onClick={dismissWelcome}
              >
                <X size={17} />
              </button>
              <span className="section-eyebrow">
                SEU PRIMEIRO CIRCUITO COMEÇA AQUI
              </span>
              <h2>Conheça seu novo workspace.</h2>
              <p>
                Um passeio rápido pelos símbolos, conexões, cálculos e arquivos
                do seu projeto.
              </p>
              <button className="primary-button full-width" onClick={startTour}>
                Conhecer o editor <ChevronRight size={16} />
              </button>
              <div className="welcome-links">
                <button
                  onClick={() => {
                    dismissWelcome();
                    setModal({ type: "help" });
                  }}
                >
                  Ler o tutorial
                </button>
                <button onClick={dismissWelcome}>
                  Explorar por conta própria
                </button>
              </div>
            </section>
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
            <div className="zoom-control" data-tour="zoom">
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
                    includeHiddenNodes: true,
                    padding: {
                      top: "24px",
                      bottom: "65px",
                      x: "40px",
                    },
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
              data-tour="help"
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
            ) : analysis.issues.length ? (
              <>
                <CircleHelp size={12} />
                {analysis.issues.length}{" "}
                {analysis.issues.length === 1 ? "observação" : "observações"}
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
        inert={backgroundBlocked}
        project={project}
        analysis={analysis}
        onClose={() => setRightOpen(false)}
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
        onLocate={(id) => {
          setSelection([id]);
          focusNodes(selectionEquipmentIds(project, [id]));
        }}
        onTrace={traceItem}
        onResetCable={resetCable}
        onAddBend={addCableBend}
        selectedIds={selection}
        onBatchUpdate={batchUpdate}
        onLock={lockSelection}
      />
      {overviewOpen && (
        <ProjectsOverview
          projects={projects}
          activeId={activeId}
          onClose={() => setOverviewOpen(false)}
          onOpen={(id) => {
            selectProject(id);
            setOverviewOpen(false);
          }}
          onNew={() => {
            setOverviewOpen(false);
            setModal({ type: "create", name: "" });
          }}
          onRename={(id) => {
            const p = projects.find((p) => p.projectId === id)!;
            setOverviewOpen(false);
            setModal({ type: "rename", projectId: id, name: p.name });
          }}
          onExport={exportNamedProject}
        />
      )}
      {exportPreview && (
        <ExportPreview
          project={exportPreview.project}
          initialFormat={exportPreview.format}
          onClose={() => setExportPreview(null)}
          onExported={(message) => notify(message)}
        />
      )}
      {actionMenu && (
        <ActionMenu
          x={actionMenu.x}
          y={actionMenu.y}
          onClose={closeMenu}
          label={
            actionMenu.kind === "arrange"
              ? "Organizar seleção"
              : selectedCount
                ? "Ações da seleção"
                : "Área de trabalho"
          }
          actions={
            actionMenu.kind === "arrange"
              ? layoutActions
              : selectedCount
                ? [
                    {
                      label: "Editar propriedades",
                      run: () => {
                        setTab("properties");
                        setRightOpen(true);
                      },
                    },
                    {
                      label: "Renomear",
                      disabled: selectedCount !== 1,
                      run: renameSelected,
                    },
                    { label: "Enquadrar seleção", run: fitSelection },
                    {
                      label: "Copiar",
                      disabled: !selectedEquipmentCount,
                      run: copySelection,
                    },
                    {
                      label: "Duplicar",
                      disabled: !selectedEquipmentCount,
                      run: duplicate,
                    },
                    {
                      label: ownLocked
                        ? "Desbloquear posição"
                        : "Bloquear posição",
                      disabled: !selectedEquipmentCount,
                      run: () => lockSelection(!ownLocked),
                    },
                    ...layoutActions,
                    { label: "Excluir seleção", run: removeSelection },
                  ]
                : [
                    { label: "Adicionar equipamento…", run: openPalette },
                    {
                      label: "Colar equipamentos",
                      disabled: !clipboard,
                      run: pasteSelection,
                    },
                    {
                      label: "Enquadrar diagrama",
                      run: () =>
                        void flow?.fitView({
                          includeHiddenNodes: true,
                          padding: 0.2,
                          maxZoom: 1,
                          duration: 200,
                        }),
                    },
                  ]
          }
        />
      )}
      {paletteOpen && (
        <CommandPalette commands={commandList} onClose={closePalette} />
      )}
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
          inert={backgroundBlocked}
          aria-hidden={backgroundBlocked || undefined}
          role={toast.error ? "alert" : "status"}
        >
          {toast.error ? <CircleHelp size={17} /> : <Check size={17} />}
          <span>{toast.message}</span>
          {toast.action &&
            (!toast.action.projectId || toast.action.projectId === activeId) &&
            (!toast.action.undoSnapshot ||
              history.past.at(-1) === toast.action.undoSnapshot) && (
              <button
                className="toast-action"
                onClick={() => {
                  const action = toast.action;
                  setToast(null);
                  action?.run();
                }}
              >
                {toast.action.label}
              </button>
            )}
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
            ref={modalRef}
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
              <LearningCenter
                onTour={startTour}
                onClose={() => setModal(null)}
              />
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
                    placeholder="Ex.: Subestação · Unidade 02"
                    maxLength={100}
                    required
                    value={modal.name}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && modal.name.trim()) {
                        event.preventDefault();
                        submitModal();
                      }
                    }}
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
