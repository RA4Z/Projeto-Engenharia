import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createProject,
  createEquipment,
  serializeProject,
  parseProjectText,
} from "../lib/project";
import { cablePath, updateCableLayout } from "../lib/cable-path";
import { feedingCircuit } from "../lib/circuit-focus";
import {
  captureSelection,
  insertFragment,
  nudgeSelection,
} from "../lib/editing";
import { analysisSnapshot } from "../lib/analysis-cache";
import {
  diagramLayout,
  renderDiagramSvg,
  exportSheet,
  defaultExportOptions,
} from "../lib/diagram-export";
import { canvasVisibility } from "../lib/canvas-visibility";
import { syncCanvasNodes, syncCanvasEdges } from "../lib/canvas-state";
import { analyze } from "../lib/calculations";

test("trajeto manual é ortogonal, mantém as pontas e reposiciona só o rótulo", () => {
  const source = { x: 15, y: 40 },
    target = { x: 200, y: 300 };
  const route = cablePath(source, target, {
    waypoints: [
      { x: -60, y: 130 },
      { x: 90, y: 220 },
    ],
  });
  assert.deepEqual(route.points[0], source);
  assert.deepEqual(route.points.at(-1), target);
  for (let i = 1; i < route.points.length; i++)
    assert.ok(
      route.points[i].x === route.points[i - 1].x ||
        route.points[i].y === route.points[i - 1].y,
    );
  const offset = cablePath(source, target, {
    waypoints: [
      { x: -60, y: 130 },
      { x: 90, y: 220 },
    ],
    labelOffset: { x: 70, y: -25 },
  });
  assert.equal(offset.path, route.path);
  assert.equal(offset.labelX, route.labelX + 70);
  assert.equal(offset.labelY, route.labelY - 25);
});

test("trajetos/rótulos sobrevivem ao JSON; reset remove o campo opcional e mantém arquivos antigos", () => {
  const p = createProject("Trajeto", true),
    id = p.edges[0].id;
  const changed = updateCableLayout(p, id, {
    waypoints: [{ x: -90, y: 100 }],
    labelOffset: { x: 20, y: -30 },
  });
  assert.deepEqual(parseProjectText(serializeProject(changed)), changed);
  assert.equal(changed.edges[0].properties, p.edges[0].properties);
  const reset = updateCableLayout(changed, id);
  assert.equal(Object.hasOwn(reset.edges[0], "layout"), false);
  assert.deepEqual(parseProjectText(serializeProject(reset)), reset);
  assert.equal(updateCableLayout(p, id), p);
  assert.throws(() =>
    updateCableLayout(p, id, { waypoints: [{ x: NaN, y: 0 }] }),
  );
  assert.throws(() =>
    updateCableLayout(p, id, {
      waypoints: Array.from({ length: 21 }, () => ({ x: 0, y: 0 })),
    }),
  );
  assert.throws(() =>
    updateCableLayout(p, id, { labelOffset: { x: Infinity, y: 0 } }),
  );
  const invalid = JSON.parse(serializeProject(p));
  invalid.edges[0].layout = { waypoints: [{ x: 200001, y: 0 }] };
  assert.throws(() => parseProjectText(JSON.stringify(invalid)));
});

test("cópias não compartilham pontos e trasladam as dobras com os equipamentos", () => {
  let p = createProject("Cópia", true),
    a = p.nodes.find((n) => n.type === "SOURCE")!,
    b = p.nodes.find((n) => n.type === "TRANSFORMER")!;
  const edge = p.edges.find((e) => e.from === a.id && e.to === b.id)!;
  p = updateCableLayout(p, edge.id, {
    waypoints: [{ x: 50, y: 150 }],
    labelOffset: { x: 10, y: 5 },
  });
  const fragment = captureSelection(p, [a.id, b.id]);
  assert.notEqual(
    fragment.edges[0].layout?.waypoints,
    p.edges[0].layout?.waypoints,
  );
  const copy = insertFragment(p, fragment, { duplicate: true });
  const copied = copy.project.edges.at(-1)!;
  assert.deepEqual(copied.layout?.waypoints, [{ x: 90, y: 190 }]);
  assert.deepEqual(copied.layout?.labelOffset, { x: 10, y: 5 });
  const moved = nudgeSelection(p, [a.id, b.id], 10, 5);
  assert.deepEqual(
    moved.edges.find((e) => e.id === edge.id)?.layout?.waypoints,
    [{ x: 60, y: 155 }],
  );
  const single = nudgeSelection(p, [a.id], 10, 5);
  assert.deepEqual(
    single.edges.find((e) => e.id === edge.id)?.layout?.waypoints,
    [{ x: 50, y: 150 }],
  );
});

test("mover painel traslada as dobras de cabos internos uma vez", () => {
  let p = createProject("Painel", true),
    panel = p.nodes.find((n) => n.type === "PANEL")!;
  const children = new Set(
    p.nodes.filter((n) => n.parentId === panel.id).map((n) => n.id),
  );
  const edge = p.edges.find((e) => children.has(e.from) && children.has(e.to))!;
  p = updateCableLayout(p, edge.id, { waypoints: [{ x: 250, y: 650 }] });
  const moved = nudgeSelection(p, [panel.id, ...children], 20, 10);
  assert.deepEqual(
    moved.edges.find((e) => e.id === edge.id)?.layout?.waypoints,
    [{ x: 270, y: 660 }],
  );
  assert.doesNotThrow(() => parseProjectText(serializeProject(moved)));
});

