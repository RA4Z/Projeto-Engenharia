"use client";
import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { Edge, EdgeChange, NodeChange } from "@xyflow/react";
import type { Project } from "@/lib/project";
import {
  applySelectionChanges,
  changeCanvasNodes,
  changeCanvasEdges,
  syncCanvasNodes,
  syncCanvasEdges,
  type Analysis,
  type EquipmentFlowNode,
} from "@/lib/canvas-state";

export function useCanvasState(
  project: Project,
  analysis: Analysis,
  selection: string[],
  onSelection: Dispatch<SetStateAction<string[]>>,
) {
  const [nodes, setNodes] = useState(() =>
    syncCanvasNodes([], project, analysis, selection),
  );
  const [edges, setEdges] = useState(() =>
    syncCanvasEdges([], project, selection),
  );
  const selectionCallback = useRef(onSelection);
  useLayoutEffect(() => {
    selectionCallback.current = onSelection;
  }, [onSelection]);
  // Durable graph edits are synchronized independently of transient pointer movement.
  useLayoutEffect(() => {
    setNodes((previous) =>
      syncCanvasNodes(previous, project, analysis, selection),
    );
  }, [project.nodes, analysis]);
  useLayoutEffect(() => {
    setEdges((previous) => syncCanvasEdges(previous, project, selection));
  }, [project.edges, project.nodes, selection]);
  useLayoutEffect(() => {
    const selected = new Set(selection);
    setNodes((previous) => {
      const next = previous.map((node) =>
        Boolean(node.selected) === selected.has(node.id)
          ? node
          : { ...node, selected: selected.has(node.id) },
      );
      return next.every((node, i) => node === previous[i]) ? previous : next;
    });
  }, [selection]);
  const onNodesChange = useCallback(
    (changes: NodeChange<EquipmentFlowNode>[]) => {
      setNodes((previous) => changeCanvasNodes(previous, changes));
      if (changes.some((change) => change.type === "select"))
        selectionCallback.current((previous) =>
          applySelectionChanges(previous, changes),
        );
    },
    [],
  );
  const onEdgesChange = useCallback((changes: EdgeChange<Edge>[]) => {
    setEdges((previous) => changeCanvasEdges(previous, changes));
    if (changes.some((change) => change.type === "select"))
      selectionCallback.current((previous) =>
        applySelectionChanges(previous, changes),
      );
  }, []);
  return { nodes, edges, onNodesChange, onEdgesChange };
}
