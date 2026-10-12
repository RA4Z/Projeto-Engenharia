import { test } from "node:test";
import assert from "node:assert/strict";
import {
  captureSelection,
  insertFragment,
  nudgeSelection,
} from "../lib/editing";
import {
  createProject,
  deleteItems,
  parseProjectText,
  serializeProject,
} from "../lib/project";
import { reparentEquipment } from "../lib/geometry";
import { renderDiagramSvg } from "../lib/diagram-export";
import { analyze } from "../lib/calculations";

test("200 operações de edição, cópia, exclusão, recuperação e exportação conservam um projeto válido", () => {
  let project = createProject("Uso intensivo", true);
  project.edges[0].properties.voltage_class = "8.7/15";
  const baseline = serializeProject(project);
  for (let i = 0; i < 200; i++) {
    const previous = project;
    const node = project.nodes[i % project.nodes.length];
    switch (i % 5) {
      case 0:
        project = nudgeSelection(project, [node.id], i % 2 ? -10 : 10, 1);
        break;
      case 1:
        project = insertFragment(
          project,
          captureSelection(project, [node.id]),
          { duplicate: true },
        ).project;
        break;
      case 2:
        project = reparentEquipment(project, node.id, "");
        break;
      case 3:
        if (node.label.includes(" · cópia"))
          project = deleteItems(project, [node.id]);
        break;
      case 4: {
        const exported = serializeProject(project);
        project = parseProjectText("\uFEFF" + exported);
        assert.equal(serializeProject(project), exported);
        assert.ok(
          renderDiagramSvg(project).svg.includes(
            'xmlns="http://www.w3.org/2000/svg"',
          ),
        );
        break;
      }
    }
    assert.doesNotThrow(() => serializeProject(project));
    const results = analyze(project);
    assert.ok(Number.isFinite(results.total.active));
    assert.ok(
      Array.from(results.cables.values()).every((cable) =>
        Number.isFinite(cable.dropV),
      ),
    );
    // An undo snapshot remains independently exportable after every editing operation.
    assert.doesNotThrow(() => serializeProject(previous));
  }
  assert.doesNotThrow(() => parseProjectText(baseline));
});

test("uma seleção com 1.900 equipamentos gera SVG completo com coordenadas negativas e texto longo", () => {
  const project = createProject("Grande projeto", true);
  const load = project.nodes.find((n) => n.type === "LOAD")!;
  project.nodes = Array.from({ length: 1900 }, (_, i) => ({
    ...load,
    id: `load_${i}`,
    label: `Carga ${i} · ${"Á".repeat(75)}`,
    position: { x: (i % 50) * 210 - 6000, y: Math.floor(i / 50) * 160 - 3000 },
    properties: { ...load.properties },
  }));
  project.edges = [];
  const result = renderDiagramSvg(project);
  assert.equal((result.svg.match(/<rect x="14"/g) ?? []).length, 1900);
  assert.ok(result.width > 10000 && result.height > 5000);
  assert.ok(result.svg.includes("Carga 1899"));
});
