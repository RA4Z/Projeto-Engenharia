import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { createElement } from "react";
import { ReactFlowProvider, useStoreApi } from "@xyflow/react";
import { useDiagramDetail } from "../components/cable-edge";
import ProjectsOverview from "../components/projects-overview";
import Inspector from "../components/inspector";
import { createProject } from "../lib/project";
import { analyze } from "../lib/calculations";

test("interfaces de usabilidade mantêm foco, busca e detalhes por faixas de zoom", async (t) => {
  const dom = new JSDOM(
    "<!doctype html><html><body><button id='origin'>Projetos</button></body></html>",
    { url: "http://localhost" },
  );
  for (const [key, value] of Object.entries({
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    Node: dom.window.Node,
  }))
    Object.defineProperty(globalThis, key, { value, configurable: true });
  const { render, fireEvent, cleanup, act } =
    await import("@testing-library/react");
  t.afterEach(cleanup);
  t.after(() => dom.window.close());

  await t.test(
    "zoom só altera nível de detalhe ao atravessar uma faixa",
    () => {
      let store: ReturnType<typeof useStoreApi> | undefined,
        renders = 0;
      function Detail() {
        store = useStoreApi();
        const detail = useDiagramDetail();
        renders++;
        return createElement(
          "span",
          { "data-testid": "detail" },
          String(detail),
        );
      }
      const view = render(
        createElement(ReactFlowProvider, null, createElement(Detail)),
      );
      assert.equal(view.getByTestId("detail").textContent, "2");
      const before = renders;
      for (let i = 0; i < 100; i++)
        act(() => store!.setState({ transform: [i, i, 1] }));
      assert.equal(renders, before);
      act(() => store!.setState({ transform: [0, 0, 0.6] }));
      assert.equal(view.getByTestId("detail").textContent, "1");
      const compact = renders;
      for (const zoom of [0.5, 0.55, 0.7, 0.75])
        act(() => store!.setState({ transform: [0, 0, zoom] }));
      assert.equal(renders, compact);
      act(() => store!.setState({ transform: [0, 0, 0.3] }));
      assert.equal(view.getByTestId("detail").textContent, "0");
    },
  );

  await t.test(
    "visão geral busca sem acentos, abre/renomeia/exporta o projeto correto e restaura foco",
    () => {
      const a = createProject("Instalação", true),
        b = createProject("Alternativa"),
        opened: string[] = [],
        exports: string[] = [],
        names: string[] = [],
        noop = () => {};
      const origin = document.getElementById("origin")!;
      origin.focus();
      const view = render(
        createElement(ProjectsOverview, {
          projects: [a, b],
          activeId: a.projectId,
          onClose: noop,
          onNew: noop,
          onOpen: (id) => opened.push(id),
          onRename: (id) => names.push(id),
          onExport: (p) => exports.push(p.projectId),
        }),
      );
      assert.equal(
        document.activeElement?.getAttribute("aria-label"),
        "Buscar projetos",
      );
      assert.equal(view.getAllByRole("listitem").length, 2);
      fireEvent.change(view.getByRole("textbox", { name: "Buscar projetos" }), {
        target: { value: "INSTALACAO" },
      });
      assert.equal(view.getAllByRole("listitem").length, 1);
      fireEvent.click(
        view.getByRole("button", { name: "Abrir projeto Instalação" }),
      );
      assert.deepEqual(opened, [a.projectId]);
      fireEvent.click(
        view.getByRole("button", { name: "Renomear Instalação" }),
      );
      assert.deepEqual(names, [a.projectId]);
      fireEvent.click(
        view.getByRole("button", { name: "Exportar JSON de Instalação" }),
      );
      assert.deepEqual(exports, [a.projectId]);
      fireEvent.change(view.getByRole("textbox", { name: "Buscar projetos" }), {
        target: { value: "inexistente" },
      });
      assert.equal(view.queryAllByRole("listitem").length, 0);
      assert.ok(view.getByRole("status"));
      view.unmount();
      assert.equal(document.activeElement, origin);
    },
  );

  await t.test(
    "observações oferecem localizar e abrir propriedades como ações distintas",
    () => {
      const p = createProject("Observações", true);
      p.nodes.find((n) => n.type === "MOTOR")!.properties.voltage_v = 220;
      const analysis = analyze(p),
        located: string[] = [],
        selected: string[] = [],
        noop = () => {};
      assert.ok(analysis.issues.length > 0);
      const view = render(
        createElement(Inspector, {
          project: p,
          analysis,
          selection: null,
          selectedIds: [],
          tab: "analysis",
          onTab: noop,
          onUpdate: noop,
          onDelete: noop,
          onDuplicate: noop,
          onParent: noop,
          onClear: noop,
          onSelect: (id) => selected.push(id),
          onClose: noop,
          onBatchUpdate: noop,
          onLock: noop,
          onLocate: (id) => located.push(id),
        }),
      );
      fireEvent.click(view.getAllByRole("button", { name: "Localizar" })[0]);
      assert.deepEqual(located, [analysis.issues[0].id]);
      assert.equal(selected.length, 0);
      fireEvent.click(
        view.getAllByRole("button", {
          name: "Ver propriedades",
        })[0],
      );
      assert.deepEqual(selected, [analysis.issues[0].id]);
    },
  );
});
