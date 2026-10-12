import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createProject,
  createEquipment,
  parseProject,
  connectionError,
} from "../lib/project";
import { cableDefaults } from "../lib/catalog";
import { finishEquipmentDrag, reparentEquipment } from "../lib/geometry";
import { analyze } from "../lib/calculations";
import {
  changeCanvasEdges,
  changeCanvasNodes,
  applySelectionChanges,
  syncCanvasEdges,
  syncCanvasNodes,
} from "../lib/canvas-state";
import { analysisSnapshot } from "../lib/analysis-cache";
import { updateProjectItem, selectionEquipmentIds } from "../lib/editing";
import { searchProjectItems } from "../lib/project-search";
import {
  adoptUserNodes,
  ConnectionMode,
  getEdgePosition,
  type InternalNodeBase,
  type NodeLookup,
  type ParentLookup,
} from "@xyflow/system";
import type { EquipmentFlowNode } from "../lib/canvas-state";

function latePanel() {
  const project = createProject("Painel criado depois do equipamento");
  const child = createEquipment("LOAD", { x: 900, y: 900 });
  const panel = createEquipment("PANEL", { x: 0, y: 0 });
  project.nodes = [child, panel];
  return { project, child, panel };
}

test("arrastar para painel criado depois conserva o pai antes do filho no canvas", () => {
  const { project, child, panel } = latePanel();
  const next = finishEquipmentDrag(project, [
    { id: child.id, position: { x: 100, y: 100 } },
  ]);
  assert.equal(next.nodes.find((n) => n.id === child.id)!.parentId, panel.id);
  assert.ok(
    next.nodes.findIndex((n) => n.id === panel.id) <
      next.nodes.findIndex((n) => n.id === child.id),
  );
  assert.doesNotThrow(() => parseProject(next));
  assert.equal(project.nodes[0], child);
});

test("alterar Localização também ordena os pais, preservando referências sem mudanças", () => {
  const { project, child, panel } = latePanel();
  const next = reparentEquipment(project, child.id, panel.id);
  assert.equal(next.nodes[0].id, panel.id);
  assert.equal(reparentEquipment(next, child.id, panel.id), next);
  // The canvas also accepts valid graphs presented in arbitrary node order.
  const unsorted = { ...next, nodes: [...next.nodes].reverse() };
  const canvas = syncCanvasNodes([], unsorted, analyze(unsorted), []);
  assert.equal(canvas[0].id, panel.id);
});

test("selecionar e desmarcar cabo pelo canvas atualiza espessura e cor do rótulo", () => {
  const project = createProject("Seleção de cabos", true);
  const id = project.edges[0].id;
  let edges = syncCanvasEdges([], project, []);
  edges = changeCanvasEdges(edges, [{ type: "select", id, selected: true }]);
  edges = syncCanvasEdges(edges, project, [id]);
  assert.equal(edges[0].style?.strokeWidth, 2.4);
  assert.equal(edges[0].labelStyle?.fill, "#187a60");
  edges = changeCanvasEdges(edges, [{ type: "select", id, selected: false }]);
  edges = syncCanvasEdges(edges, project, []);
  assert.equal(edges[0].style?.strokeWidth, 1.5);
  assert.equal(edges[0].labelStyle?.fill, "#788486");
  assert.equal(syncCanvasEdges(edges, project, []), edges);
});

function chain(count: number) {
  const project = createProject("Ordem inversa de cabos");
  project.nodes = Array.from({ length: count }, (_, i) =>
    createEquipment(i === 0 ? "SOURCE" : "CIRCUIT_BREAKER", { x: 0, y: i }),
  );
  project.edges = project.nodes
    .slice(1)
    .map((n, i) => ({
      id: `c${i}`,
      from: project.nodes[i].id,
      to: n.id,
      label: `C${i}`,
      properties: { ...cableDefaults },
    }))
    .reverse();
  return project;
}

test("importar cadeia de 1.900 equipamentos independe da ordem dos cabos", () => {
  const project = chain(1900);
  const start = performance.now();
  const parsed = parseProject(project);
  const elapsed = performance.now() - start;
  assert.equal(parsed.edges.length, 1899);
  assert.ok(
    elapsed < 3000,
    `Validação bloqueou o frontend por ${elapsed.toFixed(0)} ms`,
  );
});

