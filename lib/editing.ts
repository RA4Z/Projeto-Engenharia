import { uid, type Equipment, type Cable, type Project } from "./project";
import { equipmentSize, finishEquipmentDrag } from "./geometry";

export function updateProjectItem(
  project: Project,
  id: string,
  patch: Partial<Pick<Equipment, "label" | "properties">>,
): Project {
  const node = project.nodes.find((item) => item.id === id);
  const original = node ?? project.edges.find((item) => item.id === id);
  if (!original) return project;
  const properties = patch.properties ?? original.properties;
  const unchanged =
    (patch.label === undefined || patch.label === original.label) &&
    (properties === original.properties ||
      (Object.keys(properties).length ===
        Object.keys(original.properties).length &&
        Object.entries(properties).every(
          ([key, value]) => value === original.properties[key],
        )));
  if (unchanged) return project;
  const next = {
    ...original,
    label: patch.label ?? original.label,
    properties,
  };
  return node
    ? {
        ...project,
        nodes: project.nodes.map((item) =>
          item.id === id ? (next as Equipment) : item,
        ),
      }
    : {
        ...project,
        edges: project.edges.map((item) =>
          item.id === id ? (next as Cable) : item,
        ),
      };
}

export type SelectionFragment = { nodes: Equipment[]; edges: Cable[] };

export function selectionEquipmentIds(
  project: Project,
  selection: string[],
): string[] {
  const ids = new Set(selection);
  for (const edge of project.edges)
    if (ids.has(edge.id)) {
      ids.add(edge.from);
      ids.add(edge.to);
    }
  return project.nodes
    .filter((node) => ids.has(node.id))
    .map((node) => node.id);
}

/** Snapshot a selection, including panel contents and only its internal cables. */
export function captureSelection(
  project: Project,
  ids: string[],
): SelectionFragment {
  const selected = new Set(ids);
  const panels = new Set(
    project.nodes
      .filter((n) => selected.has(n.id) && n.type === "PANEL")
      .map((n) => n.id),
  );
  const included = project.nodes.filter(
    (n) => selected.has(n.id) || (n.parentId && panels.has(n.parentId)),
  );
  const includedIds = new Set(included.map((n) => n.id));
  const parents = new Map(project.nodes.map((n) => [n.id, n]));
  return {
    nodes: included.map((n) => {
      const externalParent =
        n.parentId && !includedIds.has(n.parentId)
          ? parents.get(n.parentId)
          : undefined;
      const { parentId, ...base } = n;
      return {
        ...base,
        ...(!externalParent && parentId ? { parentId } : {}),
        position: {
          x: n.position.x + (externalParent?.position.x ?? 0),
          y: n.position.y + (externalParent?.position.y ?? 0),
        },
        properties: { ...n.properties },
      };
    }),
    edges: project.edges
      .filter((e) => includedIds.has(e.from) && includedIds.has(e.to))
      .map((e) => ({ ...e, properties: { ...e.properties } })),
  };
}

function copyLabel(label: string, used: Set<string>) {
  const base = label.replace(/ · cópia(?: \d+)?$/, "");
  let count = 1,
    candidate: string;
  do {
    const suffix = count === 1 ? " · cópia" : ` · cópia ${count}`;
    candidate = base.slice(0, 100 - suffix.length) + suffix;
    count++;
  } while (used.has(candidate));
  used.add(candidate);
  return candidate;
}

