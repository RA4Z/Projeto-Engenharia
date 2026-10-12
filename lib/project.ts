import { z } from "zod";
import {
  cableDefaults,
  cableFields,
  catalog,
  equipmentTypes,
  type EquipmentType,
  type Properties,
  type Field,
} from "./catalog";

export type Equipment = {
  id: string;
  type: EquipmentType;
  label: string;
  position: { x: number; y: number };
  parentId?: string;
  locked?: boolean;
  properties: Properties;
};
export type Cable = {
  id: string;
  from: string;
  to: string;
  sourceHandle?: string;
  label: string;
  properties: Properties;
};
export type Project = {
  format: "ampai-project";
  version: "1.0.0";
  projectId: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  nodes: Equipment[];
  edges: Cable[];
  viewport: {
    x: number;
    y: number;
    zoom: number;
    canvasWidth?: number;
    canvasHeight?: number;
  };
};
const idSchema = z.string().min(1).max(100);
const propertiesSchema = z.record(
  z.string().max(100),
  z.union([z.number().finite(), z.string().max(200)]),
);
const projectSchema = z.object({
  format: z.literal("ampai-project"),
  version: z.literal("1.0.0"),
  projectId: idSchema,
  name: z.string().trim().min(1).max(100),
  description: z.string().max(2000),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  nodes: z
    .array(
      z.object({
        id: idSchema,
        type: z.enum(equipmentTypes),
        label: z.string().trim().min(1).max(100),
        position: z.object({
          x: z.number().finite().min(-100000).max(100000),
          y: z.number().finite().min(-100000).max(100000),
        }),
        parentId: idSchema.optional(),
        locked: z.boolean().optional(),
        properties: propertiesSchema,
      }),
    )
    .max(2000),
  edges: z
    .array(
      z.object({
        id: idSchema,
        from: idSchema,
        to: idSchema,
        sourceHandle: z
          .enum(["out", "out-1", "out-2", "out-3", "out-4"])
          .optional(),
        label: z.string().max(100),
        properties: propertiesSchema,
      }),
    )
    .max(5000),
  viewport: z.object({
    x: z.number().finite().min(-1000000).max(1000000),
    y: z.number().finite().min(-1000000).max(1000000),
    zoom: z.number().finite().min(0.15).max(2.5),
    canvasWidth: z.number().finite().min(1).max(100000).optional(),
    canvasHeight: z.number().finite().min(1).max(100000).optional(),
  }),
});
export function uid(prefix = "item"): string {
  return `${prefix}_${crypto.randomUUID()}`;
}
export function createEquipment(
  type: EquipmentType,
  position: Equipment["position"],
  label?: string,
  parentId?: string,
): Equipment {
  return {
    id: uid("node"),
    type,
    label: label ?? catalog[type].name,
    position,
    ...(parentId ? { parentId } : {}),
    properties: { ...catalog[type].defaults },
  };
}
export function createProject(name: string, demo = false): Project {
  const now = new Date().toISOString();
  const project: Project = {
    format: "ampai-project",
    version: "1.0.0",
    projectId: uid("proj"),
    name,
    description: "",
    createdAt: now,
    updatedAt: now,
    nodes: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 0.85 },
  };
  if (!demo) return project;
  const panel = createEquipment("PANEL", { x: 0, y: 370 }, "QGBT-01");
  const source = createEquipment("SOURCE", { x: 216, y: 0 }, "Concessionária");
  const trafo = createEquipment("TRANSFORMER", { x: 216, y: 170 }, "TR-01");
  const breaker = createEquipment(
    "CIRCUIT_BREAKER",
    { x: 216, y: 70 },
    "DJ-Geral",
    panel.id,
  );
  breaker.properties.nominal_current_a = 400;
  const bus = createEquipment(
    "BUSBAR",
    { x: 150, y: 225 },
    "Barramento principal",
    panel.id,
  );
  const branch1 = createEquipment(
    "CIRCUIT_BREAKER",
    { x: 26, y: 365 },
    "DJ-01",
    panel.id,
  );
  const branch2 = createEquipment(
    "CIRCUIT_BREAKER",
    { x: 216, y: 365 },
    "DJ-02",
    panel.id,
  );
  const branch3 = createEquipment(
    "CIRCUIT_BREAKER",
    { x: 406, y: 365 },
    "DJ-03",
    panel.id,
  );
  const motor1 = createEquipment("MOTOR", { x: 26, y: 1030 }, "M-01 · Bomba");
  motor1.properties.power_kw = 45;
  const motor2 = createEquipment(
    "MOTOR",
    { x: 216, y: 1030 },
    "M-02 · Ventilação",
  );
  motor2.properties.power_kw = 22;
  const load = createEquipment(
    "LOAD",
    { x: 406, y: 1030 },
    "QD-01 · Iluminação",
  );
  load.properties.power_kw = 12;
  branch2.properties.nominal_current_a = 63;
  branch3.properties.nominal_current_a = 32;
  project.nodes = [
    panel,
    source,
    trafo,
    motor1,
    motor2,
    load,
    breaker,
    bus,
    branch1,
    branch2,
    branch3,
  ];
  const link = (
    a: Equipment,
    b: Equipment,
    section: number,
    length: number,
    handle = "out",
  ) => ({
    id: uid("cable"),
    from: a.id,
    to: b.id,
    sourceHandle: handle,
    label: `C-${String(project.edges.length + 1).padStart(2, "0")}`,
    properties: { ...cableDefaults, section_mm2: section, length_m: length },
  });
  for (const [a, b, s, l, h] of [
    [source, trafo, 50, 15, "out"],
    [trafo, breaker, 150, 12, "out"],
    [breaker, bus, 150, 3, "out"],
    [bus, branch1, 35, 2, "out-1"],
    [bus, branch2, 16, 2, "out-2"],
    [bus, branch3, 6, 2, "out-4"],
    [branch1, motor1, 35, 35, "out"],
    [branch2, motor2, 16, 28, "out"],
    [branch3, load, 6, 20, "out"],
  ] as [Equipment, Equipment, number, number, string][])
    project.edges.push(link(a, b, s, l, h));
  return project;
}
export function connectionError(
  project: Pick<Project, "nodes" | "edges">,
  from: string,
  to: string,
): string | null {
  return createConnectionValidator(project)(from, to);
}

