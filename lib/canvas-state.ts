import {
  applyNodeChanges,
  applyEdgeChanges,
  type Node,
  type Edge,
  type NodeChange,
  type EdgeChange,
} from "@xyflow/react";
import type { Equipment, Project } from "./project";
import type { analyze, ElectricalResult } from "./calculations";
import { equipmentSize, parentsFirst, positionLockedIds } from "./geometry";
import { canvasGeometry } from "./canvas-geometry";

export type Analysis = ReturnType<typeof analyze>;
export type EquipmentFlowNode = Node<
  {
    equipment: Equipment;
    result?: ElectricalResult;
    warning: boolean;
    positionLocked?: boolean;
  },
  "equipment"
>;

function hasRepeatedIds(changes: { id?: string; item?: { id: string } }[]) {
  const ids = new Set<string>();
  for (const change of changes) {
    const id = change.id ?? change.item?.id;
    if (id === undefined) continue;
    if (ids.has(id)) return true;
    ids.add(id);
  }
  return false;
}

export function applySelectionChanges(
  previous: string[],
  changes: (NodeChange<EquipmentFlowNode> | EdgeChange<Edge>)[],
): string[] {
  const next = new Set(previous);
  for (const change of changes)
    if (change.type === "select") {
      if (change.selected) next.add(change.id);
      else next.delete(change.id);
    }
  return previous.length === next.size && previous.every((id) => next.has(id))
    ? previous
    : [...next];
}

// Ignore repeated measurements/positions instead of feeding identical state back to the store.
export function changeCanvasNodes(
  previous: EquipmentFlowNode[],
  changes: NodeChange<EquipmentFlowNode>[],
) {
  const nodes = new Map(previous.map((node) => [node.id, node]));
  const useful = changes.filter((change) => {
    const node = "id" in change ? nodes.get(change.id) : undefined;
    if (!node) return change.type === "add";
    if (change.type === "select")
      return Boolean(node.selected) !== change.selected;
    if (change.type === "position") if (node.draggable === false) return false;
    if (change.type === "position")
      return (
        (change.position &&
          (node.position.x !== change.position.x ||
            node.position.y !== change.position.y)) ||
        (change.dragging !== undefined &&
          Boolean(node.dragging) !== change.dragging)
      );
    if (change.type === "dimensions")
      return (
        (change.dimensions !== undefined &&
          (node.measured?.width !== change.dimensions.width ||
            node.measured?.height !== change.dimensions.height)) ||
        (change.resizing !== undefined &&
          Boolean(node.resizing) !== change.resizing) ||
        (change.dimensions !== undefined &&
          (change.setAttributes === true || change.setAttributes === "width") &&
          node.width !== change.dimensions.width) ||
        (change.dimensions !== undefined &&
          (change.setAttributes === true ||
            change.setAttributes === "height") &&
          node.height !== change.dimensions.height)
      );
    return true;
  });
  // Changes for the same node must retain their order. A later change can undo
  // an earlier one even when its value equals the state before the batch.
  return useful.length
    ? applyNodeChanges(
        hasRepeatedIds(changes)
          ? changes.filter(
              (c) =>
                c.type !== "position" || nodes.get(c.id)?.draggable !== false,
            )
          : useful,
        previous,
      )
    : previous;
}

export function changeCanvasEdges(
  previous: Edge[],
  changes: EdgeChange<Edge>[],
) {
  const edges = new Map(previous.map((edge) => [edge.id, edge]));
  const useful = changes.filter(
    (change) =>
      change.type !== "select" ||
      Boolean(edges.get(change.id)?.selected) !== change.selected,
  );
  return useful.length
    ? applyEdgeChanges(hasRepeatedIds(changes) ? changes : useful, previous)
    : previous;
}

