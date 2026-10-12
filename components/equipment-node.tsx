"use client";
import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { catalog } from "@/lib/catalog";
import type { EquipmentFlowNode } from "@/lib/canvas-state";
import { number } from "@/lib/calculations";
import Symbol from "./symbol";

function EquipmentNode({ data, selected }: NodeProps<EquipmentFlowNode>) {
  const { equipment: n, result, warning } = data;
  const definition = catalog[n.type];
  if (n.type === "PANEL")
    return (
      <div className={`panel-node ${selected ? "is-selected" : ""}`}>
        <div className="panel-node-header">
          <span className="panel-node-title">
            <Symbol type="PANEL" size={20} />
            {n.label}
          </span>
          <span>
            {number(Number(n.properties.voltage_v), 0)} V ·{" "}
            {Number(n.properties.phases) === 3 ? "3Φ" : "1Φ"}
          </span>
        </div>
        <div className="panel-node-caption">PAINEL DE DISTRIBUIÇÃO</div>
      </div>
    );
  const descriptor =
    n.type === "TRANSFORMER" || n.type === "GENERATOR"
      ? `${number(Number(n.properties.power_kva), 0)} kVA`
      : ["MOTOR", "LOAD"].includes(n.type)
        ? `${number(Number(n.properties.power_kw), 0)} kW · ${Number(n.properties.phases) === 3 ? "3Φ" : "1Φ"}`
        : ["CIRCUIT_BREAKER", "SWITCH", "BUSBAR", "TIE"].includes(n.type)
          ? `${number(Number(n.properties.nominal_current_a), 0)} A`
          : Number(n.properties.voltage_v) < 1000
            ? `${number(Number(n.properties.voltage_v), 0)} V`
            : `${number(Number(n.properties.voltage_v) / 1000, 1)} kV`;
  return (
    <div
      className={`equipment-node ${n.type === "BUSBAR" ? "busbar-node" : ""} ${selected ? "is-selected" : ""} ${warning ? "has-warning" : ""}`}
      style={{ "--symbol-color": definition.color } as React.CSSProperties}
    >
      {!["SOURCE", "GENERATOR"].includes(n.type) && (
        <Handle
          type="target"
          position={Position.Top}
          id="in"
          aria-label={`Entrada de ${n.label}`}
        />
      )}
      <div className="node-symbol">
        {n.type === "BUSBAR" ? (
          <svg
            width="300"
            height="38"
            viewBox="0 0 300 38"
            fill="none"
            stroke="currentColor"
          >
            <path d="M150 0v19" strokeWidth="2" />
            <path d="M0 19h300" strokeWidth="4" />
            <path d="M45 19v19M115 19v19M185 19v19M255 19v19" strokeWidth="2" />
          </svg>
        ) : (
          <Symbol type={n.type} size={56} />
        )}
      </div>
      <div className="node-label">
        {n.label}
        {warning && (
          <span
            className="node-warning"
            title="Vérifique as observações do circuito"
          >
            !
          </span>
        )}
      </div>
      <div className="node-detail">
        {descriptor}
        {["MOTOR", "LOAD"].includes(n.type) && result ? (
          <span> · {number(result.current)} A</span>
        ) : null}
      </div>
      {!["MOTOR", "LOAD"].includes(n.type) &&
        (n.type === "BUSBAR" ? (
          [15, 38.3, 61.7, 85].map((left, i) => (
            <Handle
              key={i}
              type="source"
              position={Position.Bottom}
              id={`out-${i + 1}`}
              style={{ left: `${left}%` }}
              aria-label={`Saída ${i + 1} de ${n.label}`}
            />
          ))
        ) : (
          <Handle
            type="source"
            position={Position.Bottom}
            id="out"
            aria-label={`Saída de ${n.label}`}
          />
        ))}
    </div>
  );
}

export default memo(EquipmentNode);
