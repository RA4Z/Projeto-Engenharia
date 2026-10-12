import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createEquipment,
  createProject,
  createConnectionValidator,
  connectionError,
  parseProject,
  serializeProject,
} from "../lib/project";
import {
  arrangeSelection,
  setPositionLock,
  updateBatchProperties,
  batchFields,
} from "../lib/qol-editing";
import {
  finishEquipmentDrag,
  positionLockedIds,
  reparentEquipment,
} from "../lib/geometry";
import { nudgeSelection } from "../lib/editing";
import { changeCanvasNodes, syncCanvasNodes } from "../lib/canvas-state";
import { analyze } from "../lib/calculations";
import { searchCommands } from "../lib/command-search";
import { editorAction } from "../lib/shortcuts";
import type { Properties } from "../lib/catalog";

function fixture() {
  const p = createProject("QoL");
  p.nodes = [
    createEquipment("SWITCH", { x: 0, y: 20 }, "CH-01"),
    createEquipment("BUSBAR", { x: 340, y: 200 }, "Barra"),
    createEquipment("CIRCUIT_BREAKER", { x: 900, y: 800 }, "DJ-01"),
  ];
  return p;
}

test("alinhamento usa bordas e centros de símbolos com tamanhos diferentes", () => {
  const p = fixture(),
    ids = p.nodes.map((n) => n.id);
  const left = arrangeSelection(p, ids, "left");
  assert.deepEqual(
    left.nodes.map((n) => n.position.x),
    [0, 0, 0],
  );
  assert.deepEqual(
    left.nodes.map((n) => n.position.y),
    [20, 200, 800],
  );
  const right = arrangeSelection(p, ids, "right");
  assert.deepEqual(
    right.nodes.map((n) => n.position.x),
    [900, 768, 900],
  );
  const center = arrangeSelection(p, ids, "center");
  assert.deepEqual(
    center.nodes.map((n) => n.position.x),
    [450, 384, 450],
  );
  assert.deepEqual(
    arrangeSelection(p, ids, "top").nodes.map((n) => n.position.y),
    [20, 20, 20],
  );
  assert.deepEqual(
    arrangeSelection(p, ids, "bottom").nodes.map((n) => n.position.y),
    [800, 830, 800],
  );
  assert.deepEqual(
    arrangeSelection(p, ids, "middle").nodes.map((n) => n.position.y),
    [410, 425, 410],
  );
  assert.deepEqual(
    p.nodes.map((n) => n.position.x),
    [0, 340, 900],
  );
  assert.equal(arrangeSelection(left, ids, "left"), left);
});

test("distribuição mantém extremidades e iguala espaços entre bordas", () => {
  const p = fixture(),
    ids = p.nodes.map((n) => n.id);
  const result = arrangeSelection(p, ids, "horizontal");
  assert.deepEqual(
    result.nodes.map((n) => n.position.x),
    [0, 384, 900],
  );
  assert.deepEqual(
    arrangeSelection(p, ids, "vertical").nodes.map((n) => n.position.y),
    [20, 425, 800],
  );
  assert.equal(arrangeSelection(p, ids.slice(0, 2), "horizontal"), p);
  const crowded = {
    ...p,
    nodes: p.nodes.map((n) => ({ ...n, position: { x: 0, y: 0 } })),
  };
  assert.throws(
    () => arrangeSelection(crowded, ids, "horizontal"),
    /Espaço insuficiente/,
  );
});

test("alinhamento de filhos usa coordenadas absolutas, preserva pais e rejeita limites atomicamente", () => {
  const p = fixture();
  const panel = createEquipment("PANEL", { x: 200, y: 300 });
  p.nodes[0] = {
    ...p.nodes[0],
    parentId: panel.id,
    position: { x: 80, y: 100 },
  };
  p.nodes.push(panel);
  const ids = [p.nodes[0].id, p.nodes[1].id];
  const result = arrangeSelection(p, ids, "left");
  assert.equal(result.nodes[0].position.x, 80);
  assert.equal(result.nodes[1].position.x, 280);
  assert.equal(result.nodes[0].parentId, panel.id);
  const before = serializeProject(p);
  assert.throws(() => arrangeSelection(p, ids, "top"), /limites de um painel/);
  assert.equal(serializeProject(p), before);
});

