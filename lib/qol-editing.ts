import { cableFields, catalog, type Field, type Properties } from "./catalog";
import type { Cable, Equipment, Project } from "./project";
import {
  clampEquipmentPosition,
  equipmentSize,
  positionLockedIds,
} from "./geometry";

export const arrangementActions = [
  ["left", "Alinhar à esquerda"],
  ["center", "Centralizar horizontalmente"],
  ["right", "Alinhar à direita"],
  ["top", "Alinhar ao topo"],
  ["middle", "Centralizar verticalmente"],
  ["bottom", "Alinhar à base"],
  ["horizontal", "Distribuir horizontalmente"],
  ["vertical", "Distribuir verticalmente"],
] as const;
export type Arrangement = (typeof arrangementActions)[number][0];

export function movableSelection(project: Project, ids: string[]) {
  const selected = new Set(ids),
    locked = positionLockedIds(project);
  return project.nodes.filter(
    (n) =>
      selected.has(n.id) &&
      !locked.has(n.id) &&
      (!n.parentId || !selected.has(n.parentId)),
  );
}

/** Layout is atomic, retains parents, and never silently deforms a selection at boundaries. */
export function arrangeSelection(
  project: Project,
  ids: string[],
  action: Arrangement,
): Project {
  const nodes = movableSelection(project, ids);
  const distribute = action === "horizontal" || action === "vertical";
  if (nodes.length < (distribute ? 3 : 2)) return project;
  const parents = new Map(project.nodes.map((n) => [n.id, n]));
  const axis = ["left", "center", "right", "horizontal"].includes(action)
    ? "x"
    : "y";
  const dimension = axis === "x" ? "width" : "height";
  const records = nodes.map((n) => ({
    n,
    size: equipmentSize(n.type)[dimension],
    start:
      n.position[axis] +
      (n.parentId ? parents.get(n.parentId)!.position[axis] : 0),
  }));
  const min = Math.min(...records.map((r) => r.start));
  const max = Math.max(...records.map((r) => r.start + r.size));
  const positions = new Map<string, Equipment["position"]>();
  let gap = 0,
    cursor = min;
  if (distribute) {
    records.sort((a, b) => a.start - b.start || a.n.id.localeCompare(b.n.id));
    gap =
      (max - min - records.reduce((sum, r) => sum + r.size, 0)) /
      (records.length - 1);
    if (gap < 0)
      throw new Error(
        "Espaço insuficiente para distribuir sem sobreposição. Afaste os equipamentos das extremidades.",
      );
  }
  for (const r of records) {
    const start = distribute
      ? cursor
      : ["left", "top"].includes(action)
        ? min
        : ["right", "bottom"].includes(action)
          ? max - r.size
          : (min + max - r.size) / 2;
    const position = {
      ...r.n.position,
      [axis]:
        start - (r.n.parentId ? parents.get(r.n.parentId)!.position[axis] : 0),
    };
    const clamped = clampEquipmentPosition(r.n, position);
    if (clamped.x !== position.x || clamped.y !== position.y)
      throw new Error(
        "O alinhamento ultrapassaria os limites de um painel. Organize os itens de cada painel separadamente.",
      );
    positions.set(r.n.id, position);
    cursor += r.size + gap;
  }
  const next = project.nodes.map((n) => {
    const p = positions.get(n.id);
    return !p || (p.x === n.position.x && p.y === n.position.y)
      ? n
      : { ...n, position: p };
  });
  return next.every((n, i) => n === project.nodes[i])
    ? project
    : { ...project, nodes: next };
}

export function setPositionLock(
  project: Project,
  ids: string[],
  locked: boolean,
): Project {
  const selected = new Set(ids);
  const nodes = project.nodes.map((n) =>
    selected.has(n.id) && Boolean(n.locked) !== locked ? { ...n, locked } : n,
  );
  return nodes.every((n, i) => n === project.nodes[i])
    ? project
    : { ...project, nodes };
}

export function batchFields(
  project: Project,
  ids: string[],
): { field: Field; value: string | number | undefined }[] {
  const selected = new Set(ids);
  const items: (Equipment | Cable)[] = [
    ...project.nodes,
    ...project.edges,
  ].filter((n) => selected.has(n.id));
  if (items.length < 2) return [];
  const definitions = items.map((item) =>
    "type" in item ? catalog[item.type].fields : cableFields,
  );
  return definitions[0]
    .filter((field) =>
      definitions.every((fields) =>
        fields.some(
          (f) =>
            f.key === field.key && JSON.stringify(f) === JSON.stringify(field),
        ),
      ),
    )
    .map((field) => {
      const value = items[0].properties[field.key];
      return {
        field,
        value: items.every((item) => item.properties[field.key] === value)
          ? value
          : undefined,
      };
    });
}

export function updateBatchProperties(
  project: Project,
  ids: string[],
  patch: Properties,
): Project {
  const common = new Map(
    batchFields(project, ids).map(({ field }) => [field.key, field]),
  );
  for (const [key, value] of Object.entries(patch)) {
    const field = common.get(key);
    if (!field)
      throw new Error(
        "Esse campo não é compatível com todos os itens selecionados.",
      );
    if (
      field.options
        ? !field.options.some((o) => o.value === value)
        : typeof value !== "number" ||
          !Number.isFinite(value) ||
          (field.min !== undefined && value < field.min) ||
          (field.max !== undefined && value > field.max) ||
          (key === "parallel_runs" && !Number.isInteger(value))
    )
      throw new Error(`Valor inválido para ${field.label}.`);
  }
  const selected = new Set(ids);
  const update = <T extends Equipment | Cable>(item: T): T =>
    !selected.has(item.id) ||
    Object.entries(patch).every(([k, v]) => item.properties[k] === v)
      ? item
      : { ...item, properties: { ...item.properties, ...patch } };
  const nodes = project.nodes.map(update),
    edges = project.edges.map(update);
  const nodesChanged = nodes.some((n, i) => n !== project.nodes[i]);
  const edgesChanged = edges.some((e, i) => e !== project.edges[i]);
  return !nodesChanged && !edgesChanged
    ? project
    : {
        ...project,
        nodes: nodesChanged ? nodes : project.nodes,
        edges: edgesChanged ? edges : project.edges,
      };
}
