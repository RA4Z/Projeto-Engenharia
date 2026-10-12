import { test } from "node:test";
import assert from "node:assert/strict";
import {
  captureSelection,
  insertFragment,
  nudgeSelection,
} from "../lib/editing";
import {
  createProject,
  createEquipment,
  parseProject,
  serializeProject,
} from "../lib/project";
import { editorAction } from "../lib/shortcuts";

test("duplicar seleção inclui painel e filhos uma vez, preservando cabos internos", () => {
  const project = createProject("Origem", true);
  const before = serializeProject(project);
  const panel = project.nodes.find((n) => n.type === "PANEL")!;
  const child = project.nodes.find((n) => n.parentId === panel.id)!;
  const fragment = captureSelection(project, [panel.id, child.id]);
  const result = insertFragment(project, fragment, { duplicate: true });
  const copied = result.project.nodes.filter((n) =>
    result.selection.includes(n.id),
  );
  const copiedPanel = copied.find((n) => n.type === "PANEL")!;
  assert.equal(
    copied.length,
    1 + project.nodes.filter((n) => n.parentId === panel.id).length,
  );
  assert.deepEqual(copiedPanel.position, {
    x: panel.position.x + 40,
    y: panel.position.y + 40,
  });
  assert.ok(
    copied
      .filter((n) => n.type !== "PANEL")
      .every((n) => n.parentId === copiedPanel.id),
  );
  assert.equal(result.project.edges.length - project.edges.length, 4);
  assert.deepEqual(
    parseProject(JSON.parse(serializeProject(result.project))),
    result.project,
  );
  assert.equal(serializeProject(project), before);
});

test("copiar filhos sem painel usa posição absoluta; colar em outro projeto remove pai externo", () => {
  const source = createProject("Origem", true);
  const panel = source.nodes.find((n) => n.type === "PANEL")!;
  const child = source.nodes.find((n) => n.parentId === panel.id)!;
  const fragment = captureSelection(source, [child.id]);
  assert.equal(fragment.nodes[0].parentId, undefined);
  assert.deepEqual(fragment.nodes[0].position, {
    x: panel.position.x + child.position.x,
    y: panel.position.y + child.position.y,
  });
  const result = insertFragment(createProject("Destino"), fragment, {
    center: { x: 500, y: 500 },
  });
  assert.equal(result.project.nodes[0].parentId, undefined);
  assert.equal(result.project.nodes[0].label, child.label);
  assert.deepEqual(result.project.nodes[0].position, { x: 416, y: 440 });
  assert.equal(result.project.edges.length, 0);
  assert.doesNotThrow(() => parseProject(result.project));
});

test("duplicar equipamento de painel conserva pai e respeita a borda", () => {
  const project = createProject("Origem", true);
  const child = project.nodes.find((n) => n.parentId && n.type !== "BUSBAR")!;
  child.position = { x: 440, y: 430 };
  const result = insertFragment(
    project,
    captureSelection(project, [child.id]),
    { duplicate: true },
  );
  const copy = result.project.nodes.find((n) => n.id === result.selection[0])!;
  assert.equal(copy.parentId, child.parentId);
  assert.deepEqual(copy.position, child.position);
});

test("cópias sucessivas têm IDs e rótulos únicos, sem compartilhar propriedades", () => {
  const source = createProject("Origem", true);
  const fragment = captureSelection(
    source,
    source.nodes.map((n) => n.id),
  );
  const first = insertFragment(source, fragment);
  const second = insertFragment(first.project, fragment);
  assert.equal(
    new Set(second.project.nodes.map((n) => n.id)).size,
    second.project.nodes.length,
  );
  assert.equal(
    new Set(second.project.nodes.map((n) => n.label)).size,
    second.project.nodes.length,
  );
  assert.equal(
    new Set(second.project.edges.map((e) => e.label)).size,
    second.project.edges.length,
  );
  const copy = second.project.nodes.find((n) => n.id === second.selection[0])!;
  copy.properties.test = 99;
  assert.equal(fragment.nodes[0].properties.test, undefined);
  assert.equal(source.nodes[0].properties.test, undefined);
  assert.doesNotThrow(() => parseProject(second.project));
});

test("colar conjunto na borda conserva distâncias e respeita limites JSON", () => {
  const source = createProject("Origem");
  source.nodes = [
    createEquipment("SOURCE", { x: 0, y: 0 }),
    createEquipment("MOTOR", { x: 500, y: 500 }),
  ];
  const result = insertFragment(
    createProject("Destino"),
    captureSelection(
      source,
      source.nodes.map((n) => n.id),
    ),
    { center: { x: 1000000, y: 1000000 } },
  );
  assert.equal(
    result.project.nodes[1].position.x - result.project.nodes[0].position.x,
    500,
  );
  assert.equal(result.project.nodes[1].position.y, 100000);
  assert.doesNotThrow(() => parseProject(result.project));
});

