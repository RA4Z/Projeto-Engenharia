import type { Project } from "./project";

export function feedingCircuit(project: Project, id: string) {
  const nodes = new Set<string>(),
    edges = new Set<string>();
  const byId = new Map(project.nodes.map((n) => [n.id, n]));
  const incoming = new Map(project.edges.map((e) => [e.to, e]));
  const cable = project.edges.find((e) => e.id === id);
  let current = cable?.to ?? id;
  while (byId.has(current) && !nodes.has(current)) {
    nodes.add(current);
    const edge = incoming.get(current);
    if (!edge) break;
    edges.add(edge.id);
    current = edge.from;
  }
  const panels = new Set<string>();
  for (const node of nodes) {
    const parent = byId.get(node)?.parentId;
    if (parent) panels.add(parent);
  }
  const origin = byId.get(current);
  return {
    nodes,
    edges,
    panels,
    label: cable?.label ?? byId.get(id)?.label ?? "Circuito",
    supplied: origin?.type === "SOURCE" || origin?.type === "GENERATOR",
  };
}
