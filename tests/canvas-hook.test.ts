import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { createElement, StrictMode, useState } from "react";
import { createProject } from "../lib/project";
import { analyze } from "../lib/calculations";
import { useCanvasState } from "../components/use-canvas-state";

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