/** Reuse graph indexes during connection previews; pointer movement does not rebuild them. */
export function createConnectionValidator(
  project: Pick<Project, "nodes" | "edges">,
) {
  const nodes = new Map(project.nodes.map((n) => [n.id, n]));
  const incoming = new Set(project.edges.map((e) => e.to));
  const outgoing = new Map<string, string[]>();
  for (const edge of project.edges) {
    const children = outgoing.get(edge.from) ?? [];
    children.push(edge.to);
    outgoing.set(edge.from, children);
  }
  const reachable = new Map<string, Set<string>>();
  return (from: string, to: string): string | null => {
    const error = endpointError(nodes.get(from), nodes.get(to));
    if (error) return error;
    if (incoming.has(to))
      return "O equipamento já tem uma alimentação. Este modelo utiliza circuitos radiais.";
    let visited = reachable.get(to);
    if (!visited) {
      visited = new Set<string>();
      const pending = [to];
      while (pending.length) {
        const id = pending.pop()!;
        if (visited.has(id)) continue;
        visited.add(id);
        pending.push(...(outgoing.get(id) ?? []));
      }
      reachable.set(to, visited);
    }
    return visited.has(from)
      ? "Essa conexão criaria um circuito fechado. Use uma topologia radial."
      : null;
  };
}

