import { Position, type NodeHandle } from "@xyflow/react";
import type { EquipmentType } from "./catalog";
import { equipmentSize } from "./geometry";

type CanvasGeometry = {
  initialWidth: number;
  initialHeight: number;
  handles: NodeHandle[];
};
const cache = new Map<EquipmentType, CanvasGeometry>();

/** Fallback geometry keeps wires available before an offscreen node is measured. */
export function canvasGeometry(type: EquipmentType): CanvasGeometry {
  const cached = cache.get(type);
  if (cached) return cached;
  const { width, height } = equipmentSize(type);
  const handles: NodeHandle[] = [];
  const handle = (
    id: string,
    kind: "source" | "target",
    x: number,
    y: number,
  ) =>
    handles.push({
      id,
      type: kind,
      position: kind === "source" ? Position.Bottom : Position.Top,
      x: x - 3.5,
      y: y - 3.5,
      width: 7,
      height: 7,
    });
  if (type !== "PANEL") {
    if (type !== "SOURCE" && type !== "GENERATOR")
      handle("in", "target", width / 2, type === "BUSBAR" ? 11 : 1);
    if (type === "BUSBAR") {
      [15, 38.3, 61.7, 85].forEach((percentage, index) =>
        handle(
          `out-${index + 1}`,
          "source",
          1 + ((width - 2) * percentage) / 100,
          height - 11,
        ),
      );
    } else if (type !== "LOAD" && type !== "MOTOR") {
      handle("out", "source", width / 2, height - 1);
    }
  }
  const geometry = { initialWidth: width, initialHeight: height, handles };
  cache.set(type, geometry);
  return geometry;
}