test("seleção de painel e filhos move cada nível uma vez", () => {
  const p = createProject("Painel", true),
    panel = p.nodes.find((n) => n.type === "PANEL")!;
  const child = p.nodes.find((n) => n.parentId === panel.id)!;
  const other = p.nodes.find((n) => n.type === "SOURCE")!;
  const result = arrangeSelection(p, [panel.id, child.id, other.id], "right");
  assert.equal(
    result.nodes.find((n) => n.id === child.id),
    child,
  );
  assert.doesNotThrow(() => parseProject(result));
});

test("bloqueio persiste no JSON e projetos antigos continuam compatíveis", () => {
  const p = fixture(),
    locked = setPositionLock(p, [p.nodes[0].id], true);
  assert.equal(
    parseProject(JSON.parse(serializeProject(locked))).nodes[0].locked,
    true,
  );
  assert.equal(parseProject(p).nodes[0].locked, undefined);
  assert.equal(setPositionLock(locked, [p.nodes[0].id], true), locked);
  assert.equal(setPositionLock(p, [], true), p);
  assert.throws(
    () => parseProject({ ...p, nodes: [{ ...p.nodes[0], locked: "true" }] }),
    /JSON inválido/,
  );
});

test("bloqueio protege arraste, setas, alinhamento e mudanças de painel", () => {
  const p = fixture(),
    id = p.nodes[0].id,
    locked = setPositionLock(p, [id], true);
  assert.equal(
    finishEquipmentDrag(locked, [{ id, position: { x: 90, y: 90 } }]),
    locked,
  );
  assert.equal(nudgeSelection(locked, [id], 10, 10), locked);
  const aligned = arrangeSelection(
    locked,
    p.nodes.map((n) => n.id),
    "left",
  );
  assert.equal(aligned.nodes[0], locked.nodes[0]);
  assert.equal(aligned.nodes[1].position.x, 340);
  assert.equal(aligned.nodes[2].position.x, 340);
  const panel = createEquipment("PANEL", { x: 100, y: 100 });
  const withPanel = { ...locked, nodes: [...locked.nodes, panel] };
  assert.equal(reparentEquipment(withPanel, id, panel.id), withPanel);
  const unlocked = setPositionLock(locked, [id], false);
  assert.notEqual(nudgeSelection(unlocked, [id], 1, 0), unlocked);
});

test("bloqueio de painel fixa filhos; filho bloqueado impede mover painel sem bloquear seus irmãos", () => {
  const p = createProject("Painel", true),
    panel = p.nodes.find((n) => n.type === "PANEL")!;
  const children = p.nodes.filter((n) => n.parentId === panel.id);
  const lockedPanel = setPositionLock(p, [panel.id], true);
  const ids = positionLockedIds(lockedPanel);
  assert.ok(children.every((n) => ids.has(n.id)));
  assert.equal(
    nudgeSelection(lockedPanel, [children[0].id], 20, 0),
    lockedPanel,
  );
  const lockedChild = setPositionLock(p, [children[0].id], true);
  assert.equal(nudgeSelection(lockedChild, [panel.id], 30, 0), lockedChild);
  assert.equal(positionLockedIds(lockedChild).has(children[1].id), false);
});

test("React Flow rejeita mudanças transitórias em nós bloqueados mesmo junto com seleção", () => {
  const p = fixture(),
    locked = setPositionLock(p, [p.nodes[0].id], true);
  const nodes = syncCanvasNodes([], locked, analyze(locked), []),
    id = p.nodes[0].id;
  const next = changeCanvasNodes(nodes, [
    { id, type: "position", position: { x: 900, y: 900 }, dragging: true },
    { id, type: "select", selected: true },
    { id, type: "position", position: { x: 500, y: 500 }, dragging: true },
  ]);
  assert.deepEqual(next[0].position, locked.nodes[0].position);
  assert.equal(next[0].selected, true);
  assert.equal(next[0].data.positionLocked, true);
  const unlocked = setPositionLock(locked, [id], false);
  assert.equal(
    syncCanvasNodes(next, unlocked, analyze(unlocked), [id])[0].draggable,
    undefined,
  );
});

