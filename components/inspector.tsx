"use client";
import { useEffect, useState } from "react";
import {
  ChevronDown,
  Copy,
  Info,
  SlidersHorizontal,
  Trash2,
  X,
  Zap,
  TriangleAlert,
  Cable as CableIcon,
} from "lucide-react";
import {
  cableFields,
  catalog,
  type Field,
  type Properties,
} from "@/lib/catalog";
import { number, type ElectricalResult } from "@/lib/calculations";
import type { Analysis } from "@/lib/canvas-state";
import type { Cable, Equipment, Project } from "@/lib/project";
import Symbol from "./symbol";

function PropertyField({
  field,
  value,
  onChange,
}: {
  field: Field;
  value: number | string;
  onChange: (value: number | string) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  const [invalid, setInvalid] = useState(false);
  useEffect(() => {
    setDraft(String(value));
    setInvalid(false);
  }, [value]);
  return (
    <label className="property-field">
      <span>{field.label}</span>
      {field.options ? (
        <div className="select-wrap">
          <select
            aria-label={field.label}
            value={String(value)}
            onChange={(e) =>
              onChange(
                field.options!.find((o) => String(o.value) === e.target.value)!
                  .value,
              )
            }
          >
            {field.options.map((o) => (
              <option value={String(o.value)} key={String(o.value)}>
                {o.label}
              </option>
            ))}
          </select>
          <ChevronDown size={13} />
        </div>
      ) : (
        <div className={`number-input ${invalid ? "invalid" : ""}`}>
          <input
            aria-label={field.label}
            type="number"
            value={draft}
            min={field.min}
            max={field.max}
            step={field.step ?? "any"}
            onChange={(e) => {
              setDraft(e.target.value);
              setInvalid(false);
            }}
            onBlur={() => {
              const v = Number(draft);
              if (
                draft.trim() === "" ||
                !Number.isFinite(v) ||
                (field.min !== undefined && v < field.min) ||
                (field.max !== undefined && v > field.max) ||
                (field.key === "parallel_runs" && !Number.isInteger(v))
              ) {
                setInvalid(true);
                setDraft(String(value));
              } else onChange(v);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
          />
          {field.unit && <span>{field.unit}</span>}
        </div>
      )}
      {invalid && (
        <small className="field-error">
          {field.key === "parallel_runs"
            ? "Informe um número inteiro"
            : "Informe um valor"}{" "}
          entre {field.min} e {field.max}.
        </small>
      )}
    </label>
  );
}
function ResultRows({ result }: { result: ElectricalResult }) {
  return (
    <div className="result-rows">
      <div>
        <span>Potência ativa</span>
        <b>
          {number(result.active)} <small>kW</small>
        </b>
      </div>
      <div>
        <span>Potência aparente</span>
        <b>
          {number(result.apparent)} <small>kVA</small>
        </b>
      </div>
      <div>
        <span>Potência reativa</span>
        <b>
          {number(result.reactive)} <small>kvar</small>
        </b>
      </div>
      <div>
        <span>Fator de potência</span>
        <b>{number(result.factor, 3)}</b>
      </div>
      <div className="highlight-result">
        <span>Corrente calculada</span>
        <b>
          {number(result.current)} <small>A</small>
        </b>
      </div>
    </div>
  );
}
export default function Inspector({
  project,
  analysis,
  selection,
  selectionSummary,
  tab,
  onTab,
  onUpdate,
  onDelete,
  onDuplicate,
  onParent,
  onClear,
  onSelect,
  onClose,
}: {
  project: Project;
  analysis: Analysis;
  selection: string | null;
  selectionSummary?: { equipment: number; cables: number };
  tab: "properties" | "analysis";
  onTab: (tab: "properties" | "analysis") => void;
  onUpdate: (
    id: string,
    patch: { label?: string; properties?: Properties },
  ) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onParent: (id: string, parentId: string) => void;
  onClear: () => void;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const node = project.nodes.find((n) => n.id === selection),
    edge = project.edges.find((e) => e.id === selection);
  const item: Equipment | Cable | undefined = node ?? edge;
  const [label, setLabel] = useState(item?.label ?? "");
  useEffect(() => setLabel(item?.label ?? ""), [item?.id, item?.label]);
  const fields = node ? catalog[node.type].fields : cableFields;
  const result = node
    ? analysis.nodeResults.get(node.id)
    : edge
      ? analysis.cables.get(edge.id)
      : undefined;
  return (
    <aside className="inspector" data-tour="inspector">
      <div className="inspector-tabs">
        <button
          className={tab === "properties" ? "active" : ""}
          onClick={() => onTab("properties")}
        >
          <SlidersHorizontal size={14} />
          Propriedades
        </button>
        <button
          className={tab === "analysis" ? "active" : ""}
          onClick={() => onTab("analysis")}
        >
          <Zap size={14} />
          Análise
          {analysis.issues.length > 0 && (
            <span className="count-badge">{analysis.issues.length}</span>
          )}
        </button>
        <button
          className="inspector-close"
          aria-label="Fechar propriedades"
          title="Fechar painel de propriedades"
          onClick={onClose}
        >
          <X size={16} />
        </button>
      </div>
      <div className="inspector-scroll">
        {tab === "analysis" ? (
          <>
            <div className="section-eyebrow">VISÃO DO PROJETO</div>
            <h2 className="inspector-heading">Tudo conectado.</h2>
            <p className="muted-text">
              Os resultados acompanham cada alteração do seu diagrama.
            </p>
            <div className="analysis-total">
              <span>Demanda ativa total</span>
              <strong>
                {number(analysis.total.active)}
                <small> kW</small>
              </strong>
              <span>{analysis.loads} cargas no projeto</span>
            </div>
            <div className="result-rows">
              <div>
                <span>Potência instalada elétrica</span>
                <b>
                  {number(analysis.installed)} <small>kW</small>
                </b>
              </div>
              <div>
                <span>Demanda aparente</span>
                <b>
                  {number(analysis.total.apparent)} <small>kVA</small>
                </b>
              </div>
              <div>
                <span>Demanda reativa</span>
                <b>
                  {number(analysis.total.reactive)} <small>kvar</small>
                </b>
              </div>
              <div>
                <span>Fator de potência global</span>
                <b>{number(analysis.total.factor, 3)}</b>
              </div>
            </div>
            <div className="section-title">
              Observações <span>{analysis.issues.length}</span>
            </div>
            {analysis.issues.length === 0 ? (
              <div className="all-clear">
                <Zap size={16} />
                Sem inconsistências topológicas ou de capacidade detectadas.
              </div>
            ) : (
              analysis.issues.map((issue, i) => (
                <button
                  className={`issue ${issue.severity}`}
                  key={`${issue.id}-${i}`}
                  onClick={() => onSelect(issue.id)}
                >
                  {issue.severity === "warning" ? (
                    <TriangleAlert size={16} />
                  ) : (
                    <Info size={16} />
                  )}
                  <span>{issue.message}</span>
                </button>
              ))
            )}
            <div className="section-title">
              Circuitos <span>{project.edges.length}</span>
            </div>
            <div className="circuit-table">
              {project.edges.map((e) => {
                const r = analysis.cables.get(e.id)!;
                return (
                  <button key={e.id} onClick={() => onSelect(e.id)}>
                    <span>
                      <b>{e.label}</b>
                      <small>
                        {project.nodes.find((n) => n.id === e.to)?.label}
                      </small>
                    </span>
                    <span>
                      {number(r.current)} A
                      <small>ΔU {number(r.dropPercent, 2)}%</small>
                    </span>
                  </button>
                );
              })}
            </div>
            <details className="calculation-method">
              <summary>Premissas e fórmulas</summary>
              <p>
                Circuitos radiais em CA, cargas indutivas e sistema trifásico
                equilibrado. Valores de demanda incluem cargas desconectadas.
              </p>
              <p>
                Motores: P = P<sub>eixo</sub> × demanda / η. Cargas: P = P
                <sub>nominal</sub> × demanda. Q = P × tan(acos(fp)); S = √(P² +
                Q²).
              </p>
              <p>
                I = S × 1000 / (√3 × V) em três fases; I = S × 1000 / V em uma
                fase. Transformadores ideais, sem perdas.
              </p>
              <p>
                ΔU = k × I × L × (R × fp + X × senφ). k = √3 (trifásico) ou 2
                (monofásico). R = ρ₂₀[1 + α(T − 20)] / (seção × paralelos), em
                Ω/m. X é informado em Ω/km, dividido por 1000 e pelos paralelos.
              </p>
              <p>
                ρ₂₀: Cu 0,017241; Al 0,028264 Ω·mm²/m. α: Cu 0,00393; Al 0,00403
                /°C. Queda de tensão por trecho; não acumulada.
              </p>
              <p>
                Estimativas de regime permanente. Ampacidade, curto-circuito,
                seletividade e conformidade normativa não são calculados.
              </p>
              <a
                href="https://www.electrical-installation.org/enwiki/Calculation_of_voltage_drop_in_steady_load_conditions"
                target="_blank"
                rel="noreferrer"
              >
                Referência das fórmulas de queda de tensão ↗
              </a>
            </details>
          </>
        ) : selectionSummary ? (
          <>
            <div className="section-eyebrow">SELEÇÃO MÚLTIPLA</div>
            <h2 className="inspector-heading">Edite o conjunto.</h2>
            <p className="muted-text">
              Mova os itens juntos, copie ou duplique a seleção. Selecione um
              único item para editar seus parâmetros.
            </p>
            <div className="project-overview">
              <div className="section-eyebrow">NESTA SELEÇÃO</div>
              <div>
                <span>Equipamentos selecionados</span>
                <b>{selectionSummary.equipment}</b>
              </div>
              <div>
                <span>Cabos selecionados</span>
                <b>{selectionSummary.cables}</b>
              </div>
            </div>
            <div className="inspector-tip">
              <Info size={16} />
              <p>
                Use as setas para mover 1 px ou Shift + setas para mover 10 px.
                Painéis acompanham seus equipamentos.
              </p>
            </div>
            <div className="item-actions">
              <button
                className="secondary-button"
                disabled={!selectionSummary.equipment}
                onClick={onDuplicate}
              >
                <Copy size={14} />
                Duplicar
              </button>
              <button className="danger-button" onClick={onDelete}>
                <Trash2 size={14} />
                Excluir
              </button>
            </div>
            <button
              className="secondary-button full-width clear-selection"
              onClick={onClear}
            >
              <X size={14} />
              Limpar seleção
            </button>
          </>
        ) : item ? (
          <>
            <div className="selected-heading">
              <div
                className="selected-symbol"
                style={{ color: node ? catalog[node.type].color : "#217a63" }}
              >
                {node ? (
                  <Symbol type={node.type} size={28} />
                ) : (
                  <CableIcon size={26} />
                )}
              </div>
              <div>
                <span className="section-eyebrow">
                  {node ? catalog[node.type].category : "CONEXÃO"}
                </span>
                <h2>{node ? catalog[node.type].name : "Cabo / condutor"}</h2>
              </div>
              <button
                className="icon-button"
                aria-label="Limpar seleção"
                onClick={onClear}
              >
                <X size={15} />
              </button>
            </div>
            <div className="section-title">Identificação</div>
            <label className="property-field">
              <span>Nome do elemento</span>
              <input
                className="text-input"
                aria-label="Nome do elemento"
                value={label}
                maxLength={100}
                onChange={(e) => setLabel(e.target.value)}
                onBlur={() => {
                  if (label.trim()) onUpdate(item.id, { label: label.trim() });
                  else setLabel(item.label);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                }}
              />
            </label>
            {node && node.type !== "PANEL" && (
              <label className="property-field">
                <span>Localização</span>
                <div className="select-wrap">
                  <select
                    aria-label="Localização"
                    value={node.parentId ?? ""}
                    onChange={(e) => onParent(node.id, e.target.value)}
                  >
                    <option value="">Área de trabalho</option>
                    {project.nodes
                      .filter((n) => n.type === "PANEL")
                      .map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.label}
                        </option>
                      ))}
                  </select>
                  <ChevronDown size={13} />
                </div>
              </label>
            )}
            {edge && (
              <div className="connection-path">
                <span>
                  {project.nodes.find((n) => n.id === edge.from)?.label}
                </span>
                <span>↓</span>
                <span>
                  {project.nodes.find((n) => n.id === edge.to)?.label}
                </span>
              </div>
            )}
            <div className="section-title">Parâmetros elétricos</div>
            {fields.map((field) => (
              <PropertyField
                key={`${item.id}-${field.key}`}
                field={field}
                value={item.properties[field.key]}
                onChange={(value) =>
                  onUpdate(item.id, {
                    properties: { ...item.properties, [field.key]: value },
                  })
                }
              />
            ))}
            {result && (
              <>
                <div className="section-title">
                  <span>Resultados em tempo real</span>
                  <Zap size={13} />
                </div>
                <ResultRows result={result} />
                {edge && (
                  <div className="voltage-drop">
                    <span>Queda de tensão no trecho</span>
                    <strong>
                      {number(analysis.cables.get(edge.id)!.dropPercent, 2)}
                      <small>%</small>
                    </strong>
                    <span>
                      {number(analysis.cables.get(edge.id)!.dropV, 2)} V ·{" "}
                      {number(result.voltage, 0)} V na origem
                    </span>
                  </div>
                )}
                <p className="calculation-note">
                  <Info size={13} />
                  Cálculo preliminar no navegador. Veja as premissas na aba
                  Análise.
                </p>
              </>
            )}
            {node?.type === "PANEL" && (
              <p className="muted-text">
                Arraste equipamentos para dentro deste painel ou escolha-o no
                campo Localização de um elemento.
              </p>
            )}
            <div className="item-actions">
              {node && (
                <button className="secondary-button" onClick={onDuplicate}>
                  <Copy size={14} />
                  Duplicar
                </button>
              )}
              <button className="danger-button" onClick={onDelete}>
                <Trash2 size={14} />
                Excluir
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="empty-inspector-symbol">
              <SlidersHorizontal size={24} />
            </div>
            <h2 className="inspector-heading">Cada detalhe importa.</h2>
            <p className="muted-text">
              Selecione um equipamento ou cabo para editar seus parâmetros e
              acompanhar os resultados.
            </p>
            <div className="project-overview">
              <div className="section-eyebrow">NESTE PROJETO</div>
              <div>
                <span>Equipamentos</span>
                <b>{project.nodes.length}</b>
              </div>
              <div>
                <span>Conexões</span>
                <b>{project.edges.length}</b>
              </div>
              <div>
                <span>Cargas</span>
                <b>{analysis.loads}</b>
              </div>
            </div>
            <div className="inspector-tip">
              <Info size={16} />
              <p>
                Conecte a porta inferior de um equipamento à porta superior do
                próximo. Os cabos acompanham os elementos.
              </p>
            </div>
            <button
              className="secondary-button full-width"
              onClick={() => onTab("analysis")}
            >
              <Zap size={14} />
              Ver análise do projeto
            </button>
          </>
        )}
      </div>
      <div className="inspector-footer">
        <span className="green-dot" />
        Cálculos executados no seu navegador
      </div>
    </aside>
  );
}
