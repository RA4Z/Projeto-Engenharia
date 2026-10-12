"use client";
import { createContext, useContext, useEffect } from "react";
import {
  getSmoothStepPath,
  useConnection,
  useStoreApi,
  type ConnectionLineComponentProps,
} from "@xyflow/react";
import type { EquipmentFlowNode } from "@/lib/canvas-state";

export type ConnectionPreview = {
  destinations: Map<string, string | null>;
  validate: (from: string, to: string) => string | null;
  destinationType: "source" | "target" | null;
};
export const ConnectionPreviewContext = createContext<ConnectionPreview | null>(
  null,
);

export function PreviewLine(
  props: ConnectionLineComponentProps<EquipmentFlowNode>,
) {
  const [path] = getSmoothStepPath({
    sourceX: props.fromX,
    sourceY: props.fromY,
    targetX: props.toX,
    targetY: props.toY,
    sourcePosition: props.fromPosition,
    targetPosition: props.toPosition,
  });
  return (
    <path
      d={path}
      fill="none"
      stroke={props.connectionStatus === "invalid" ? "#c74848" : "#21856b"}
      strokeWidth={2}
      strokeDasharray="6 4"
    />
  );
}

export function ConnectionHint() {
  const preview = useContext(ConnectionPreviewContext);
  const store = useStoreApi();
  useEffect(() => {
    const cancel = (event: KeyboardEvent) => {
      if (event.key === "Escape" && store.getState().connection.inProgress) {
        event.preventDefault();
        event.stopImmediatePropagation();
        store.getState().cancelConnection();
      }
    };
    window.addEventListener("keydown", cancel, true);
    return () => window.removeEventListener("keydown", cancel, true);
  }, [store]);
  // Select a scalar, so moving the pointer within a port does not rerender the hint.
  const message = useConnection((c) => {
    if (!c.inProgress) return null;
    if (!c.toNode)
      return "Escolha uma porta destacada para conectar. Esc cancela.";
    if (!c.toHandle || c.toHandle.type === c.fromHandle.type)
      return "Conecte uma saída a uma entrada.";
    const from = c.fromHandle.type === "source" ? c.fromNode.id : c.toNode.id;
    const to = c.fromHandle.type === "source" ? c.toNode.id : c.fromNode.id;
    return (
      preview?.validate(from, to) ??
      "Conexão permitida. Solte para criar o cabo."
    );
  });
  return message ? (
    <div className="connection-hint" role="status">
      {message}
    </div>
  ) : null;
}
