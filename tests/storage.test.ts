import { test } from "node:test";
import assert from "node:assert/strict";
import { createProject, STORAGE_KEY } from "../lib/project";
import { restoreWorkspace } from "../lib/workspace-storage";

test("recuperação preserva projetos válidos e copia os dados originais", () => {
  const project = createProject("Válido", true),
    raw = JSON.stringify({
      projects: [project, { invalid: true }],
      activeId: project.projectId,
    });
  const data = new Map([[STORAGE_KEY, raw]]);
  const result = restoreWorkspace({
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  });
  assert.equal(result.projects.length, 1);
  assert.equal(result.projects[0].projectId, project.projectId);
  assert.equal(result.recovered, true);
  assert.equal(result.canSave, true);
  assert.equal(data.get(`${STORAGE_KEY}.recovery`), raw);
});
test("falha ao copiar recuperação impede sobrescrever o arquivo local original", () => {
  const raw = "{json danificado";
  const result = restoreWorkspace({
    getItem: () => raw,
    setItem: () => {
      throw new Error("Quota excedida");
    },
  });
  assert.equal(result.canSave, false);
  assert.equal(result.recovered, true);
  assert.equal(result.projects.length, 1);
});
test("armazenamento bloqueado e IDs duplicados não quebram a inicialização", () => {
  const blocked = restoreWorkspace({
    getItem: () => {
      throw new Error("SecurityError");
    },
    setItem: () => {
      throw new Error("SecurityError");
    },
  });
  assert.equal(blocked.canSave, false);
  const project = createProject("Válido");
  const result = restoreWorkspace({
    getItem: () =>
      JSON.stringify({
        projects: [project, project],
        activeId: project.projectId,
      }),
    setItem: () => {},
  });
  assert.equal(result.projects.length, 1);
  assert.equal(result.recovered, true);
});
