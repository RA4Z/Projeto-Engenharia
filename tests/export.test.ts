import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createProject,
  createEquipment,
  parseProject,
  parseProjectText,
  serializeProject,
} from "../lib/project";
import { cableFields } from "../lib/catalog";
import {
  diagramLayout,
  rasterSize,
  renderDiagramSvg,
  fileStem,
} from "../lib/diagram-export";
import {
  nextCableLabel,
  reparentEquipment,
  viewportNeedsFit,
} from "../lib/geometry";

test("JSONs antigos ganham classe não informada, sem assumir isolação", () => {
  const old = createProject("Legado", true);
  for (const edge of old.edges) delete edge.properties.voltage_class;
  const result = parseProject(old);
  assert.ok(
    result.edges.every(
      (edge) => edge.properties.voltage_class === "UNSPECIFIED",
    ),
  );
  assert.ok(
    old.edges.every((edge) => !Object.hasOwn(edge.properties, "voltage_class")),
  );
});

test("classes de tensão aceitas sobrevivem à exportação/importação; valores inválidos são rejeitados", () => {
  const project = createProject("Classes", true);
  for (const option of cableFields.find((f) => f.key === "voltage_class")!
    .options!) {
    project.edges[0].properties.voltage_class = option.value;
    assert.equal(
      parseProjectText(serializeProject(project)).edges[0].properties
        .voltage_class,
      option.value,
    );
  }
  project.edges[0].properties.voltage_class = "fantasia";
  assert.throws(() => parseProject(project), /Classe de tensão/);
});

test("importação aceita BOM de arquivos Windows e informa erros de sintaxe em português", () => {
  const project = createProject("JSON Windows", true);
  assert.deepEqual(
    parseProjectText("\uFEFF" + serializeProject(project)),
    project,
  );
  assert.throws(() => parseProjectText("isto não é JSON"), /JSON válido/);
  assert.throws(() => parseProjectText("{}"), /formato incompatível/);
});

test("SVG inclui o projeto inteiro, filhos absolutos e classe dos cabos sem depender da viewport", () => {
  const project = createProject("Exportação", true);
  project.edges[0].properties.voltage_class = "8.7/15";
  const before = serializeProject(project);
  const first = renderDiagramSvg(project);
  project.viewport = { x: 900000, y: -900000, zoom: 0.15 };
  assert.deepEqual(renderDiagramSvg(project), first);
  assert.equal(
    serializeProject({ ...project, viewport: JSON.parse(before).viewport }),
    before,
  );
  const panel = project.nodes.find((n) => n.type === "PANEL")!;
  const child = project.nodes.find((n) => n.parentId === panel.id)!;
  const box = diagramLayout(project).boxes.get(child.id)!;
  assert.equal(box.x, panel.position.x + child.position.x);
  assert.equal(box.y, panel.position.y + child.position.y);
  assert.match(first.svg, /8,7\/15 kV/);
  for (const node of project.nodes) assert.ok(first.svg.includes(node.label));
  assert.doesNotMatch(
    first.svg,
    /foreignObject|canvas-toolbar|react-flow__handle|is-selected/,
  );
});

test("exportação rejeita projeto vazio e escapa textos sem executar HTML", () => {
  const project = createProject("Vazio");
  assert.throws(() => renderDiagramSvg(project), /Adicione/);
  project.nodes = [
    createEquipment("LOAD", { x: -100000, y: -100000 }, "<script>x</script>&"),
  ];
  const result = renderDiagramSvg(project);
  assert.ok(result.svg.includes("&lt;script&gt;"));
  assert.ok(!result.svg.includes("<script>"));
  assert.ok(result.width > 168 && result.height > 120);
});

test("rasterização respeita teto de memória e dimensões sem cortar diagramas extremos", () => {
  for (const [width, height] of [
    [800, 1300],
    [200500, 200500],
    [200500, 150],
    [150, 200500],
  ]) {
    const size = rasterSize(width, height);
    assert.ok(size.width <= 8192 && size.height <= 8192);
    assert.ok(size.width * size.height <= 16_000_000);
    assert.ok(size.width > 0 && size.height > 0);
    assert.ok(
      Math.abs(size.width / width - size.height / height) <
        1 / Math.min(width, height),
    );
  }
  assert.deepEqual(rasterSize(800, 1300), {
    width: 2400,
    height: 3900,
    reduced: false,
  });
});

test("arquivos têm nomes seguros mesmo com caracteres especiais ou nomes sem alfabeto latino", () => {
  assert.equal(fileStem("Subestação / área: teste?"), "subestacao-area-teste");
  assert.equal(fileStem("???"), "projeto");
  assert.equal(fileStem("Á".repeat(150)).length, 100);
});

test("rótulos de cabos não colidem depois de excluir um circuito", () => {
  const project = createProject("Rótulos", true);
  project.edges = project.edges.filter((edge) => edge.label !== "C-03");
  assert.equal(nextCableLabel(project), "C-03");
  project.edges = [];
  assert.equal(nextCableLabel(project), "C-01");
});

test("retirar filho de painel na borda mantém JSON válido e não modifica o original", () => {
  const project = createProject("Borda", true);
  const panel = project.nodes.find((n) => n.type === "PANEL")!;
  panel.position = { x: 100000, y: 100000 };
  const child = project.nodes.find((n) => n.parentId === panel.id)!;
  const next = reparentEquipment(project, child.id, "");
  assert.equal(next.nodes.find((n) => n.id === child.id)!.parentId, undefined);
  assert.deepEqual(next.nodes.find((n) => n.id === child.id)!.position, {
    x: 100000,
    y: 100000,
  });
  assert.equal(child.parentId, panel.id);
  assert.doesNotThrow(() => parseProject(next));
  assert.equal(reparentEquipment(project, child.id, panel.id), project);
  assert.equal(reparentEquipment(project, child.id, "inexistente"), project);
});

test("abrir um projeto em outra dimensão de tela reenquadra, mas mantém a vista de uma mesma tela", () => {
  const saved = {
    x: 100,
    y: 50,
    zoom: 0.8,
    canvasWidth: 900,
    canvasHeight: 600,
  };
  assert.equal(viewportNeedsFit(saved, 360, 600), true);
  assert.equal(viewportNeedsFit(saved, 900, 600), false);
  assert.equal(viewportNeedsFit(saved, 880, 610), false);
  assert.equal(viewportNeedsFit({ x: 100, y: 50, zoom: 0.8 }, 360, 600), true);
  assert.equal(viewportNeedsFit({ x: 100, y: 50, zoom: 0.8 }, 900, 600), false);
  const project = createProject("Vista");
  project.viewport = saved;
  assert.deepEqual(parseProjectText(serializeProject(project)).viewport, saved);
});
