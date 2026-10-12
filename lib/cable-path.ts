import { getSmoothStepPath, Position } from "@xyflow/react";
import type { CableLayout, Point, Project } from "./project";

/** Both the editor and export use this geometry; offsets never change electrical length. */
export function cablePath(source: Point, target: Point, layout?: CableLayout) {
  let path: string, labelX: number, labelY: number;
  let points = [source, target];
  if (!layout?.waypoints?.length) {
    [path, labelX, labelY] = getSmoothStepPath({
      sourceX: source.x,
      sourceY: source.y,
      targetX: target.x,
      targetY: target.y,
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
      borderRadius: 3,
      offset: 20,
    });
  } else {
    points = [source, { x: source.x, y: source.y + 20 }];
    for (const point of layout.waypoints) {
      points.push({ x: points.at(-1)!.x, y: point.y }, { ...point });
    }
    points.push(
      { x: points.at(-1)!.x, y: target.y - 20 },
      { x: target.x, y: target.y - 20 },
      target,
    );
    points = points.filter(
      (p, i, all) => !i || p.x !== all[i - 1].x || p.y !== all[i - 1].y,
    );
    path = points.map((p, i) => `${i ? "L" : "M"}${p.x},${p.y}`).join(" ");
    const lengths = points
      .slice(1)
      .map((p, i) => Math.abs(p.x - points[i].x) + Math.abs(p.y - points[i].y));
    let remaining = lengths.reduce((a, b) => a + b, 0) / 2;
    labelX = source.x;
    labelY = source.y;
    for (let i = 0; i < lengths.length; i++) {
      if (remaining <= lengths[i]) {
        const ratio = lengths[i] ? remaining / lengths[i] : 0;
        labelX = points[i].x + (points[i + 1].x - points[i].x) * ratio;
        labelY = points[i].y + (points[i + 1].y - points[i].y) * ratio;
        break;
      }
      remaining -= lengths[i];
    }
  }
  return {
    path,
    points,
    labelX: labelX + (layout?.labelOffset?.x ?? 0),
    labelY: labelY + (layout?.labelOffset?.y ?? 0),
  };
}

export function updateCableLayout(
  project: Project,
  id: string,
  layout?: CableLayout,
): Project {
  const old = project.edges.find((e) => e.id === id);
  if (!old || JSON.stringify(old.layout) === JSON.stringify(layout))
    return project;
  for (const p of layout?.waypoints ?? [])
    if (
      !Number.isFinite(p.x) ||
      !Number.isFinite(p.y) ||
      Math.abs(p.x) > 200000 ||
      Math.abs(p.y) > 200000
    )
      throw new Error("Ponto fora dos limites do desenho.");
  if ((layout?.waypoints?.length ?? 0) > 20)
    throw new Error("Cada cabo permite até 20 pontos de dobra.");
  if (
    layout?.labelOffset &&
    (!Number.isFinite(layout.labelOffset.x) ||
      !Number.isFinite(layout.labelOffset.y) ||
      Math.abs(layout.labelOffset.x) > 10000 ||
      Math.abs(layout.labelOffset.y) > 10000)
  )
    throw new Error("Rótulo fora dos limites do desenho.");
  return {
    ...project,
    edges: project.edges.map((e) => {
      if (e.id !== id) return e;
      const { layout: before, ...base } = e;
      return layout ? { ...base, layout } : base;
    }),
  };
}

export function shiftCableLayout(
  layout: CableLayout | undefined,
  dx: number,
  dy: number,
): CableLayout | undefined {
  return layout
    ? {
        ...layout,
        ...(layout.waypoints
          ? {
              waypoints: layout.waypoints.map((p) => ({
                x: Math.max(-200000, Math.min(200000, p.x + dx)),
                y: Math.max(-200000, Math.min(200000, p.y + dy)),
              })),
            }
          : {}),
        ...(layout.labelOffset
          ? { labelOffset: { ...layout.labelOffset } }
          : {}),
      }
    : undefined;
}
