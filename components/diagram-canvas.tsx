"use client";
import {
  memo,
  useCallback,
  useLayoutEffect,
  useRef,
  useMemo,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  MiniMap,
  type Connection,
  type Edge,
  type OnNodeDrag,
  type SelectionDragHandler,
  type OnMove,
  type ReactFlowInstance,
  type Viewport,
  useConnection,
  useStore,
  type NodeMouseHandler,
  type EdgeMouseHandler,
} from "@xyflow/react";
import { createConnectionValidator, type Project } from "@/lib/project";
import {
  ConnectionPreviewContext,
  ConnectionHint,
  PreviewLine,
} from "./connection-preview";
import { finishEquipmentDrag } from "@/lib/geometry";
import type { Analysis, EquipmentFlowNode } from "@/lib/canvas-state";
import { useCanvasState } from "./use-canvas-state";
import EquipmentNode from "./equipment-node";
import CableEdge, { CableEditingContext } from "./cable-edge";
import { updateCableLayout } from "@/lib/cable-path";
import type { CableLayout } from "@/lib/project";
import type { feedingCircuit } from "@/lib/circuit-focus";
import { canvasVisibility } from "@/lib/canvas-visibility";

const nodeTypes = { equipment: EquipmentNode };
const edgeTypes = { engineering: CableEdge };
const snapGrid: [number, number] = [20, 20];
const panButtons = [0, 1],
  selectionButtons = [1],
  selectionKeys = ["Control", "Meta"];
const lineStyle = { stroke: "#21856b", strokeWidth: 2 };
const proOptions = { hideAttribution: false };
const minimapColor = (node: EquipmentFlowNode) =>
  node.data.equipment.type === "PANEL" ? "#dbece4" : "#668f7e";
type Props = {
  project: Project;
  analysis: Analysis;
  selection: string[];
  onSelection: Dispatch<SetStateAction<string[]>>;
  mode: "select" | "pan" | "connect";
  snap: boolean;
  showMap: boolean;
  onInit: (instance: ReactFlowInstance<EquipmentFlowNode, Edge>) => void;
  onConnect: (connection: Connection) => void;
  onCommit: (project: Project) => void;
  onProperties: () => void;
  onZoom: (zoom: number) => void;
  onViewport: (projectId: string, viewport: Viewport) => void;
  onContextMenu: (x: number, y: number, id?: string) => void;
  focusedCircuit?: ReturnType<typeof feedingCircuit> | null;
  onMessage: (message: string, error?: boolean) => void;
};

