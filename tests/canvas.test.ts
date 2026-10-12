import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createProject,
  createEquipment,
  parseProject,
  serializeProject,
} from "../lib/project";
import { analyze } from "../lib/calculations";
import { finishEquipmentDrag, nextEquipmentLabel } from "../lib/geometry";
import {
  applySelectionChanges,
  changeCanvasNodes,
  syncCanvasNodes,
  syncCanvasEdges,
} from "../lib/canvas-state";

test("arraste usa estado transitório e não altera o projeto nem os resultados", () => {
  const project = createProject("Regressão", true),
    analysis = analyze(project);
  const original = serializeProject(project);
  let nodes = syncCanvasNodes([], project, analysis, []);
  const id = project.nodes.find((n) => n.type === "SOURCE")!.id;
  const untouched = nodes.find((n) => n.data.equipment.type === "MOTOR");
  for (let i = 0; i < 500; i++)
    nodes = changeCanvasNodes(nodes, [
      { type: "position", id, position: { x: i, y: i }, dragging: true },
    ]);
  assert.equal(serializeProject(project), original);
  assert.equal(nodes.find((n) => n.id === id)!.position.x, 499);
  assert.equal(
    nodes.find((n) => n.data.equipment.type === "MOTOR"),
    untouched,
  );
  assert.equal(
    nodes.find((n) => n.id === id)!.data.result,
    analysis.nodeResults.get(id),
  );
});

test("medidas e posições repetidas não geram um novo estado", () => {
  const project = createProject("Regressão", true),
    analysis = analyze(project);
  let nodes = syncCanvasNodes([], project, analysis, []),
    id = nodes[0].id;
  nodes = changeCanvasNodes(nodes, [
    {
      type: "dimensions",
      id,
      dimensions: { width: 620, height: 550 },
      setAttributes: true,
    },
  ]);
  for (let i = 0; i < 500; i++)
    assert.equal(
      changeCanvasNodes(nodes, [
        {
          type: "dimensions",
          id,
          dimensions: { width: 620, height: 550 },
          setAttributes: true,
        },
        { type: "position", id, position: nodes[0].position, dragging: false },
      ]),
      nodes,
    );
  assert.equal(syncCanvasNodes(nodes, project, analysis, []), nodes);
});

test("seleção de nós e cabos é idempotente e preserva múltiplos itens", () => {
  const selected = ["a"];
  assert.equal(
    applySelectionChanges(selected, [
      { type: "select", id: "a", selected: true },
    ]),
    selected,
  );
  const multi = applySelectionChanges(selected, [
    { type: "select", id: "b", selected: true },
    { type: "select", id: "cable", selected: true },
  ]);
  assert.deepEqual(multi, ["a", "b", "cable"]);
  assert.deepEqual(
    applySelectionChanges(multi, [
      { type: "select", id: "b", selected: false },
    ]),
    ["a", "cable"],
  );
});

test("movimento de painel e grupo é uma única transação sem deslocar filhos duas vezes", () => {
  const project = createProject("Regressão", true),
    panel = project.nodes.find((n) => n.type === "PANEL")!;
  const child = project.nodes.find((n) => n.parentId === panel.id)!;
  const next = finishEquipmentDrag(project, [
    { id: panel.id, position: { x: 120, y: 500 } },
    { id: child.id, position: child.position },
  ]);
  assert.deepEqual(next.nodes.find((n) => n.id === panel.id)!.position, {
    x: 120,
    y: 500,
  });
  assert.equal(
    next.nodes.find((n) => n.id === child.id),
    child,
  );
  assert.equal(next.edges, project.edges);
  assert.doesNotThrow(() => parseProject(next));
  assert.equal(
    finishEquipmentDrag(next, [{ id: panel.id, position: { x: 120, y: 500 } }]),
    next,
  );
});

test("soltar no painel mantém hierarquia, limites e JSON válidos", () => {
  const project = createProject("Regressão", true),
    panel = project.nodes.find((n) => n.type === "PANEL")!;
  const root = createEquipment("SOURCE", { x: 800, y: 0 });
  project.nodes.push(root);
  const nested = finishEquipmentDrag(project, [
    {
      id: root.id,
      position: { x: panel.position.x + 100, y: panel.position.y + 100 },
    },
  ]);
  const child = nested.nodes.find((n) => n.id === root.id)!;
  assert.equal(child.parentId, panel.id);
  assert.deepEqual(child.position, { x: 100, y: 100 });
  const clamped = finishEquipmentDrag(nested, [
    { id: child.id, position: { x: 900, y: -20 } },
  ]);
  assert.deepEqual(clamped.nodes.find((n) => n.id === child.id)!.position, {
    x: 440,
    y: 44,
  });
  assert.doesNotThrow(() => parseProject(clamped));
});

test("atualizar viewport mantém referências do grafo e nós visuais", () => {
  const project = createProject("Regressão", true),
    analysis = analyze(project),
    nodes = syncCanvasNodes([], project, analysis, []),
    edges = syncCanvasEdges([], project, []);
  const moved = { ...project, viewport: { x: 100, y: 200, zoom: 0.75 } };
  assert.equal(syncCanvasNodes(nodes, moved, analysis, []), nodes);
  assert.equal(syncCanvasEdges(edges, moved, []), edges);
});
test("rótulos novos não colidem com equipamentos após exclusões", () => {
  const project = createProject("Equipamentos");
  project.nodes = [
    createEquipment("MOTOR", { x: 0, y: 0 }, "M-01 · Bomba"),
    createEquipment("MOTOR", { x: 0, y: 100 }, "M-03"),
  ];
  assert.equal(nextEquipmentLabel(project, "MOTOR"), "M-02");
  project.nodes.push(createEquipment("MOTOR", { x: 0, y: 200 }, "M-02"));
  assert.equal(nextEquipmentLabel(project, "MOTOR"), "M-04");
});
