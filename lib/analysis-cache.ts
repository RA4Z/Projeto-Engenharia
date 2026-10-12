import { analyze } from "./calculations";
import type { Project } from "./project";

export type AnalysisSnapshot = {
  project: Project;
  analysis: ReturnType<typeof analyze>;
};

export function analysisSnapshot(
  previous: AnalysisSnapshot | null,
  project: Project,
): AnalysisSnapshot {
  const old = previous?.project;
  const sameNodes =
    old &&
    old.nodes.length === project.nodes.length &&
    project.nodes.every((node, i) => {
      const before = old.nodes[i];
      return (
        node === before ||
        (node.id === before.id &&
          node.type === before.type &&
          node.parentId === before.parentId &&
          node.label === before.label &&
          node.properties === before.properties)
      );
    });
  const sameEdges =
    old &&
    old.edges.length === project.edges.length &&
    project.edges.every((edge, i) => {
      const before = old.edges[i];
      return (
        edge === before ||
        (edge.id === before.id &&
          edge.from === before.from &&
          edge.to === before.to &&
          edge.label === before.label &&
          edge.properties === before.properties)
      );
    });
  return {
    project,
    analysis: sameNodes && sameEdges ? previous!.analysis : analyze(project),
  };
}
