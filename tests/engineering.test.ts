import { test } from "node:test";
import assert from "node:assert/strict";
import {
  analyze,
  cableResult,
  loadPower,
  nodeResult,
  sumPower,
} from "../lib/calculations";
import { cableDefaults } from "../lib/catalog";
import {
  connectionError,
  createEquipment,
  createProject,
  deleteItems,
  parseProject,
  serializeProject,
} from "../lib/project";

function near(actual: number, expected: number, tolerance = 1e-8) {
  assert.ok(
    Math.abs(actual - expected) < tolerance,
    `${actual} != ${expected}`,
  );
}
function simpleCircuit(phases = 3) {
  const p = createProject("Teste");
  const source = createEquipment("SOURCE", { x: 0, y: 0 });
  source.properties = {
    voltage_v: phases === 3 ? 380 : 220,
    phases,
    frequency_hz: 60,
  };
  const load = createEquipment("LOAD", { x: 0, y: 200 });
  load.properties = {
    power_kw: 12,
    voltage_v: phases === 3 ? 380 : 220,
    phases,
    power_factor: 0.8,
    demand_factor: 1,
  };
  p.nodes = [source, load];
  p.edges = [
    {
      id: "cable",
      from: source.id,
      to: load.id,
      label: "C-01",
      sourceHandle: "out",
      properties: {
        ...cableDefaults,
        length_m: 100,
        section_mm2: 10,
        reactance_ohm_km: 0,
      },
    },
  ];
  return p;
}
test("potências trifásicas e corrente respeitam kW, kVA e tensão de linha", () => {
  const p = simpleCircuit();
  const r = nodeResult(p, p.nodes[1].id);
  near(r.active, 12);
  near(r.reactive, 9);
  near(r.apparent, 15);
  near(r.current, 15000 / (Math.sqrt(3) * 380));
});
test("motor considera rendimento e fator de demanda", () => {
  const motor = createEquipment("MOTOR", { x: 0, y: 0 });
  motor.properties = {
    ...motor.properties,
    power_kw: 45,
    efficiency: 0.9,
    power_factor: 0.8,
    demand_factor: 0.5,
  };
  const p = loadPower(motor);
  near(p.active, 25);
  near(p.reactive, 18.75);
  near(p.apparent, 31.25);
});
test("soma vetorial de P e Q não soma kVA aritmeticamente", () => {
  const p = sumPower([
    { active: 10, reactive: 0 },
    { active: 0, reactive: 10 },
  ]);
  near(p.apparent, Math.sqrt(200));
  near(p.factor, 1 / Math.sqrt(2));
});
test("queda trifásica resistiva e condutores paralelos", () => {
  const p = simpleCircuit();
  const r = cableResult(p, p.edges[0]);
  near(r.dropV, Math.sqrt(3) * r.current * 100 * (0.017241 / 10) * 0.8);
  p.edges[0].properties.parallel_runs = 2;
  near(cableResult(p, p.edges[0]).dropV, r.dropV / 2);
});
test("circuito monofásico considera ida e volta e temperatura", () => {
  const p = simpleCircuit(1);
  const r = cableResult(p, p.edges[0]);
  near(r.current, 15000 / 220);
  near(r.dropV, 2 * r.current * 100 * (0.017241 / 10) * 0.8);
  p.edges[0].properties.temperature_c = 70;
  near(cableResult(p, p.edges[0]).dropV, r.dropV * (1 + 0.00393 * 50));
});
test("transformador propaga tensão secundária sem aplicar perdas fictícias", () => {
  const p = createProject("Exemplo", true);
  const source = p.nodes.find((n) => n.type === "SOURCE")!;
  const trafo = p.nodes.find((n) => n.type === "TRANSFORMER")!;
  near(nodeResult(p, source.id).voltage, 13800);
  near(nodeResult(p, trafo.id).voltage, 380);
  near(nodeResult(p, source.id).apparent, nodeResult(p, trafo.id).apparent);
  const bus = p.nodes.find((n) => n.type === "BUSBAR")!;
  near(nodeResult(p, bus.id).active, analyze(p).total.active);
});
test("JSON roundtrip preserva hierarquia, topologia e cálculos", () => {
  const original = createProject("Industrial", true);
  original.viewport = { x: 120, y: 35, zoom: 0.7 };
  const restored = parseProject(JSON.parse(serializeProject(original)));
  assert.deepEqual(restored, original);
  near(analyze(restored).total.apparent, analyze(original).total.apparent);
});
test("importação rejeita números inválidos, ids repetidos e cabos órfãos", () => {
  const original = createProject("Industrial", true);
  const negative = structuredClone(original);
  negative.nodes.find((n) => n.type === "MOTOR")!.properties.efficiency = 0;
  assert.throws(() => parseProject(negative), /intervalo/);
  const duplicate = structuredClone(original);
  duplicate.nodes.push(duplicate.nodes[0]);
  assert.throws(() => parseProject(duplicate), /duplicados/);
  const orphan = structuredClone(original);
  orphan.edges[0].from = "missing";
  assert.throws(() => parseProject(orphan), /não existem/);
  const parent = structuredClone(original);
  parent.nodes.find((n) => n.parentId)!.parentId = "missing";
  assert.throws(() => parseProject(parent), /hierarquia/);
});
test("conexões rejeitam auto ligação, ciclos e dupla alimentação", () => {
  const p = createProject("Radial");
  p.nodes = [
    createEquipment("BUSBAR", { x: 0, y: 0 }),
    createEquipment("BUSBAR", { x: 0, y: 200 }),
    createEquipment("BUSBAR", { x: 0, y: 400 }),
  ];
  const [a, b, c] = p.nodes;
  p.edges = [
    { id: "e1", from: a.id, to: b.id, label: "C1", properties: cableDefaults },
    { id: "e2", from: b.id, to: c.id, label: "C2", properties: cableDefaults },
  ];
  assert.match(connectionError(p, a.id, a.id)!, /diferentes/);
  assert.match(connectionError(p, c.id, a.id)!, /fechado/);
  assert.match(connectionError(p, a.id, c.id)!, /alimentação/);
  const cycle = structuredClone(p);
  cycle.edges.push({
    id: "e3",
    from: c.id,
    to: a.id,
    label: "C3",
    properties: cableDefaults,
  });
  assert.throws(() => parseProject(cycle), /fechado/);
});
test("exclusão de painel remove subelementos e todas as arestas correspondentes", () => {
  const p = createProject("Industrial", true);
  const panel = p.nodes.find((n) => n.type === "PANEL")!;
  const children = p.nodes
    .filter((n) => n.parentId === panel.id)
    .map((n) => n.id);
  const deleted = deleteItems(p, [panel.id]);
  assert.ok(
    deleted.nodes.every((n) => n.id !== panel.id && !children.includes(n.id)),
  );
  assert.ok(
    deleted.edges.every(
      (e) => !children.includes(e.from) && !children.includes(e.to),
    ),
  );
  assert.doesNotThrow(() => parseProject(deleted));
});
test("cabo utiliza a tensão real de origem e sinaliza primário incompatível", () => {
  const p = createProject("Industrial", true);
  const source = p.nodes.find((n) => n.type === "SOURCE")!;
  source.properties.voltage_v = 23100;
  const edge = p.edges.find((e) => e.from === source.id)!;
  near(cableResult(p, edge).voltage, 23100);
  assert.ok(
    analyze(p).issues.some(
      (issue) => issue.id === edge.id && issue.message.includes("tensões"),
    ),
  );
});