export function insertFragment(
  project: Project,
  fragment: SelectionFragment,
  options: { center?: Equipment["position"]; duplicate?: boolean } = {},
) {
  if (!fragment.nodes.length) return { project, selection: [] as string[] };
  if (project.nodes.length + fragment.nodes.length > 2000)
    throw new Error("A cópia ultrapassa o limite de 2.000 equipamentos.");
  if (project.edges.length + fragment.edges.length > 5000)
    throw new Error("A cópia ultrapassa o limite de 5.000 cabos.");
  const mapping = new Map(fragment.nodes.map((n) => [n.id, uid("node")]));
  const originals = new Map(project.nodes.map((n) => [n.id, n]));
  const roots = fragment.nodes.filter(
    (n) => !n.parentId || !mapping.has(n.parentId),
  );
  const positions = new Map(
    roots.map((n) => {
      const original = options.duplicate ? originals.get(n.id) : undefined;
      return [n.id, original?.parentId ? original : n];
    }),
  );
  let dx = 40,
    dy = 40;
  if (options.center) {
    const minX = Math.min(...roots.map((n) => n.position.x));
    const minY = Math.min(...roots.map((n) => n.position.y));
    const maxX = Math.max(
      ...roots.map((n) => n.position.x + equipmentSize(n.type).width),
    );
    const maxY = Math.max(
      ...roots.map((n) => n.position.y + equipmentSize(n.type).height),
    );
    dx = options.center.x - (minX + maxX) / 2;
    dy = options.center.y - (minY + maxY) / 2;
  }
  // Keep the copied group's spacing even at panel and project boundaries.
  dx = Math.max(
    Math.max(
      ...Array.from(
        positions.values(),
        (n) => (n.parentId ? 0 : -100000) - n.position.x,
      ),
    ),
    Math.min(
      dx,
      Math.min(
        ...Array.from(
          positions.values(),
          (n) =>
            (n.parentId ? (n.type === "BUSBAR" ? 320 : 440) : 100000) -
            n.position.x,
        ),
      ),
    ),
  );
  dy = Math.max(
    Math.max(
      ...Array.from(
        positions.values(),
        (n) => (n.parentId ? 44 : -100000) - n.position.y,
      ),
    ),
    Math.min(
      dy,
      Math.min(
        ...Array.from(
          positions.values(),
          (n) => (n.parentId ? 430 : 100000) - n.position.y,
        ),
      ),
    ),
  );
  const labels = new Set(project.nodes.map((n) => n.label));
  const nodes = fragment.nodes.map((n) => {
    const root = positions.get(n.id);
    const { parentId: originalParentId, ...base } = n;
    const parentId =
      originalParentId && mapping.has(originalParentId)
        ? mapping.get(originalParentId)
        : root?.parentId;
    const label =
      !options.duplicate && !labels.has(n.label)
        ? n.label
        : copyLabel(n.label, labels);
    labels.add(label);
    return {
      ...base,
      id: mapping.get(n.id)!,
      label,
      ...(parentId ? { parentId } : {}),
      position: root
        ? { x: root.position.x + dx, y: root.position.y + dy }
        : { ...n.position },
      properties: { ...n.properties },
    };
  });
  const cableLabels = new Set(project.edges.map((e) => e.label));
  let cableIndex = 1;
  const edges = fragment.edges.map((e) => {
    let label: string;
    do {
      label = `C-${String(cableIndex++).padStart(2, "0")}`;
    } while (cableLabels.has(label));
    cableLabels.add(label);
    return {
      ...e,
      id: uid("cable"),
      label,
      from: mapping.get(e.from)!,
      to: mapping.get(e.to)!,
      properties: { ...e.properties },
    };
  });
  return {
    project: {
      ...project,
      nodes: [...project.nodes, ...nodes].sort(
        (a, b) => Number(Boolean(a.parentId)) - Number(Boolean(b.parentId)),
      ),
      edges: [...project.edges, ...edges],
    },
    selection: nodes.map((n) => n.id),
  };
}

export function nudgeSelection(
  project: Project,
  ids: string[],
  dx: number,
  dy: number,
) {
  const selected = new Set(ids);
  return finishEquipmentDrag(
    project,
    project.nodes
      .filter((n) => selected.has(n.id))
      .map((n) => ({
        id: n.id,
        position: { x: n.position.x + dx, y: n.position.y + dy },
      })),
  );
}
