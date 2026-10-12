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
const formatters = new Map<number, Intl.NumberFormat>();
export const number = (value: number, digits = 1) => {
  let formatter = formatters.get(digits);
  if (!formatter) {
    formatter = new Intl.NumberFormat("pt-BR", {
      maximumFractionDigits: digits,
      minimumFractionDigits: digits,
    });
    formatters.set(digits, formatter);
  }
  return formatter.format(value);
};
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
function graphContext(project: Project) {
  const nodes = new Map(project.nodes.map((node) => [node.id, node]));
  const incoming = new Map(project.edges.map((edge) => [edge.to, edge]));
  const children = new Map<string, string[]>();
  const members = new Map<string, Equipment[]>();
  for (const node of project.nodes)
    if (node.parentId) {
      const list = members.get(node.parentId) ?? [];
      list.push(node);
      members.set(node.parentId, list);
    }
  for (const edge of project.edges) {
    const list = children.get(edge.from) ?? [];
    list.push(edge.to);
    children.set(edge.from, list);
  }
  const powers = new Map(
    project.nodes.map((node) => [node.id, loadPower(node)]),
  );
  const remaining = new Map(
    project.nodes.map((node) => [
      node.id,
      (children.get(node.id) ?? []).length,
    ]),
  );
  const queue = project.nodes
    .filter((node) => remaining.get(node.id) === 0)
    .map((node) => node.id);
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i],
      parent = incoming.get(id)?.from;
    if (!parent || !powers.has(parent)) continue;
    powers.set(parent, sumPower([powers.get(parent)!, powers.get(id)!]));
    remaining.set(parent, remaining.get(parent)! - 1);
    if (remaining.get(parent) === 0) queue.push(parent);
  }
  const systems = new Map<string, { voltage: number; phases: number }>();
  const inheritedSystems = new Map<
    string,
    { voltage: number; phases: number }
  >();
  const system = (id: string) => {
    if (systems.has(id)) return systems.get(id)!;
    const path: string[] = [],
      visited = new Set<string>();
    let current = nodes.get(id),
      result: { voltage: number; phases: number } | undefined;
    while (current && !visited.has(current.id)) {
      if (inheritedSystems.has(current.id)) {
        result = inheritedSystems.get(current.id);
        break;
      }
      path.push(current.id);
      visited.add(current.id);
      if (current.properties.voltage_v) {
        result = {
          voltage: Number(current.properties.voltage_v),
          phases: Number(current.properties.phases ?? 3),
        };
        break;
      }
      const from = incoming.get(current.id)?.from;
      current = from ? nodes.get(from) : undefined;
    }
    if (!result) {
      const parent = nodes.get(nodes.get(id)?.parentId ?? "");
      result = {
        voltage: Number(parent?.properties.voltage_v ?? 380),
        phases: Number(parent?.properties.phases ?? 3),
      };
    }
    // A fallback depends on the requesting node's panel, so only cache that node.
    if (current)
      for (const next of path) {
        systems.set(next, result);
        inheritedSystems.set(next, result);
      }
    systems.set(id, result);
    return result;
  };
  const panelPower = (id: string) => {
    const roots = (members.get(id) ?? [])
      .filter(
        (node) => nodes.get(incoming.get(node.id)?.from ?? "")?.parentId !== id,
      )
      .map((node) => node.id);
    const visited = new Set<string>(),
      pending = [...roots],
      loads: Power[] = [];
    while (pending.length) {
      const next = pending.pop()!;
      if (visited.has(next)) continue;
      visited.add(next);
      const node = nodes.get(next);
      if (node && ["MOTOR", "LOAD"].includes(node.type))
        loads.push(loadPower(node));
      pending.push(...(children.get(next) ?? []));
    }
    return sumPower(loads);
  };
  return { nodes, incoming, powers, system, panelPower };
}
type GraphContext = ReturnType<typeof graphContext>;
export function downstreamPower(project: Project, id: string): Power {
  return graphContext(project).powers.get(id) ?? sumPower([]);
}
export function supply(project: Project, id: string) {
  return graphContext(project).system(id);
}
export function nodeResult(
  project: Project,
  id: string,
  context: GraphContext = graphContext(project),
): ElectricalResult {
  const node = context.nodes.get(id);
  const power =
    node?.type === "PANEL"
      ? context.panelPower(id)
      : (context.powers.get(id) ?? sumPower([]));
  const system = context.system(id);
  return {
    ...power,
    ...system,
    current:
      (power.apparent * 1000) /
      ((system.phases === 3 ? Math.sqrt(3) : 1) * system.voltage),
  };
}
export function cableResult(
  project: Project,
  cable: Cable,
  context: GraphContext = graphContext(project),
): CableResult {
  const power = context.powers.get(cable.to) ?? sumPower([]),
    system = context.system(cable.from);
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
  const context = graphContext(project);
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
    project.nodes.map((n) => [n.id, nodeResult(project, n.id, context)]),
  );
  const cables = new Map(
    project.edges.map((e) => [e.id, cableResult(project, e, context)]),
  );
  const issues: Issue[] = [];
  for (const node of project.nodes) {
    const result = nodeResults.get(node.id)!;
    if (
      !["PANEL", "SOURCE", "GENERATOR"].includes(node.type) &&
      !context.incoming.has(node.id)
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
    const target = context.nodes.get(edge.to);
    if (!target) return;
    const upstream = context.system(edge.from);
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
