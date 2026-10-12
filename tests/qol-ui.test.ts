import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { createElement } from "react";
import Inspector from "../components/inspector";
import ActionMenu from "../components/action-menu";
import CommandPalette from "../components/command-palette";
import { createProject } from "../lib/project";
import { analyze } from "../lib/calculations";
import type { Properties } from "../lib/catalog";
import {
  ReactFlowProvider,
  useStoreApi,
  Position,
  type InternalNode,
  type ConnectionInProgress,
} from "@xyflow/react";
import {
  ConnectionHint,
  ConnectionPreviewContext,
} from "../components/connection-preview";
import { createConnectionValidator, createEquipment } from "../lib/project";
import { syncCanvasNodes } from "../lib/canvas-state";

test("interfaces QoL mantêm valores mistos e navegação pelo teclado", async (t) => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost",
  });
  for (const [key, value] of Object.entries({
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    Node: dom.window.Node,
  }))
    Object.defineProperty(globalThis, key, { value, configurable: true });
  const { render, fireEvent, cleanup } = await import("@testing-library/react");
  const { act } = await import("@testing-library/react");
  t.afterEach(cleanup);
  t.after(() => dom.window.close());

  await t.test(
    "inspector em lote não aplica campos mistos vazios nem números inválidos",
    () => {
      const p = createProject("Cabos", true),
        patches: Properties[] = [];
      const ids = p.edges.slice(0, 2).map((e) => e.id),
        noop = () => {};
      const view = render(
        createElement(Inspector, {
          project: p,
          analysis: analyze(p),
          selection: null,
          selectedIds: ids,
          selectionSummary: { equipment: 0, cables: 2 },
          tab: "properties",
          onTab: noop,
          onUpdate: noop,
          onDelete: noop,
          onDuplicate: noop,
          onParent: noop,
          onClear: noop,
          onSelect: noop,
          onClose: noop,
          onLock: noop,
          onBatchUpdate: (patch) => patches.push(patch),
        }),
      );
      const section = view.getByRole("spinbutton", {
        name: "Seção por condutor",
      }) as HTMLInputElement;
      assert.equal(section.value, "");
      assert.equal(section.placeholder, "Valores diferentes");
      fireEvent.focus(section);
      fireEvent.blur(section);
      assert.equal(patches.length, 0);
      fireEvent.change(section, { target: { value: "-1" } });
      fireEvent.blur(section);
      assert.equal(patches.length, 0);
      assert.ok(view.getByText(/Informe um valor entre/));
      fireEvent.change(section, { target: { value: "70" } });
      fireEvent.blur(section);
      assert.deepEqual(patches, [{ section_mm2: 70 }]);
      fireEvent.change(view.getByRole("combobox", { name: "Condutor" }), {
        target: { value: "AL" },
      });
      assert.deepEqual(patches.at(-1), { material: "AL" });
      assert.equal(p.edges[0].properties.section_mm2, 50);
    },
  );

  await t.test(
    "menu contextual ignora ações indisponíveis e suporta setas, Enter e Escape",
    () => {
      let count = 0,
        closed = 0;
      const view = render(
        createElement(ActionMenu, {
          x: 2000,
          y: 2000,
          label: "Ações",
          onClose: () => closed++,
          actions: [
            {
              label: "Indisponível",
              disabled: true,
              run: () => (count += 100),
            },
            { label: "Primeira", run: () => count++ },
            { label: "Segunda", run: () => (count += 2) },
          ],
        }),
      );
      assert.equal(document.activeElement?.textContent, "Primeira");
      fireEvent.keyDown(view.getByRole("menu"), { key: "ArrowDown" });
      assert.equal(document.activeElement?.textContent, "Segunda");
      fireEvent.click(view.getByRole("menuitem", { name: "Segunda" }));
      assert.equal(count, 2);
      assert.equal(closed, 1);
      fireEvent.keyDown(view.getByRole("menu"), { key: "Escape" });
      assert.equal(closed, 2);
      const box = view.getByRole("menu");
      assert.ok(Number.parseInt(box.style.left) < 2000);
      assert.ok(Number.parseInt(box.style.top) < 2000);
    },
  );

  await t.test(
    "paleta pula ações desativadas, executa uma vez e mantém foco na janela",
    () => {
      let count = 0,
        closed = 0;
      const view = render(
        createElement(CommandPalette, {
          onClose: () => closed++,
          commands: [
            {
              id: "disabled",
              label: "Desativada",
              detail: "Ação",
              disabled: true,
              run: () => (count += 100),
            },
            {
              id: "first",
              label: "Concessionária",
              detail: "Equipamento",
              run: () => count++,
            },
            {
              id: "second",
              label: "Gerador",
              detail: "Equipamento",
              run: () => (count += 2),
            },
          ],
        }),
      );
      const input = view.getByRole("combobox");
      assert.equal(document.activeElement, input);
      assert.equal(
        input.getAttribute("aria-activedescendant"),
        "command-first",
      );
      fireEvent.keyDown(input, { key: "ArrowDown" });
      assert.equal(
        input.getAttribute("aria-activedescendant"),
        "command-second",
      );
      fireEvent.keyDown(input, { key: "Enter" });
      assert.equal(count, 2);
      assert.equal(closed, 1);
      fireEvent.change(input, { target: { value: "concessionaria" } });
      assert.equal(view.getAllByRole("option").length, 1);
      assert.equal(
        input.getAttribute("aria-activedescendant"),
        "command-first",
      );
      const option = view.getByRole("option");
      option.focus();
      fireEvent.keyDown(option, { key: "Tab" });
      assert.equal(document.activeElement, input);
      fireEvent.change(input, { target: { value: "inexistente" } });
      assert.equal(view.queryAllByRole("option").length, 0);
      fireEvent.keyDown(input, { key: "Enter" });
      assert.equal(count, 2);
      fireEvent.keyDown(input, { key: "Escape" });
      assert.equal(closed, 2);
    },
  );
  await t.test(
    "prévia usa o estado real do React Flow, informa rejeição antes de soltar e Esc cancela",
    () => {
      const p = createProject("Prévia", true);
      const free = createEquipment("CIRCUIT_BREAKER", { x: 900, y: 0 });
      p.nodes.push(free);
      const nodes = syncCanvasNodes([], p, analyze(p), []);
      const internal = (id: string): InternalNode => {
        const node = nodes.find((n) => n.id === id)!;
        return {
          ...node,
          measured: node.measured ?? { width: 168, height: 120 },
          internals: { positionAbsolute: node.position, z: 0, userNode: node },
        };
      };
      const source = internal(p.nodes.find((n) => n.type === "SOURCE")!.id);
      const trafo = internal(p.nodes.find((n) => n.type === "TRANSFORMER")!.id);
      let store: ReturnType<typeof useStoreApi> | undefined;
      function Probe() {
        store = useStoreApi();
        return createElement(ConnectionHint);
      }
      const view = render(
        createElement(
          ReactFlowProvider,
          null,
          createElement(
            ConnectionPreviewContext.Provider,
            {
              value: {
                destinations: new Map(),
                validate: createConnectionValidator(p),
                destinationType: "target",
              },
            },
            createElement(Probe),
          ),
        ),
      );
      const connection: ConnectionInProgress = {
        inProgress: true,
        isValid: null,
        from: { x: 0, y: 0 },
        to: { x: 0, y: 0 },
        pointer: { x: 0, y: 0 },
        fromNode: source,
        fromPosition: Position.Bottom,
        toPosition: Position.Top,
        fromHandle: {
          id: "out",
          type: "source",
          nodeId: source.id,
          position: Position.Bottom,
          x: 0,
          y: 0,
          width: 7,
          height: 7,
        },
        toNode: null,
        toHandle: null,
      };
      act(() => store!.getState().updateConnection(connection));
      assert.match(view.getByRole("status").textContent!, /Escolha uma porta/);
      act(() =>
        store!.getState().updateConnection({
          ...connection,
          toNode: trafo,
          toHandle: {
            ...connection.fromHandle,
            id: "in",
            type: "target",
            nodeId: trafo.id,
            position: Position.Top,
          },
          isValid: false,
        }),
      );
      assert.match(
        view.getByRole("status").textContent!,
        /já tem uma alimentação/,
      );
      act(() =>
        store!.getState().updateConnection({
          ...connection,
          toNode: internal(free.id),
          toHandle: {
            ...connection.fromHandle,
            id: "in",
            type: "target",
            nodeId: free.id,
            position: Position.Top,
          },
          isValid: true,
        }),
      );
      assert.match(view.getByRole("status").textContent!, /Conexão permitida/);
      act(() =>
        store!.getState().updateConnection({
          ...connection,
          toNode: internal(free.id),
          toHandle: { ...connection.fromHandle, nodeId: free.id },
          isValid: false,
        }),
      );
      assert.match(
        view.getByRole("status").textContent!,
        /saída a uma entrada/,
      );
      act(() => fireEvent.keyDown(window, { key: "Escape" }));
      assert.equal(view.queryByRole("status"), null);
      assert.equal(store!.getState().connection.inProgress, false);
      assert.equal(p.edges.length, 9);
    },
  );
});
