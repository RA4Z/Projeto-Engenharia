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

const nodeTypes = { equipment: EquipmentNode };
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
};

function DiagramCanvas(props: Props) {
  const { project, analysis, selection, onSelection, mode, snap, showMap } =
    props;
  const state = useCanvasState(project, analysis, selection, onSelection);
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
      <ReactFlow<EquipmentFlowNode, Edge>
        nodes={state.nodes}
        edges={state.edges}
        nodeTypes={nodeTypes}
        onlyRenderVisibleElements={project.nodes.length > 200}
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
    </ConnectionPreviewContext.Provider>
  );
}
export default memo(DiagramCanvas);
