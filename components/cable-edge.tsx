"use client";
import {
  createContext,
  memo,
  useContext,
  useRef,
  useState,
  type PointerEvent,
  type KeyboardEvent,
} from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  useReactFlow,
  useStore,
  type EdgeProps,
} from "@xyflow/react";
import type { Cable, CableLayout, Point } from "@/lib/project";
import { cablePath } from "@/lib/cable-path";

export const CableEditingContext = createContext({
  canEdit: true,
  onChange: (_id: string, _layout?: CableLayout) => {},
  onError: (_message: string) => {},
  onSelect: (_id: string, _extend: boolean) => {},
});
export function useDiagramDetail() {
  return useStore((s) =>
    s.transform[2] < 0.45 ? 0 : s.transform[2] < 0.8 ? 1 : 2,
  );
}

function CableEdge(props: EdgeProps) {
  const cable = props.data?.cable as Cable;
  const editing = useContext(CableEditingContext);
  const flow = useReactFlow();
  const detail = useDiagramDetail();
  const controlZoom = useStore((s) =>
    props.selected ? Math.max(0.15, Math.round(s.transform[2] * 10) / 10) : 1,
  );
  const [draft, setDraft] = useState<CableLayout | null>(null);
  const drag = useRef<{
    pointerId: number;
    index: number | "label";
    start: Point;
    layout: CableLayout;
    next: CableLayout;
  } | null>(null);
  const layout = draft ?? cable.layout;
  const source = { x: props.sourceX, y: props.sourceY },
    target = { x: props.targetX, y: props.targetY };
  const drawing = cablePath(source, target, layout);
  const commit = (next?: CableLayout) => {
    try {
      editing.onChange(cable.id, next);
    } catch (error) {
      editing.onError(
        error instanceof Error
          ? error.message
          : "Não foi possível ajustar o cabo.",
      );
    }
  };
  const pointer = (event: PointerEvent<HTMLElement>) =>
    flow.screenToFlowPosition({ x: event.clientX, y: event.clientY });
  const begin = (event: PointerEvent<HTMLElement>, index: number | "label") => {
    if (!editing.canEdit || !props.selected || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const initial = cable.layout ?? {};
    drag.current = {
      pointerId: event.pointerId,
      index,
      start: pointer(event),
      layout: initial,
      next: initial,
    };
  };
  const move = (event: PointerEvent<HTMLElement>) => {
    const active = drag.current;
    if (!active || active.pointerId !== event.pointerId) return;
    const p = pointer(event),
      dx = p.x - active.start.x,
      dy = p.y - active.start.y;
    const bound = (v: number, limit: number) =>
      Math.max(-limit, Math.min(limit, Math.round(v)));
    active.next =
      active.index === "label"
        ? {
            ...active.layout,
            labelOffset: {
              x: bound((active.layout.labelOffset?.x ?? 0) + dx, 10000),
              y: bound((active.layout.labelOffset?.y ?? 0) + dy, 10000),
            },
          }
        : {
            ...active.layout,
            waypoints: active.layout.waypoints?.map((point, i) =>
              i === active.index
                ? {
                    x: bound(point.x + dx, 200000),
                    y: bound(point.y + dy, 200000),
                  }
                : point,
            ),
          };
    setDraft(active.next);
  };
  const finish = (event: PointerEvent<HTMLElement>, cancel = false) => {
    const active = drag.current;
    if (!active || active.pointerId !== event.pointerId) return;
    drag.current = null;
    setDraft(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    if (!cancel) commit(active.next);
  };
  const keyboard = (
    event: KeyboardEvent<HTMLElement>,
    index: number | "label",
  ) => {
    if (!editing.canEdit) return;
    if (event.key === "Escape") {
      drag.current = null;
      setDraft(null);
      return;
    }
    const step = event.shiftKey ? 10 : 1;
    if (["Delete", "Backspace"].includes(event.key) && index !== "label") {
      event.preventDefault();
      commit({
        ...cable.layout,
        waypoints: cable.layout?.waypoints?.filter((_, i) => i !== index),
      });
      return;
    }
    if (
      !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
    )
      return;
    event.preventDefault();
    event.stopPropagation();
    const dx =
      event.key === "ArrowRight" ? step : event.key === "ArrowLeft" ? -step : 0;
    const dy =
      event.key === "ArrowDown" ? step : event.key === "ArrowUp" ? -step : 0;
    if (index === "label")
      commit({
        ...cable.layout,
        labelOffset: {
          x: (cable.layout?.labelOffset?.x ?? 0) + dx,
          y: (cable.layout?.labelOffset?.y ?? 0) + dy,
        },
      });
    else
      commit({
        ...cable.layout,
        waypoints: cable.layout?.waypoints?.map((p, i) =>
          i === index ? { x: p.x + dx, y: p.y + dy } : p,
        ),
      });
  };
  const controls = (index: number | "label") => ({
    onPointerDown: (e: PointerEvent<HTMLElement>) => begin(e, index),
    onPointerMove: move,
    onPointerUp: (e: PointerEvent<HTMLElement>) => finish(e),
    onPointerCancel: (e: PointerEvent<HTMLElement>) => finish(e, true),
    onLostPointerCapture: () => {
      drag.current = null;
      setDraft(null);
    },
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => keyboard(e, index),
  });
  return (
    <>
      <BaseEdge
        id={props.id}
        path={drawing.path}
        style={props.style}
        interactionWidth={20}
      />
      <EdgeLabelRenderer>
        {(props.selected || detail > 0) && (
          <button
            type="button"
            className={`cable-label nodrag nopan ${props.selected ? "selected" : ""}`}
            data-cable-control="label"
            aria-label={`Rótulo de ${cable.label}`}
            title={
              props.selected && editing.canEdit
                ? "Arraste para reposicionar o rótulo; setas para ajuste fino"
                : String(props.label)
            }
            style={{
              transform: `translate(-50%, -50%) translate(${drawing.labelX}px, ${drawing.labelY}px)`,
              pointerEvents: "all",
              opacity: props.style?.opacity,
              ...(props.selected
                ? {
                    fontSize: 13 / controlZoom,
                    padding: `${4 / controlZoom}px ${7 / controlZoom}px`,
                    maxWidth: 320 / controlZoom,
                  }
                : {}),
            }}
            {...controls("label")}
            onClick={(e) => {
              e.stopPropagation();
              editing.onSelect(cable.id, e.ctrlKey || e.metaKey);
            }}
          >
            {detail === 1 && !props.selected
              ? cable.label
              : String(props.label)}
          </button>
        )}
        {props.selected &&
          editing.canEdit &&
          (layout?.waypoints ?? []).map((p, i) => (
            <button
              key={i}
              type="button"
              className="cable-waypoint nodrag nopan"
              data-cable-control="waypoint"
              aria-label={`Dobra ${i + 1} de ${cable.label}`}
              title="Arraste para ajustar; Delete remove esta dobra"
              style={{
                transform: `translate(-50%, -50%) translate(${p.x}px, ${p.y}px)`,
                pointerEvents: "all",
                width: 16 / controlZoom,
                height: 16 / controlZoom,
                borderWidth: 2 / controlZoom,
              }}
              {...controls(i)}
            />
          ))}
      </EdgeLabelRenderer>
    </>
  );
}
export default memo(CableEdge);
