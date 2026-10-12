import { test } from "node:test";
import assert from "node:assert/strict";
import { createProject, createEquipment, parseProject } from "../lib/project";
import { analyze } from "../lib/calculations";
import { finishEquipmentDrag } from "../lib/geometry";
import { changeCanvasNodes, syncCanvasNodes } from "../lib/canvas-state";

test("grupo na borda conserva distâncias entre seus equipamentos", () => {
  const project = createProject("Grupo", true),
    panel = project.nodes.find((node) => node.type === "PANEL")!;
  const a = project.nodes.find((node) => node.label === "DJ-02")!,
    b = project.nodes.find((node) => node.label === "DJ-03")!;
  const next = finishEquipmentDrag(project, [
    { id: a.id, position: { x: a.position.x + 100, y: a.position.y + 10 } },
    { id: b.id, position: { x: b.position.x + 100, y: b.position.y + 10 } },
  ]);
  const movedA = next.nodes.find((node) => node.id === a.id)!,
    movedB = next.nodes.find((node) => node.id === b.id)!;
  assert.equal(movedB.position.x, 440);
  assert.equal(
    movedB.position.x - movedA.position.x,
    b.position.x - a.position.x,
  );
  assert.equal(
    next.nodes.find((node) => node.id === panel.id),
    panel,
  );
  assert.doesNotThrow(() => parseProject(next));
});
test("medição que atualiza apenas largura também é idempotente", () => {
  const project = createProject("Medida"),
    node = createEquipment("SOURCE", { x: 0, y: 0 });
  project.nodes = [node];
  const initial = syncCanvasNodes([], project, analyze(project), []);
  const changes = [
    {
      type: "dimensions" as const,
      id: node.id,
      dimensions: { width: 168, height: 120 },
      setAttributes: "width" as const,
    },
  ];
  const measured = changeCanvasNodes(initial, changes);
  assert.equal(changeCanvasNodes(measured, changes), measured);
});