test("alterações de desenho reutilizam cálculos elétricos", () => {
  const p = createProject("Cálculo", true),
    before = analysisSnapshot(null, p);
  const changed = updateCableLayout(p, p.edges[0].id, {
    waypoints: [{ x: 100, y: 130 }],
    labelOffset: { x: 90, y: 20 },
  });
  const after = analysisSnapshot(before, changed);
  assert.equal(after.analysis, before.analysis);
  assert.equal(changed.nodes, p.nodes);
  assert.equal(changed.edges[1], p.edges[1]);
});

test("destaque de alimentação segue apenas a ramificação até a origem e inclui painéis visuais", () => {
  const p = createProject("Destaque", true),
    motor = p.nodes.find((n) => n.type === "MOTOR")!;
  const trace = feedingCircuit(p, motor.id);
  assert.equal(trace.nodes.size, 6);
  assert.equal(trace.edges.size, 5);
  assert.equal(trace.supplied, true);
  assert.ok(trace.panels.has(p.nodes.find((n) => n.type === "PANEL")!.id));
  assert.ok(!trace.nodes.has(p.nodes.find((n) => n.type === "LOAD")!.id));
  const cable = p.edges.find((e) => e.to === motor.id)!;
  assert.deepEqual([...feedingCircuit(p, cable.id).nodes], [...trace.nodes]);
  const free = createEquipment("LOAD", { x: 900, y: 100 });
  const disconnected = feedingCircuit(
    { ...p, nodes: [...p.nodes, free] },
    free.id,
  );
  assert.equal(disconnected.supplied, false);
  assert.equal(disconnected.nodes.size, 1);
  assert.equal(feedingCircuit(p, "missing").nodes.size, 0);
});

test("exportação inclui dobras e rótulos fora dos equipamentos sem recortar o desenho", () => {
  let p = createProject("Exportação", true);
  p = updateCableLayout(p, p.edges[0].id, {
    waypoints: [
      { x: -800, y: -500 },
      { x: 1200, y: 400 },
    ],
    labelOffset: { x: 700, y: -600 },
  });
  const drawing = diagramLayout(p),
    route = drawing.cables[0];
  assert.ok(drawing.bounds.x < -800);
  assert.ok(drawing.bounds.y < -500);
  assert.ok(drawing.bounds.x + drawing.bounds.width > 1200);
  assert.ok(drawing.bounds.x <= route.labelX - 180);
  assert.ok(drawing.bounds.y <= route.labelY - 25);
  const exported = renderDiagramSvg(p);
  assert.ok(exported.svg.includes(route.path));
  assert.ok(exported.svg.includes(String(route.labelX)));
});

test("prévia e exportação respeitam opções, orientação, papel e margem", () => {
  const p = createProject("Folha", true);
  const hidden = renderDiagramSvg(p, {
    names: false,
    details: false,
    cableLabels: false,
    padding: 16,
  });
  assert.ok(!hidden.svg.includes("Concessionária"));
  assert.ok(!hidden.svg.includes("300 kVA"));
  assert.ok(!hidden.svg.includes("C-01"));
  assert.ok(hidden.svg.includes("<path"));
  const shown = renderDiagramSvg(p);
  assert.ok(shown.width > hidden.width);
  const portrait = exportSheet(100, 300, {
    ...defaultExportOptions,
    paper: "a4",
    orientation: "portrait",
    marginMm: 20,
  });
  assert.equal(portrait.pageWidth, 210);
  assert.equal(portrait.pageHeight, 297);
  assert.equal(portrait.scale, 257 / 300);
  const landscape = exportSheet(900, 300, defaultExportOptions);
  assert.equal(landscape.orientation, "landscape");
  assert.equal(landscape.pageWidth, 420);
  assert.throws(() => renderDiagramSvg(p, { marginMm: 100 }));
  assert.throws(() => renderDiagramSvg(p, { padding: NaN }));
});

test("visibilidade considera trajetos manuais mesmo quando as pontas estão fora da tela", () => {
  const p = createProject("Visibilidade");
  const source = createEquipment("SOURCE", { x: -4000, y: -4000 }),
    target = createEquipment("LOAD", { x: -4000, y: -3000 });
  p.nodes = [source, target];
  p.edges = [
    {
      id: "wire",
      from: source.id,
      to: target.id,
      label: "C-01",
      properties: {},
      layout: { waypoints: [{ x: 100, y: 100 }] },
    },
  ];
  const nodes = syncCanvasNodes([], p, analyze(p), []),
    edges = syncCanvasEdges([], p, []),
    view = { left: 0, top: 0, right: 800, bottom: 600 };
  const visible = canvasVisibility(nodes, edges, view);
  assert.equal(visible.hiddenNodes.size, 2);
  assert.equal(visible.hiddenEdges.size, 0);
  const automatic = canvasVisibility(
    nodes,
    [{ ...edges[0], data: { cable: { ...p.edges[0], layout: undefined } } }],
    view,
  );
  assert.ok(automatic.hiddenEdges.has("wire"));
  const selected = canvasVisibility(
    nodes.map((n) => ({ ...n, selected: true })),
    edges.map((e) => ({ ...e, selected: true })),
    view,
  );
  assert.equal(selected.hiddenNodes.size, 0);
  assert.equal(selected.hiddenEdges.size, 0);
});
