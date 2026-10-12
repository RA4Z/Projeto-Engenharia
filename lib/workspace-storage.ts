import {
  createProject,
  parseProject,
  STORAGE_KEY,
  type Project,
} from "./project";

type LocalStorage = Pick<Storage, "getItem" | "setItem">;
export function restoreWorkspace(storage: LocalStorage): {
  projects: Project[];
  activeId: string;
  canSave: boolean;
  recovered: boolean;
} {
  let raw: string | null = null,
    projects: Project[] = [],
    activeId = "",
    recovered = false,
    canSave = true;
  try {
    raw = storage.getItem(STORAGE_KEY);
    if (raw) {
      const workspace = JSON.parse(raw);
      if (
        !workspace ||
        !Array.isArray(workspace.projects) ||
        workspace.projects.length < 1 ||
        workspace.projects.length > 100
      )
        throw new Error("Workspace inválido");
      const ids = new Set<string>();
      for (const input of workspace.projects) {
        try {
          const project = parseProject(input);
          if (ids.has(project.projectId)) throw new Error("Projeto duplicado");
          ids.add(project.projectId);
          projects.push(project);
        } catch {
          recovered = true;
        }
      }
      activeId = projects.some(
        (project) => project.projectId === workspace.activeId,
      )
        ? workspace.activeId
        : (projects[0]?.projectId ?? "");
    }
  } catch {
    recovered = true;
    if (raw === null) canSave = false;
  }
  if (recovered && raw) {
    try {
      storage.setItem(`${STORAGE_KEY}.recovery`, raw);
    } catch {
      canSave = false;
    }
  }
  if (!projects.length) {
    const demo = createProject("Instalação industrial", true);
    projects = [demo];
    activeId = demo.projectId;
  }
  return { projects, activeId, canSave, recovered };
}
