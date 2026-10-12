"use client";
import {
  memo,
  useCallback,
  useLayoutEffect,
  useRef,
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
} from "@xyflow/react";
import type { Project } from "@/lib/project";
import { finishEquipmentDrag } from "@/lib/geometry";
import type { Analysis, EquipmentFlowNode } from "@/lib/canvas-state";
import { useCanvasState } from "./use-canvas-state";
import EquipmentNode from "./equipment-node";

const nodeTypes = { equipment: EquipmentNode };
const snapGrid: [number, number] = [20, 20];
const panButtons = [0, 1, 2],
  selectionButtons = [1, 2],
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
};

function DiagramCanvas(props: Props) {
  const { project, analysis, selection, onSelection, mode, snap, showMap } =
    props;
  const state = useCanvasState(project, analysis, selection, onSelection);
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
    <ReactFlow<EquipmentFlowNode, Edge>
      nodes={state.nodes}
      edges={state.edges}
      nodeTypes={nodeTypes}
      onInit={onInit}
      onNodesChange={state.onNodesChange}
      onEdgesChange={state.onEdgesChange}
      onConnect={onConnect}
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
  );
}
export default memo(DiagramCanvas);
