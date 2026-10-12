import type { Cable, Equipment, Project } from "./project";
export type Power = {
  active: number;
  reactive: number;
  apparent: number;
  factor: number;
};
export type ElectricalResult = Power & {
  current: number;
  voltage: number;
  phases: number;
};
export type CableResult = ElectricalResult & {
  dropV: number;
  dropPercent: number;
  resistance: number;
};
export type Issue = {
  id: string;
  message: string;
  severity: "warning" | "info";
};
export const number = (value: number, digits = 1) =>
  new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
export function sumPower(powers: Pick<Power, "active" | "reactive">[]): Power {
  const active = powers.reduce((s, p) => s + p.active, 0),
    reactive = powers.reduce((s, p) => s + p.reactive, 0);
  const apparent = Math.hypot(active, reactive);
  return {
    active,
    reactive,
    apparent,
    factor: apparent ? active / apparent : 1,
  };
}
export function loadPower(node: Equipment): Power {
  if (node.type !== "MOTOR" && node.type !== "LOAD") return sumPower([]);
  const p = node.properties;
  const active =
    (Number(p.power_kw) * Number(p.demand_factor)) /
    (node.type === "MOTOR" ? Number(p.efficiency) : 1);
  const factor = Number(p.power_factor);
  const reactive = active * Math.tan(Math.acos(factor));
  return sumPower([{ active, reactive }]);
}
export function downstreamPower(project: Project, id: string): Power {
  const visited = new Set<string>(),
    pending = [id],
    loads: Power[] = [];
  const map = new Map(project.nodes.map((n) => [n.id, n]));
  const adjacency = new Map<string, string[]>();
  project.edges.forEach((e) =>
    adjacency.set(e.from, [...(adjacency.get(e.from) ?? []), e.to]),
  );
  while (pending.length) {
    const next = pending.pop()!;
    if (visited.has(next)) continue;
    visited.add(next);
    const node = map.get(next);
    if (node && ["LOAD", "MOTOR"].includes(node.type))
      loads.push(loadPower(node));
    pending.push(...(adjacency.get(next) ?? []));
  }
  return sumPower(loads);
}
export function supply(
  project: Project,
  id: string,
): { voltage: number; phases: number } {
  let node = project.nodes.find((n) => n.id === id);
  const visited = new Set<string>();
  while (node && !visited.has(node.id)) {
    visited.add(node.id);
    if (node.properties.voltage_v)
      return {
        voltage: Number(node.properties.voltage_v),
        phases: Number(node.properties.phases ?? 3),
      };
    const incoming = project.edges.find((e) => e.to === node!.id);
    if (!incoming) break;
    node = project.nodes.find((n) => n.id === incoming.from);
  }
  const initial = project.nodes.find((n) => n.id === id);
  const parent = project.nodes.find((n) => n.id === initial?.parentId);
  return {
    voltage: Number(parent?.properties.voltage_v ?? 380),
    phases: Number(parent?.properties.phases ?? 3),
  };
}
export function nodeResult(project: Project, id: string): ElectricalResult {
  const node = project.nodes.find((n) => n.id === id);
  const power =
    node?.type === "PANEL"
      ? sumPower(
          project.nodes
            .filter(
              (n) =>
                n.parentId === id &&
                !project.edges.some(
                  (e) =>
                    e.to === n.id &&
                    project.nodes.some(
                      (p) => p.id === e.from && p.parentId === id,
                    ),
                ),
            )
            .map((n) => downstreamPower(project, n.id)),
        )
      : downstreamPower(project, id);
  const system = supply(project, id);
  return {
    ...power,
    ...system,
    current:
      (power.apparent * 1000) /
      ((system.phases === 3 ? Math.sqrt(3) : 1) * system.voltage),
  };
}
export function cableResult(project: Project, cable: Cable): CableResult {
  const power = downstreamPower(project, cable.to),
    system = supply(project, cable.from);
  const current =
    (power.apparent * 1000) /
    ((system.phases === 3 ? Math.sqrt(3) : 1) * system.voltage);
  const p = cable.properties,
    aluminium = p.material === "AL";
  const rho = aluminium ? 0.028264 : 0.017241,
    alpha = aluminium ? 0.00403 : 0.00393;
  const resistance =
    (rho * (1 + alpha * (Number(p.temperature_c) - 20))) /
    Number(p.section_mm2) /
    Number(p.parallel_runs);
  const reactance = Number(p.reactance_ohm_km) / 1000 / Number(p.parallel_runs);
  const dropV =
    (system.phases === 3 ? Math.sqrt(3) : 2) *
    current *
    Number(p.length_m) *
    (resistance * power.factor +
      reactance * Math.sqrt(Math.max(0, 1 - power.factor ** 2)));
  return {
    ...power,
    ...system,
    current,
    dropV,
    dropPercent: (dropV / system.voltage) * 100,
    resistance,
  };
}
export function analyze(project: Project) {
  const loads = project.nodes.filter(
    (n) => n.type === "MOTOR" || n.type === "LOAD",
  );
  const total = sumPower(loads.map(loadPower));
  const installed = loads.reduce(
    (s, n) =>
      s +
      Number(n.properties.power_kw) /
        (n.type === "MOTOR" ? Number(n.properties.efficiency) : 1),
    0,
  );
  const nodeResults = new Map(
    project.nodes.map((n) => [n.id, nodeResult(project, n.id)]),
  );
  const cables = new Map(
    project.edges.map((e) => [e.id, cableResult(project, e)]),
  );
  const issues: Issue[] = [];
  for (const node of project.nodes) {
    const result = nodeResults.get(node.id)!;
    if (
      !["PANEL", "SOURCE", "GENERATOR"].includes(node.type) &&
      !project.edges.some((e) => e.to === node.id)
    )
      issues.push({
        id: node.id,
        severity: "info",
        message: `${node.label}: sem alimentação conectada.`,
      });
    if (
      ["CIRCUIT_BREAKER", "BUSBAR", "SWITCH", "TIE", "PANEL"].includes(
        node.type,
      ) &&
      result.current > Number(node.properties.nominal_current_a)
    )
      issues.push({
        id: node.id,
        severity: "warning",
        message: `${node.label}: corrente calculada acima da nominal.`,
      });
    if (
      ["TRANSFORMER", "GENERATOR"].includes(node.type) &&
      result.apparent > Number(node.properties.power_kva)
    )
      issues.push({
        id: node.id,
        severity: "warning",
        message: `${node.label}: demanda acima da potência nominal.`,
      });
  }
  project.edges.forEach((edge) => {
    const target = project.nodes.find((n) => n.id === edge.to)!;
    const upstream = supply(project, edge.from);
    const ratedVoltage =
      target.type === "TRANSFORMER"
        ? target.properties.primary_voltage_v
        : target.properties.voltage_v;
    if (ratedVoltage && Number(ratedVoltage) !== upstream.voltage)
      issues.push({
        id: edge.id,
        severity: "warning",
        message: `${edge.label}: tensões de origem e destino incompatíveis.`,
      });
    if (
      target.properties.phases &&
      Number(target.properties.phases) !== upstream.phases
    )
      issues.push({
        id: edge.id,
        severity: "warning",
        message: `${edge.label}: sistemas de fases diferentes; cálculo equilibrado não se aplica.`,
      });
  });
  return { total, installed, loads: loads.length, nodeResults, cables, issues };
}