test("topologia em ordem arbitrária rejeita ciclos isolados, dupla alimentação e portas inválidas", () => {
  const project = chain(12);
  const isolated = createEquipment("CIRCUIT_BREAKER", { x: 0, y: 0 });
  const other = createEquipment("SWITCH", { x: 0, y: 0 });
  const cycle = {
    ...project,
    nodes: [...project.nodes, isolated, other],
    edges: [
      ...project.edges,
      {
        ...project.edges[0],
        id: "isolated-a",
        from: isolated.id,
        to: other.id,
      },
      {
        ...project.edges[0],
        id: "isolated-b",
        from: other.id,
        to: isolated.id,
      },
    ],
  };
  assert.throws(() => parseProject(cycle), /circuito fechado/);
  assert.match(
    connectionError(project, project.nodes.at(-1)!.id, project.nodes[1].id)!,
    /alimentação/,
  );
  assert.throws(
    () =>
      parseProject({
        ...project,
        edges: [...project.edges, { ...project.edges[0], id: "duplicate" }],
      }),
    /alimentação/,
  );
  assert.throws(
    () =>
      parseProject({
        ...project,
        edges: [
          { ...project.edges[0], sourceHandle: "out-2" },
          ...project.edges.slice(1),
        ],
      }),
    /Porta/,
  );
});

test("movimentos, câmera e metadados reutilizam cálculos e nós que não foram editados", () => {
  const project = createProject("Cache de análise", true);
  const first = analysisSnapshot(null, project);
  const canvas = syncCanvasNodes([], project, first.analysis, []);
  const id = project.nodes.find((node) => node.type === "SOURCE")!.id;
  let next = project;
  for (let i = 0; i < 100; i++) {
    next = {
      ...next,
      nodes: next.nodes.map((node) =>
        node.id === id ? { ...node, position: { x: 900 + i, y: -200 } } : node,
      ),
    };
    const cached = analysisSnapshot(first, next);
    assert.equal(cached.analysis, first.analysis);
  }
  const synced = syncCanvasNodes(canvas, next, first.analysis, []);
  for (const node of canvas.filter((node) => node.id !== id))
    assert.equal(
      synced.find((item) => item.id === node.id),
      node,
    );
  assert.equal(
    analysisSnapshot(first, {
      ...project,
      name: "Nome novo",
      viewport: { x: 100, y: 100, zoom: 0.6 },
    }).analysis,
    first.analysis,
  );
});

test("edições elétricas, avisos, cabos e hierarquia invalidam a análise sem perder resultados", () => {
  const project = createProject("Cache de análise", true);
  const snapshot = analysisSnapshot(null, project);
  const motor = project.nodes.find((node) => node.type === "MOTOR")!;
  const changed = updateProjectItem(project, motor.id, {
    properties: { ...motor.properties, power_kw: 123 },
  });
  const recalculated = analysisSnapshot(snapshot, changed);
  assert.notEqual(recalculated.analysis, snapshot.analysis);
  assert.deepEqual(recalculated.analysis, analyze(changed));
  assert.ok(
    recalculated.analysis.total.active > snapshot.analysis.total.active,
  );
  const disconnected = { ...project, edges: [] };
  const disconnectedAnalysis = analysisSnapshot(snapshot, disconnected);
  assert.deepEqual(disconnectedAnalysis.analysis, analyze(disconnected));
  const renamed = updateProjectItem(disconnected, motor.id, {
    label: "Aviso atualizado",
  });
  const renamedAnalysis = analysisSnapshot(
    disconnectedAnalysis,
    renamed,
  ).analysis;
  assert.ok(
    renamedAnalysis.issues.some((issue) =>
      issue.message.startsWith("Aviso atualizado:"),
    ),
  );
  const reparented = reparentEquipment(
    project,
    motor.id,
    project.nodes.find((node) => node.type === "PANEL")!.id,
  );
  assert.deepEqual(
    analysisSnapshot(snapshot, reparented).analysis,
    analyze(reparented),
  );
  const cable = project.edges[0];
  const longer = updateProjectItem(project, cable.id, {
    properties: { ...cable.properties, length_m: 200 },
  });
  assert.ok(
    analysisSnapshot(snapshot, longer).analysis.cables.get(cable.id)!.dropV >
      snapshot.analysis.cables.get(cable.id)!.dropV,
  );
});

test("edições sem alterações não criam histórico nem trocam referências do grafo", () => {
  const project = createProject("Edição eficiente", true);
  const node = project.nodes[0],
    cable = project.edges[0];
  assert.equal(
    updateProjectItem(project, node.id, { properties: { ...node.properties } }),
    project,
  );
  assert.equal(
    updateProjectItem(project, node.id, { label: node.label }),
    project,
  );
  assert.equal(
    updateProjectItem(project, "ausente", { label: "Teste" }),
    project,
  );
  const nodeEdit = updateProjectItem(project, node.id, {
    label: "Painel renomeado",
  });
  assert.equal(nodeEdit.edges, project.edges);
  assert.equal(nodeEdit.nodes[1], project.nodes[1]);
  const cableEdit = updateProjectItem(project, cable.id, {
    label: "Cabo renomeado",
    properties: undefined,
  });
  assert.equal(cableEdit.nodes, project.nodes);
  assert.equal(cableEdit.edges[0].properties, cable.properties);
  assert.equal(project.edges[0], cable);
});