test("edição de cabos em lote identifica diferenças e preserva campos não editados", () => {
  const p = createProject("Cabos", true),
    ids = p.edges.slice(0, 3).map((e) => e.id);
  assert.equal(
    batchFields(p, ids).find((f) => f.field.key === "section_mm2")?.value,
    undefined,
  );
  const result = updateBatchProperties(p, ids, {
    section_mm2: 70,
    material: "AL",
  });
  assert.equal(result.nodes, p.nodes);
  result.edges.slice(0, 3).forEach((e, i) => {
    assert.equal(e.properties.section_mm2, 70);
    assert.equal(e.properties.material, "AL");
    assert.equal(e.properties.length_m, p.edges[i].properties.length_m);
  });
  assert.equal(result.edges[3], p.edges[3]);
  assert.equal(updateBatchProperties(result, ids, { section_mm2: 70 }), result);
  assert.equal(updateBatchProperties(p, ids, {}), p);
  assert.doesNotThrow(() => parseProject(result));
});

test("edição em lote valida tipos, limites e inteiros antes de qualquer alteração", () => {
  const p = createProject("Cabos", true),
    ids = p.edges.slice(0, 2).map((e) => e.id),
    before = serializeProject(p);
  for (const patch of [
    { section_mm2: -1 },
    { length_m: Infinity },
    { material: "STEEL" },
    { parallel_runs: 1.5 },
    { section_mm2: "70" },
    { unknown: 1 },
    { section_mm2: 70, length_m: -1 },
  ] as Properties[])
    assert.throws(() => updateBatchProperties(p, ids, patch));
  assert.equal(serializeProject(p), before);
});

test("seleções mistas só oferecem campos de significado e definição iguais", () => {
  const p = fixture();
  assert.ok(
    batchFields(
      p,
      p.nodes.map((n) => n.id),
    ).some((f) => f.field.key === "nominal_current_a"),
  );
  const demo = createProject("Misto", true);
  assert.deepEqual(batchFields(demo, [demo.nodes[0].id, demo.edges[0].id]), []);
  assert.throws(() =>
    updateBatchProperties(demo, [demo.nodes[0].id, demo.edges[0].id], {
      phases: 1,
    }),
  );
});

test("validador de prévia e criação concordam sobre destinos, auto-conexão e dupla alimentação", () => {
  const p = createProject("Conexões", true),
    validate = createConnectionValidator(p);
  for (const from of p.nodes)
    for (const to of p.nodes)
      assert.equal(
        validate(from.id, to.id),
        connectionError(p, from.id, to.id),
      );
  assert.match(validate(p.nodes[0].id, "missing")!, /não existem/);
  const breaker = createEquipment("CIRCUIT_BREAKER", { x: 0, y: 0 });
  const source = p.nodes.find((n) => n.type === "SOURCE")!;
  const extended = { ...p, nodes: [...p.nodes, breaker] };
  assert.equal(
    createConnectionValidator(extended)(source.id, breaker.id),
    null,
  );
});

test("prévia impede fechar ciclo até quando o destino ainda não tem alimentação", () => {
  const p = fixture(),
    [a, b, c] = p.nodes;
  p.edges = [
    { id: "ab", from: a.id, to: b.id, label: "AB", properties: {} },
    { id: "bc", from: b.id, to: c.id, label: "BC", properties: {} },
  ];
  const validate = createConnectionValidator(p);
  assert.match(validate(c.id, a.id)!, /circuito fechado/);
  assert.match(validate(a.id, c.id)!, /já tem uma alimentação/);
});

test("busca rápida aceita acentos, vários termos e campos auxiliares sem alterar a ordem", () => {
  const run = () => {};
  const commands = [
    { id: "1", label: "Adicionar alimentação", detail: "Biblioteca", run },
    {
      id: "2",
      label: "C-01",
      detail: "Cabo · 70 mm²",
      keywords: "DJ-01 Bomba",
      run,
    },
    { id: "3", label: "Desfazer", detail: "Ação", disabled: true, run },
  ];
  assert.deepEqual(
    searchCommands(commands, "  ALIMENTACAO  ").map((c) => c.id),
    ["1"],
  );
  assert.deepEqual(
    searchCommands(commands, "bomba 70").map((c) => c.id),
    ["2"],
  );
  assert.deepEqual(searchCommands(commands, "  "), commands);
  assert.deepEqual(searchCommands(commands, "inexistente"), []);
  assert.equal(searchCommands(commands, "desfazer")[0].disabled, true);
  assert.equal(
    searchCommands(
      [
        ...commands,
        { id: "4", label: "Alimentação", detail: "Equipamento", run },
      ],
      "alimentacao",
    )[0].id,
    "4",
  );
  for (const metaKey of [false, true])
    assert.equal(
      editorAction({
        key: "k",
        ctrlKey: !metaKey,
        metaKey,
        shiftKey: false,
        altKey: false,
      }),
      "commands",
    );
});