test("duplicar uma cópia mantém nomes legíveis e rótulos com até 100 caracteres", () => {
  const project = createProject("Origem");
  project.nodes = [createEquipment("SOURCE", { x: 0, y: 0 }, "Rede-01")];
  const first = insertFragment(
    project,
    captureSelection(project, [project.nodes[0].id]),
    { duplicate: true },
  );
  const second = insertFragment(
    first.project,
    captureSelection(first.project, first.selection),
    { duplicate: true },
  );
  assert.equal(
    second.project.nodes.find((n) => n.id === second.selection[0])!.label,
    "Rede-01 · cópia 2",
  );
  project.nodes[0].label = "A".repeat(100);
  const long = insertFragment(
    project,
    captureSelection(project, [project.nodes[0].id]),
    { duplicate: true },
  );
  assert.ok(long.project.nodes.every((n) => n.label.length <= 100));
  assert.doesNotThrow(() => parseProject(long.project));
});

test("cópia vazia e limites de projeto não alteram o original", () => {
  const source = createProject("Origem", true);
  assert.equal(
    insertFragment(source, captureSelection(source, [source.edges[0].id]))
      .project,
    source,
  );
  const target = createProject("Cheio");
  target.nodes = Array.from({ length: 2000 }, (_, i) =>
    createEquipment("MOTOR", { x: i, y: 0 }),
  );
  assert.throws(
    () =>
      insertFragment(target, captureSelection(source, [source.nodes[0].id])),
    /2.000/,
  );
  assert.equal(target.nodes.length, 2000);
  target.nodes = [];
  target.edges = Array(5000).fill(source.edges[0]);
  assert.throws(
    () =>
      insertFragment(
        target,
        captureSelection(
          source,
          source.nodes.map((n) => n.id),
        ),
      ),
    /5.000/,
  );
});

test("setas movem painel e filhos sem deslocamento duplo, mantendo cabos e snapshot", () => {
  const source = createProject("Origem", true);
  const panel = source.nodes.find((n) => n.type === "PANEL")!;
  const children = source.nodes.filter((n) => n.parentId === panel.id);
  const result = nudgeSelection(
    source,
    [panel.id, ...children.map((n) => n.id)],
    10,
    -1,
  );
  assert.deepEqual(result.nodes.find((n) => n.id === panel.id)!.position, {
    x: panel.position.x + 10,
    y: panel.position.y - 1,
  });
  for (const child of children)
    assert.equal(
      result.nodes.find((n) => n.id === child.id),
      child,
    );
  assert.equal(result.edges, source.edges);
  assert.deepEqual(panel.position, { x: 0, y: 370 });
  assert.equal(nudgeSelection(source, [source.edges[0].id], 1, 0), source);
});

test("setas na borda param o grupo sem deformar as distâncias", () => {
  const source = createProject("Origem", true);
  const children = source.nodes.filter(
    (n) => n.parentId && n.type === "CIRCUIT_BREAKER",
  );
  const result = nudgeSelection(
    source,
    children.map((n) => n.id),
    100,
    0,
  );
  assert.equal(
    result.nodes.find((n) => n.id === children[children.length - 1].id)!
      .position.x,
    440,
  );
  assert.equal(
    result.nodes.find((n) => n.id === children[0].id)!.position.x -
      children[0].position.x,
    34,
  );
  assert.doesNotThrow(() => parseProject(result));
});

test("atalhos com Ctrl/Cmd não trocam o modo e preservam comandos nativos não tratados", () => {
  const event = {
    key: "c",
    ctrlKey: true,
    metaKey: false,
    shiftKey: false,
    altKey: false,
  };
  assert.equal(editorAction(event), "copy");
  assert.equal(editorAction({ ...event, key: "v" }), "paste");
  assert.equal(
    editorAction({ ...event, ctrlKey: false, metaKey: true, key: "a" }),
    "selectAll",
  );
  assert.equal(editorAction({ ...event, key: "f" }), undefined);
  assert.equal(editorAction({ ...event, key: "c", shiftKey: true }), undefined);
  assert.equal(
    editorAction({ ...event, ctrlKey: false, altKey: true, key: "ArrowLeft" }),
    undefined,
  );
  assert.equal(
    editorAction({ ...event, ctrlKey: false, key: "f", shiftKey: true }),
    "fitSelection",
  );
  assert.equal(
    editorAction({
      ...event,
      ctrlKey: false,
      key: "ArrowRight",
      shiftKey: true,
    }),
    "nudge",
  );
});