function endpointError(source?: Equipment, target?: Equipment): string | null {
  if (!source || !target) return "Os equipamentos da conexão não existem.";
  if (source.id === target.id) return "Conecte dois equipamentos diferentes.";
  if (
    ["PANEL", "LOAD", "MOTOR"].includes(source.type) ||
    ["PANEL", "SOURCE", "GENERATOR"].includes(target.type)
  )
    return "Esses equipamentos não têm portas compatíveis.";
  return null;
}
function validateProperties(
  properties: Properties,
  defaults: Properties,
  fields: Field[],
  label: string,
): Properties {
  const result = { ...defaults };
  for (const field of fields) {
    const value = properties[field.key] ?? defaults[field.key];
    if (field.options) {
      if (!field.options.some((o) => o.value === value))
        throw new Error(`Valor inválido de ${field.label} em ${label}.`);
    } else if (
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      (field.min !== undefined && value < field.min) ||
      (field.max !== undefined && value > field.max)
    ) {
      throw new Error(
        `Valor fora do intervalo para ${field.label} em ${label}.`,
      );
    }
    if (field.key === "parallel_runs" && !Number.isInteger(value))
      throw new Error("O número de condutores em paralelo deve ser inteiro.");
    result[field.key] = value;
  }
  return result;
}
export function parseProject(input: unknown): Project {
  const parsed = projectSchema.safeParse(input);
  if (!parsed.success)
    throw new Error(
      "JSON inválido ou formato incompatível. Importe um projeto AmpAI na versão 1.0.0.",
    );
  const project: Project = parsed.data;
  const nodesById = new Map(project.nodes.map((node) => [node.id, node]));
  const ids = new Set<string>();
  for (const node of project.nodes) {
    if (ids.has(node.id))
      throw new Error("O projeto contém identificadores duplicados.");
    ids.add(node.id);
    node.properties = validateProperties(
      node.properties,
      catalog[node.type].defaults,
      catalog[node.type].fields,
      node.label,
    );
    if (node.parentId) {
      const parent = nodesById.get(node.parentId);
      if (
        !parent ||
        parent.type !== "PANEL" ||
        node.type === "PANEL" ||
        node.id === parent.id
      )
        throw new Error("A hierarquia dos painéis é inválida.");
      if (
        node.position.x < 0 ||
        node.position.y < 44 ||
        node.position.x > (node.type === "BUSBAR" ? 320 : 440) ||
        node.position.y > 430
      )
        throw new Error("Um subelemento está fora dos limites do painel.");
    }
  }
  const incoming = new Set<string>();
  const outgoing = new Map<string, string[]>();
  for (const edge of project.edges) {
    if (ids.has(edge.id))
      throw new Error("O projeto contém identificadores duplicados.");
    ids.add(edge.id);
    const source = nodesById.get(edge.from);
    const error = endpointError(source, nodesById.get(edge.to));
    if (error) throw new Error(error);
    if (incoming.has(edge.to))
      throw new Error(
        "O equipamento já tem uma alimentação. Este modelo utiliza circuitos radiais.",
      );
    incoming.add(edge.to);
    if (
      edge.sourceHandle &&
      (source!.type === "BUSBAR"
        ? !["out-1", "out-2", "out-3", "out-4"].includes(edge.sourceHandle)
        : edge.sourceHandle !== "out")
    )
      throw new Error("Porta de conexão inválida.");
    edge.properties = validateProperties(
      edge.properties,
      cableDefaults,
      cableFields,
      edge.label || "Cabo",
    );
    const children = outgoing.get(edge.from) ?? [];
    children.push(edge.to);
    outgoing.set(edge.from, children);
  }
  // Each node has at most one incoming cable. Walk all roots once; an unreached
  // component must contain a cycle, regardless of the order of the input cables.
  const reached = project.nodes
    .filter((node) => !incoming.has(node.id))
    .map((node) => node.id);
  for (let i = 0; i < reached.length; i++)
    reached.push(...(outgoing.get(reached[i]) ?? []));
  if (reached.length !== project.nodes.length)
    throw new Error(
      "Essa conexão criaria um circuito fechado. Use uma topologia radial.",
    );
  project.nodes.sort(
    (a, b) => Number(Boolean(a.parentId)) - Number(Boolean(b.parentId)),
  );
  return project;
}
export function serializeProject(project: Project): string {
  return JSON.stringify(parseProject(project), null, 2);
}
export function parseProjectText(text: string): Project {
  let input: unknown;
  try {
    input = JSON.parse(text.replace(/^\uFEFF/, ""));
  } catch {
    throw new Error(
      "O arquivo não contém um JSON válido. Escolha um projeto JSON exportado pelo AmpAI.",
    );
  }
  return parseProject(input);
}
export function deleteItems(project: Project, ids: string[]): Project {
  const removed = new Set(ids);
  project.nodes.forEach((n) => {
    if (n.parentId && removed.has(n.parentId)) removed.add(n.id);
  });
  return {
    ...project,
    nodes: project.nodes.filter((n) => !removed.has(n.id)),
    edges: project.edges.filter(
      (e) => !removed.has(e.id) && !removed.has(e.from) && !removed.has(e.to),
    ),
  };
}
export const STORAGE_KEY = "ampai.workspace.v1";
