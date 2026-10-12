import { catalog } from "./catalog";
import type { Project } from "./project";

export function searchProjectItems(
  project: Pick<Project, "nodes" | "edges"> | undefined,
  input: string,
) {
  const query = input.trim().toLowerCase();
  if (!project) return { nodes: [], edges: [], query };
  if (!query) return { nodes: project.nodes, edges: project.edges, query };
  return {
    query,
    nodes: project.nodes.filter(
      (node) =>
        node.label.toLowerCase().includes(query) ||
        catalog[node.type].name.toLowerCase().includes(query),
    ),
    edges: project.edges.filter((edge) =>
      `cabo ${edge.label} ${edge.properties.section_mm2} mm²`
        .toLowerCase()
        .includes(query),
    ),
  };
}