test("lotes de posição e seleção respeitam a última alteração, inclusive ao voltar ao estado inicial", () => {
  const project = createProject("Mudanças agrupadas", true);
  const nodes = syncCanvasNodes([], project, analyze(project), []);
  const node = nodes[0];
  const returned = changeCanvasNodes(nodes, [
    {
      type: "position",
      id: node.id,
      position: { x: 500, y: 500 },
      dragging: true,
    },
    { type: "position", id: node.id, position: node.position, dragging: false },
  ]);
  assert.deepEqual(returned[0].position, node.position);
  assert.equal(returned[0].dragging, false);
  const selectionChanges = [
    { type: "select" as const, id: node.id, selected: true },
    { type: "select" as const, id: node.id, selected: false },
  ];
  assert.equal(changeCanvasNodes(nodes, selectionChanges)[0].selected, false);
  const selection: string[] = [];
  assert.equal(applySelectionChanges(selection, selectionChanges), selection);
  const edges = syncCanvasEdges([], project, []);
  const edgeId = edges[0].id;
  const edgeChanges = [
    { type: "select" as const, id: edgeId, selected: true },
    { type: "select" as const, id: edgeId, selected: false },
  ];
  assert.equal(changeCanvasEdges(edges, edgeChanges)[0].selected, false);
  assert.equal(applySelectionChanges(selection, edgeChanges), selection);
  assert.equal(
    changeCanvasNodes(nodes, [selectionChanges[1], selectionChanges[1]]),
    nodes,
  );
});

test("conexões de nós fora da tela, incluindo filhos de painéis e quatro portas de barramento, têm geometria sem DOM", () => {
  const project = createProject("Portas fora da tela");
  const panel = createEquipment("PANEL", { x: 9000, y: 9000 });
  const bus = createEquipment("BUSBAR", { x: 100, y: 100 }, "Barra", panel.id);
  const load = createEquipment("LOAD", { x: 400, y: 300 }, "Carga", panel.id);
  const source = createEquipment("SOURCE", { x: -9000, y: -9000 });
  project.nodes = [panel, bus, load, source];
  const nodes = syncCanvasNodes([], project, analyze(project), []);
  const lookup: NodeLookup<InternalNodeBase<EquipmentFlowNode>> = new Map();
  const parents: ParentLookup<InternalNodeBase<EquipmentFlowNode>> = new Map();
  const { nodesInitialized } = adoptUserNodes(nodes, lookup, parents);
  assert.equal(
    nodesInitialized,
    true,
    "Enquadrar nós fora da tela não pode aguardar medições DOM indefinidamente",
  );
  for (const port of ["out-1", "out-2", "out-3", "out-4"]) {
    const position = getEdgePosition({
      id: port,
      sourceNode: lookup.get(bus.id)!,
      targetNode: lookup.get(load.id)!,
      sourceHandle: port,
      targetHandle: "in",
      connectionMode: ConnectionMode.Strict,
    });
    assert.ok(position, `Cabo da porta ${port} desapareceu sem medição DOM`);
    assert.ok(position.sourceX > 9100 && position.sourceX < 9400);
    assert.equal(position.targetX, 9484);
    assert.ok(position.targetY > 9200);
  }
  const position = getEdgePosition({
    id: "alimentacao",
    sourceNode: lookup.get(source.id)!,
    targetNode: lookup.get(bus.id)!,
    sourceHandle: "out",
    targetHandle: "in",
    connectionMode: ConnectionMode.Strict,
  });
  assert.ok(position);
  assert.equal(position.sourceX, -8916);
  assert.equal(position.targetX, 9250);
});

test("localizar cabo na árvore ou em avisos enquadra suas duas extremidades", () => {
  const project = createProject("Localizar conexões", true);
  const cable = project.edges[0];
  assert.deepEqual(
    new Set(selectionEquipmentIds(project, [cable.id])),
    new Set([cable.from, cable.to]),
  );
  assert.deepEqual(selectionEquipmentIds(project, [cable.from]), [cable.from]);
  assert.deepEqual(selectionEquipmentIds(project, ["ausente"]), []);
  assert.equal(
    selectionEquipmentIds(project, [cable.id, cable.from, cable.to]).length,
    2,
  );
});

test("busca encontra cabos, tolera espaços e não duplica filhos de painéis ao limpar", () => {
  const project = createProject("Busca de elementos", true);
  const cable = searchProjectItems(project, "  C-01  ");
  assert.equal(cable.query, "c-01");
  assert.deepEqual(
    cable.edges.map((edge) => edge.id),
    [project.edges[0].id],
  );
  assert.equal(cable.nodes.length, 0);
  assert.equal(
    searchProjectItems(project, "cabo").edges.length,
    project.edges.length,
  );
  const empty = searchProjectItems(project, "   ");
  assert.equal(empty.query, "");
  assert.equal(empty.nodes, project.nodes);
  assert.equal(empty.edges, project.edges);
});
