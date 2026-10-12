import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { createElement, StrictMode, useState } from "react";
import { createProject } from "../lib/project";
import { analyze } from "../lib/calculations";
import { useCanvasState } from "../components/use-canvas-state";
import { useProjectAnalysis } from "../components/use-project-analysis";
import { useProjectViewport } from "../components/use-project-viewport";
import type { FitViewOptions, Viewport } from "@xyflow/react";

test("hook React em StrictMode suporta medidas, 300 movimentos, seleção e sincronização sem loop", async () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost",
  });
  Object.defineProperty(globalThis, "window", {
    value: dom.window,
    configurable: true,
  });
  Object.defineProperty(globalThis, "document", {
    value: dom.window.document,
    configurable: true,
  });
  Object.defineProperty(globalThis, "navigator", {
    value: dom.window.navigator,
    configurable: true,
  });
  const { renderHook, act, cleanup } = await import("@testing-library/react");
  const project = createProject("Regressão", true),
    analysis = analyze(project);
  let renders = 0;
  const { result, rerender } = renderHook(
    ({ p }) => {
      renders++;
      const [selection, onSelection] = useState<string[]>([]);
      return {
        ...useCanvasState(p, analysis, selection, onSelection),
        selection,
      };
    },
    {
      initialProps: { p: project },
      wrapper: ({ children }) => createElement(StrictMode, null, children),
    },
  );
  const id = project.nodes.find((n) => n.type === "SOURCE")!.id;
  const handler = result.current.onNodesChange;
  act(() =>
    result.current.onNodesChange([
      {
        type: "dimensions",
        id,
        dimensions: { width: 168, height: 120 },
        setAttributes: true,
      },
      { type: "select", id, selected: true },
    ]),
  );
  assert.deepEqual(result.current.selection, [id]);
  for (let i = 0; i < 300; i++)
    act(() =>
      result.current.onNodesChange([
        { type: "position", id, position: { x: i, y: i }, dragging: true },
      ]),
    );
  assert.deepEqual(result.current.nodes.find((n) => n.id === id)!.position, {
    x: 299,
    y: 299,
  });
  assert.equal(result.current.onNodesChange, handler);
  // A viewport render during a drag must not reset the position from the durable project.
  rerender({ p: { ...project, viewport: { x: 5, y: 6, zoom: 0.7 } } });
  assert.deepEqual(result.current.nodes.find((n) => n.id === id)!.position, {
    x: 299,
    y: 299,
  });
  assert.ok(renders < 650, `Atualizações excessivas: ${renders}`);
  cleanup();
  dom.window.close();
});

test("cache de análise em StrictMode preserva resultados ao mover e recalcula ao editar potência", async () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost",
  });
  for (const [key, value] of Object.entries({
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
  }))
    Object.defineProperty(globalThis, key, { value, configurable: true });
  const { renderHook, cleanup } = await import("@testing-library/react");
  const project = createProject("Análise React", true);
  let renders = 0;
  const { result, rerender } = renderHook(
    ({ p }: { p?: typeof project }) => {
      renders++;
      return useProjectAnalysis(p);
    },
    {
      initialProps: { p: undefined as typeof project | undefined },
      wrapper: ({ children }) => createElement(StrictMode, null, children),
    },
  );
  assert.equal(result.current, null);
  rerender({ p: project });
  const first = result.current;
  for (let i = 0; i < 100; i++) {
    rerender({
      p: {
        ...project,
        nodes: project.nodes.map((node, index) =>
          index === 1 ? { ...node, position: { x: i, y: -100 } } : node,
        ),
      },
    });
    assert.equal(result.current, first);
  }
  const edited = {
    ...project,
    nodes: project.nodes.map((node) =>
      node.type === "MOTOR"
        ? { ...node, properties: { ...node.properties, power_kw: 120 } }
        : node,
    ),
  };
  rerender({ p: edited });
  assert.notEqual(result.current, first);
  assert.deepEqual(result.current, analyze(edited));
  assert.ok(renders < 230, `Renderizações excessivas: ${renders}`);
  cleanup();
  dom.window.close();
});

test("localizar antes da inicialização prevalece sobre a câmera salva e não vaza entre projetos", async () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost",
  });
  for (const [key, value] of Object.entries({
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
  }))
    Object.defineProperty(globalThis, key, { value, configurable: true });
  const { renderHook, act, cleanup } = await import("@testing-library/react");
  const project = createProject("Câmera", true);
  project.viewport = { x: 100, y: 100, zoom: 0.7 };
  const cameraCalls: { type: string; ids?: string[] }[] = [];
  const flow = {
    fitView: async (options?: FitViewOptions) => {
      cameraCalls.push({
        type: "focus",
        ids: options?.nodes?.map((node) => node.id),
      });
      return true;
    },
    setViewport: async (_viewport: Viewport) => {
      cameraCalls.push({ type: "restore" });
      return true;
    },
  };
  const canvas = { current: dom.window.document.createElement("div") };
  const { result, rerender } = renderHook(
    ({ p, camera }: { p: typeof project; camera: typeof flow | null }) =>
      useProjectViewport(p, camera, canvas),
    {
      initialProps: { p: project, camera: null as typeof flow | null },
      wrapper: ({ children }) => createElement(StrictMode, null, children),
    },
  );
  act(() => result.current([project.nodes[1].id]));
  act(() => result.current([project.nodes[2].id]));
  rerender({ p: project, camera: flow });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 120));
  });
  assert.deepEqual(cameraCalls, [
    { type: "focus", ids: [project.nodes[2].id] },
  ]);
  act(() => result.current([project.nodes[3].id]));
  assert.equal(cameraCalls.length, 2);
  const other = createProject("Outro projeto");
  rerender({ p: project, camera: null });
  act(() => result.current([project.nodes[4].id]));
  rerender({ p: other, camera: flow });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 120));
  });
  assert.equal(cameraCalls.at(-1)?.type, "restore");
  assert.equal(cameraCalls.length, 3);
  cleanup();
  dom.window.close();
});
