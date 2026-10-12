import type { Edge } from "@xyflow/react";
import type { EquipmentFlowNode } from "./canvas-state";
import type { Cable } from "./project";
import { equipmentSize } from "./geometry";

export type ViewBox = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};
/** Manual wires may cross the viewport while both endpoints are offscreen. */
export function canvasVisibility(
  nodes: EquipmentFlowNode[],
  edges: Edge[],
  view: ViewBox,
) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const boxes = new Map(
    nodes.map((n) => {
      const parent = n.parentId ? byId.get(n.parentId) : undefined;
      return [
        n.id,
        {
          x: n.position.x + (parent?.position.x ?? 0),
          y: n.position.y + (parent?.position.y ?? 0),
          ...equipmentSize(n.data.equipment.type),
        },
      ];
    }),
  );
  const intersects = (
    left: number,
    top: number,
    right: number,
    bottom: number,
  ) =>
    right >= view.left &&
    bottom >= view.top &&
    left <= view.right &&
    top <= view.bottom;
  const hiddenNodes = new Set(
    nodes
      .filter((n) => {
        const b = boxes.get(n.id)!;
        return (
          !n.selected && !intersects(b.x, b.y, b.x + b.width, b.y + b.height)
        );
      })
      .map((n) => n.id),
  );
  const hiddenEdges = new Set<string>();
  for (const e of edges) {
    if (e.selected) continue;
    const a = boxes.get(e.source),
      b = boxes.get(e.target);
    if (!a || !b) continue;
    const cable = e.data?.cable as Cable | undefined;
    const points = [
      { x: a.x + a.width / 2, y: a.y + a.height },
      { x: b.x + b.width / 2, y: b.y },
      ...(cable?.layout?.waypoints ?? []),
    ];
    let left = Math.min(...points.map((p) => p.x)) - 32,
      right = Math.max(...points.map((p) => p.x)) + 32,
      top = Math.min(...points.map((p) => p.y)) - 32,
      bottom = Math.max(...points.map((p) => p.y)) + 32;
    const offset = cable?.layout?.labelOffset;
    if (offset) {
      left = Math.min(left, left + offset.x - 200);
      right = Math.max(right, right + offset.x + 200);
      top = Math.min(top, top + offset.y - 20);
      bottom = Math.max(bottom, bottom + offset.y + 20);
    }
    if (!intersects(left, top, right, bottom)) hiddenEdges.add(e.id);
  }
  return { hiddenNodes, hiddenEdges };
}
