import type { Equipment, Project } from "./project";

export function equipmentSize(type: Equipment["type"]) {
  return {
    width: type === "PANEL" ? 620 : type === "BUSBAR" ? 300 : 168,
    height: type === "PANEL" ? 550 : type === "BUSBAR" ? 90 : 120,
  };
}

export function clampEquipmentPosition(
  node: Pick<Equipment, "type" | "parentId">,
  position: Equipment["position"],
) {
  const x = Math.max(
    node.parentId ? 0 : -100000,
    Math.min(
      node.parentId ? (node.type === "BUSBAR" ? 320 : 440) : 100000,
      position.x,
    ),
  );
  const y = Math.max(
    node.parentId ? 44 : -100000,
    Math.min(node.parentId ? 430 : 100000, position.y),
  );
  return x === position.x && y === position.y ? position : { x, y };
}

/** Apply a completed drag as one transaction, including a multi-selection or a panel. */
export function finishEquipmentDrag(
  project: Project,
  moves: { id: string; position: Equipment["position"] }[],
): Project {
  const byId = new Map(moves.map((move) => [move.id, move.position]));
  const independent = project.nodes.filter(
    (node) =>
      byId.has(node.id) &&
      (!node.parentId || !byId.has(node.parentId)) &&
      Number.isFinite(byId.get(node.id)!.x) &&
      Number.isFinite(byId.get(node.id)!.y),
  );
  // A group stops at the first boundary rather than deforming its internal layout.
  if (independent.length > 1) {
    const first = independent[0],
      desired = byId.get(first.id)!;
    let minX = -Infinity,
      maxX = Infinity,
      minY = -Infinity,
      maxY = Infinity;
    for (const node of independent) {
      minX = Math.max(minX, (node.parentId ? 0 : -100000) - node.position.x);
      maxX = Math.min(
        maxX,
        (node.parentId ? (node.type === "BUSBAR" ? 320 : 440) : 100000) -
          node.position.x,
      );
      minY = Math.max(minY, (node.parentId ? 44 : -100000) - node.position.y);
      maxY = Math.min(maxY, (node.parentId ? 430 : 100000) - node.position.y);
    }
    const dx = Math.max(minX, Math.min(maxX, desired.x - first.position.x)),
      dy = Math.max(minY, Math.min(maxY, desired.y - first.position.y));
    for (const node of independent)
      byId.set(node.id, { x: node.position.x + dx, y: node.position.y + dy });
  }
  let nodes = project.nodes.map((node) => {
    if (node.parentId && byId.has(node.parentId)) return node;
    const moved = byId.get(node.id);
    if (!moved || !Number.isFinite(moved.x) || !Number.isFinite(moved.y))
      return node;
    const position = clampEquipmentPosition(node, moved);
    return node.position.x === position.x && node.position.y === position.y
      ? node
      : { ...node, position };
  });
  nodes = nodes.map((node) => {
    if (!byId.has(node.id) || node.type === "PANEL" || node.parentId)
      return node;
    const panel = nodes.find(
      (parent) =>
        parent.type === "PANEL" &&
        !byId.has(parent.id) &&
        node.position.x >= parent.position.x &&
        node.position.x < parent.position.x + 620 &&
        node.position.y >= parent.position.y + 44 &&
        node.position.y < parent.position.y + 550,
    );
    if (!panel) return node;
    const child = { ...node, parentId: panel.id };
    return {
      ...child,
      position: clampEquipmentPosition(child, {
        x: node.position.x - panel.position.x,
        y: node.position.y - panel.position.y,
      }),
    };
  });
  return nodes.every((node, i) => node === project.nodes[i])
    ? project
    : { ...project, nodes };
}

export function sameViewport(a: Project["viewport"], b: Project["viewport"]) {
  return (
    a.x === b.x &&
    a.y === b.y &&
    a.zoom === b.zoom &&
    a.canvasWidth === b.canvasWidth &&
    a.canvasHeight === b.canvasHeight
  );
}

export function viewportNeedsFit(
  viewport: Project["viewport"],
  width: number,
  height: number,
) {
  if (width <= 0 || height <= 0) return false;
  if (!viewport.canvasWidth || !viewport.canvasHeight) return width < 570;
  return (
    Math.abs(viewport.canvasWidth - width) / viewport.canvasWidth > 0.25 ||
    Math.abs(viewport.canvasHeight - height) / viewport.canvasHeight > 0.25
  );
}

export function nextCableLabel(project: Project) {
  const used = new Set(project.edges.map((edge) => edge.label));
  let count = 1;
  while (used.has(`C-${String(count).padStart(2, "0")}`)) count++;
  return `C-${String(count).padStart(2, "0")}`;
}

export function reparentEquipment(
  project: Project,
  id: string,
  parentId: string,
): Project {
  const node = project.nodes.find((n) => n.id === id);
  if (!node || node.type === "PANEL" || (node.parentId ?? "") === parentId)
    return project;
  const parent = project.nodes.find((n) => n.id === node.parentId);
  const nextParent = parentId
    ? project.nodes.find((n) => n.id === parentId && n.type === "PANEL")
    : undefined;
  if (parentId && !nextParent) return project;
  const { parentId: oldParent, ...base } = node;
  const next = { ...base, ...(nextParent ? { parentId: nextParent.id } : {}) };
  const position = clampEquipmentPosition(next, {
    x:
      node.position.x +
      (parent?.position.x ?? 0) -
      (nextParent?.position.x ?? 0),
    y:
      node.position.y +
      (parent?.position.y ?? 0) -
      (nextParent?.position.y ?? 0),
  });
  return {
    ...project,
    nodes: project.nodes.map((n) => (n.id === id ? { ...next, position } : n)),
  };
}

export function nextEquipmentLabel(project: Project, type: Equipment["type"]) {
  const prefixes: Record<Equipment["type"], string> = {
    SOURCE: "Rede",
    TRANSFORMER: "TR",
    PANEL: "QGBT",
    BUSBAR: "Barra",
    CIRCUIT_BREAKER: "DJ",
    SWITCH: "CH",
    TIE: "TIE",
    MOTOR: "M",
    LOAD: "Carga",
    GENERATOR: "G",
  };
  const prefix = prefixes[type],
    used = new Set(
      project.nodes
        .filter((node) => node.type === type)
        .map((node) => node.label.split(" · ")[0]),
    );
  let count = 1;
  while (used.has(`${prefix}-${String(count).padStart(2, "0")}`)) count++;
  return `${prefix}-${String(count).padStart(2, "0")}`;
}