export function syncCanvasNodes(
  previous: EquipmentFlowNode[],
  project: Project,
  analysis: Analysis,
  selection: string[],
) {
  const byId = new Map(previous.map((node) => [node.id, node]));
  const locked = positionLockedIds(project);
  const selected = new Set(selection),
    warnings = new Set(
      analysis.issues
        .filter((issue) => issue.severity === "warning")
        .map((issue) => issue.id),
    );
  const next = parentsFirst(project.nodes).map((equipment) => {
    const old = byId.get(equipment.id),
      result = analysis.nodeResults.get(equipment.id),
      warning = warnings.has(equipment.id),
      isSelected = selected.has(equipment.id);
    if (
      old &&
      old.data.equipment === equipment &&
      old.data.result === result &&
      old.data.warning === warning &&
      Boolean(old.selected) === isSelected &&
      old.position.x === equipment.position.x &&
      old.position.y === equipment.position.y &&
      old.parentId === equipment.parentId &&
      old.draggable === (locked.has(equipment.id) ? false : undefined) &&
      !old.dragging
    )
      return old;
    const style =
      old?.data.equipment.type === equipment.type
        ? old.style
        : equipmentSize(equipment.type);
    const { width, height } = equipmentSize(equipment.type);
    // Use the same child bounds in React Flow and in the JSON model.
    const extent: EquipmentFlowNode["extent"] = equipment.parentId
      ? [
          [0, 44],
          [(equipment.type === "BUSBAR" ? 320 : 440) + width, 430 + height],
        ]
      : undefined;
    return {
      ...old,
      id: equipment.id,
      type: "equipment" as const,
      position: equipment.position,
      parentId: equipment.parentId,
      extent,
      expandParent: false,
      draggable: locked.has(equipment.id) ? false : undefined,
      selected: isSelected,
      dragging: false,
      style,
      ...canvasGeometry(equipment.type),
      measured:
        old?.data.equipment.type === equipment.type &&
        old.measured?.width !== undefined &&
        old.measured?.height !== undefined
          ? old.measured
          : { width, height },
      data: {
        equipment,
        result,
        warning,
        positionLocked: locked.has(equipment.id),
      },
    };
  });
  return next.length === previous.length &&
    next.every((node, i) => node === previous[i])
    ? previous
    : next;
}

export function syncCanvasEdges(
  previous: Edge[],
  project: Project,
  selection: string[],
): Edge[] {
  const old = new Map(previous.map((edge) => [edge.id, edge]));
  const selected = new Set(selection),
    byId = new Map(project.nodes.map((node) => [node.id, node]));
  const next = project.edges.map((cable) => {
    const isSelected = selected.has(cable.id),
      edge = old.get(cable.id),
      sourceHandle =
        cable.sourceHandle ??
        (byId.get(cable.from)?.type === "BUSBAR" ? "out-1" : "out");
    const label = `${cable.label} · ${cable.properties.section_mm2} mm²`;
    if (
      edge &&
      edge.source === cable.from &&
      edge.target === cable.to &&
      edge.sourceHandle === sourceHandle &&
      edge.label === label &&
      Boolean(edge.selected) === isSelected &&
      edge.style?.strokeWidth === (isSelected ? 2.4 : 1.5) &&
      edge.labelStyle?.fill === (isSelected ? "#187a60" : "#788486")
    )
      return edge;
    return {
      id: cable.id,
      source: cable.from,
      target: cable.to,
      sourceHandle,
      targetHandle: "in",
      type: "smoothstep",
      selected: isSelected,
      label,
      style: {
        stroke: isSelected ? "#21856b" : "#809497",
        strokeWidth: isSelected ? 2.4 : 1.5,
      },
      labelStyle: { fontSize: 10, fill: isSelected ? "#187a60" : "#788486" },
      labelBgStyle: { fill: "#f9fbf9", fillOpacity: 0.95 },
      labelBgPadding: [5, 3] as [number, number],
      labelBgBorderRadius: 4,
      pathOptions: { borderRadius: 3, offset: 20 },
    };
  });
  return next.length === previous.length &&
    next.every((edge, i) => edge === previous[i])
    ? previous
    : next;
}