function DiagramCanvas(props: Props) {
  const { project, analysis, selection, onSelection, mode, snap, showMap } =
    props;
  const state = useCanvasState(project, analysis, selection, onSelection);
  const manualCulling =
    project.nodes.length > 200 &&
    project.edges.some(
      (e) =>
        e.layout?.waypoints?.length ||
        e.layout?.labelOffset?.x ||
        e.layout?.labelOffset?.y,
    );
  const visibleBox = useStore((s) => {
    if (!manualCulling) return "";
    const [x, y, z] = s.transform;
    return [
      Math.floor((-x / z - 256) / 128) * 128,
      Math.floor((-y / z - 256) / 128) * 128,
      Math.ceil(((s.width - x) / z + 256) / 128) * 128,
      Math.ceil(((s.height - y) / z + 256) / 128) * 128,
    ].join(",");
  });
  const visibility = useMemo(() => {
    if (!visibleBox) return null;
    const [left, top, right, bottom] = visibleBox.split(",").map(Number);
    return canvasVisibility(state.nodes, state.edges, {
      left,
      top,
      right,
      bottom,
    });
  }, [state.nodes, state.edges, visibleBox]);
  const validate = useMemo(
    () => createConnectionValidator(project),
    [project.nodes, project.edges],
  );
  const start = useConnection((c) =>
    c.inProgress ? `${c.fromHandle.type}:${c.fromNode.id}` : null,
  );
  const preview = useMemo(() => {
    const destinations = new Map<string, string | null>();
    if (start) {
      const split = start.indexOf(":"),
        type = start.slice(0, split),
        id = start.slice(split + 1);
      for (const node of project.nodes) {
        if (
          type === "source"
            ? ["PANEL", "SOURCE", "GENERATOR"].includes(node.type)
            : ["PANEL", "MOTOR", "LOAD"].includes(node.type)
        )
          continue;
        if (node.id !== id)
          destinations.set(
            node.id,
            type === "source" ? validate(id, node.id) : validate(node.id, id),
          );
      }
    }
    return {
      destinations,
      validate,
      destinationType: start
        ? start.startsWith("source:")
          ? ("target" as const)
          : ("source" as const)
        : null,
    };
  }, [start, validate, project.nodes]);
  const isValidConnection = useCallback(
    (connection: Connection | Edge) =>
      Boolean(
        connection.source &&
        connection.target &&
        !validate(connection.source, connection.target),
      ),
    [validate],
  );
  const latest = useRef(props);
  const dragging = useRef(false);
  useLayoutEffect(() => {
    latest.current = props;
  }, [props]);
  const changeCable = useCallback((id: string, layout?: CableLayout) => {
    const p = latest.current.project;
    latest.current.onCommit(updateCableLayout(p, id, layout));
  }, []);
  const selectCable = useCallback((id: string, extend: boolean) => {
    if (latest.current.mode === "pan") return;
    latest.current.onSelection((previous) =>
      extend
        ? previous.includes(id)
          ? previous.filter((value) => value !== id)
          : [...previous, id]
        : [id],
    );
    latest.current.onProperties();
  }, []);
  const editing = useMemo(
    () => ({
      canEdit: mode === "select",
      onChange: changeCable,
      onSelect: selectCable,
      onError: (message: string) => latest.current.onMessage(message, true),
    }),
    [mode, changeCable, selectCable],
  );
  const visualCache = useMemo(
    () => ({
      nodes: new WeakMap<EquipmentFlowNode, EquipmentFlowNode>(),
      edges: new WeakMap<Edge, Edge>(),
    }),
    [props.focusedCircuit],
  );
  const focusedNodes = useMemo(
    () =>
      !props.focusedCircuit && !visibility
        ? state.nodes
        : state.nodes.map((node) => {
            const old = visualCache.nodes.get(node);
            const hidden = visibility?.hiddenNodes.has(node.id) ?? false;
            if (old && Boolean(old.hidden) === hidden) return old;
            const active =
              !props.focusedCircuit ||
              props.focusedCircuit.nodes.has(node.id) ||
              props.focusedCircuit.panels.has(node.id);
            const next = {
              ...node,
              hidden,
              style: { ...node.style, opacity: active ? 1 : 0.25 },
            };
            visualCache.nodes.set(node, next);
            return next;
          }),
    [state.nodes, props.focusedCircuit, visualCache, visibility],
  );
  const focusedEdges = useMemo(
    () =>
      !props.focusedCircuit && !visibility
        ? state.edges
        : state.edges.map((edge) => {
            const old = visualCache.edges.get(edge);
            const hidden = visibility?.hiddenEdges.has(edge.id) ?? false;
            if (old && Boolean(old.hidden) === hidden) return old;
            const active =
              !props.focusedCircuit || props.focusedCircuit.edges.has(edge.id);
            const next = {
              ...edge,
              hidden,
              style: {
                ...edge.style,
                opacity: active ? 1 : 0.15,
                ...(active && props.focusedCircuit
                  ? { stroke: "#136e53", strokeWidth: 3 }
                  : {}),
              },
            };
            visualCache.edges.set(edge, next);
            return next;
          }),
    [state.edges, props.focusedCircuit, visualCache, visibility],
  );
  const onInit = useCallback(
    (instance: ReactFlowInstance<EquipmentFlowNode, Edge>) =>
      latest.current.onInit(instance),
    [],
  );
  const onConnect = useCallback(
    (connection: Connection) => latest.current.onConnect(connection),
    [],
  );
  const onClick = useCallback(() => latest.current.onProperties(), []);
  const onNodeContextMenu = useCallback<NodeMouseHandler<EquipmentFlowNode>>(
    (event, node) => {
      event.preventDefault();
      latest.current.onContextMenu(event.clientX, event.clientY, node.id);
    },
    [],
  );
  const onEdgeContextMenu = useCallback<EdgeMouseHandler>((event, edge) => {
    event.preventDefault();
    latest.current.onContextMenu(event.clientX, event.clientY, edge.id);
  }, []);
  const onPaneClick = useCallback(
    () =>
      latest.current.onSelection((previous) =>
        previous.length ? [] : previous,
      ),
    [],
  );
  const onDragStart = useCallback(() => {
    dragging.current = true;
  }, []);
  const finishDrag = useCallback((draggedNodes: EquipmentFlowNode[]) => {
    if (!dragging.current) return;
    dragging.current = false;
    const current = latest.current.project;
    const next = finishEquipmentDrag(current, draggedNodes);
    if (next !== current) latest.current.onCommit(next);
  }, []);
  const onDragStop = useCallback<OnNodeDrag<EquipmentFlowNode>>(
    (_, node, draggedNodes) =>
      finishDrag(draggedNodes.length ? draggedNodes : [node]),
    [finishDrag],
  );
  const onSelectionDragStop = useCallback<
    SelectionDragHandler<EquipmentFlowNode>
  >((_, nodes) => finishDrag(nodes), [finishDrag]);
  const onMove = useCallback<OnMove>(
    (_, viewport) => latest.current.onZoom(viewport.zoom),
    [],
  );
  const onMoveEnd = useCallback<OnMove>(
    (_, viewport) =>
      latest.current.onViewport(latest.current.project.projectId, viewport),
    [],
  );
  return (
    <ConnectionPreviewContext.Provider value={preview}>
      <CableEditingContext.Provider value={editing}>
        <ReactFlow<EquipmentFlowNode, Edge>
          nodes={focusedNodes}
          edges={focusedEdges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onlyRenderVisibleElements={
            project.nodes.length > 200 && !manualCulling
          }
          onInit={onInit}
          onNodesChange={state.onNodesChange}
          onEdgesChange={state.onEdgesChange}
          onConnect={onConnect}
          isValidConnection={isValidConnection}
          connectionLineComponent={PreviewLine}
          onNodeContextMenu={onNodeContextMenu}
          onEdgeContextMenu={onEdgeContextMenu}
          onPaneContextMenu={(event) => {
            event.preventDefault();
            latest.current.onContextMenu(event.clientX, event.clientY);
          }}
          onNodeClick={onClick}
          onEdgeClick={onClick}
          onPaneClick={onPaneClick}
          onNodeDragStart={onDragStart}
          onNodeDragStop={onDragStop}
          onSelectionDragStart={onDragStart}
          onSelectionDragStop={onSelectionDragStop}
          onMove={onMove}
          onMoveEnd={onMoveEnd}
          snapToGrid={snap}
          snapGrid={snapGrid}
          nodesDraggable={mode === "select"}
          nodesConnectable={mode !== "pan"}
          elementsSelectable={mode !== "pan"}
          panOnDrag={mode === "pan" ? panButtons : selectionButtons}
          selectionOnDrag={mode === "select"}
          selectionKeyCode="Shift"
          multiSelectionKeyCode={selectionKeys}
          deleteKeyCode={null}
          minZoom={0.15}
          maxZoom={2.5}
          zoomOnDoubleClick={false}
          connectionRadius={28}
          connectionLineStyle={lineStyle}
          proOptions={proOptions}
        >
          <ConnectionHint />
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1}
            color="#d4ddd8"
          />
          {showMap && (
            <MiniMap<EquipmentFlowNode>
              pannable
              zoomable
              nodeColor={minimapColor}
              nodeStrokeColor="#9cb8ab"
              maskColor="rgba(243,246,243,0.65)"
            />
          )}
        </ReactFlow>
      </CableEditingContext.Provider>
    </ConnectionPreviewContext.Provider>
  );
}
export default memo(DiagramCanvas);
