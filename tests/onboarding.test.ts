import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { createElement, StrictMode } from "react";
import {
  ONBOARDING_KEY,
  rememberOnboarding,
  shouldOfferTour,
} from "../lib/onboarding";
import GuidedTour from "../components/guided-tour";

test("convite é lembrado separadamente dos projetos e tolera armazenamento indisponível", () => {
  const values = new Map([["ampai.workspace.v1", "projetos preservados"]]);
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
  assert.equal(shouldOfferTour(storage), true);
  rememberOnboarding(storage, "dismissed");
  assert.equal(shouldOfferTour(storage), false);
  assert.equal(values.get(ONBOARDING_KEY), "dismissed");
  rememberOnboarding(storage, "completed");
  assert.equal(values.get(ONBOARDING_KEY), "completed");
  assert.equal(values.get("ampai.workspace.v1"), "projetos preservados");
  const blocked = {
    getItem: () => {
      throw Error("bloqueado");
    },
    setItem: () => {
      throw Error("bloqueado");
    },
  };
  assert.equal(shouldOfferTour(blocked), false);
  assert.doesNotThrow(() => rememberOnboarding(blocked, "completed"));
});

test("tour real em StrictMode: voltar, Esc, concluir, reabrir e desmontar durante navegação", async () => {
  const dom = new JSDOM(
    '<!doctype html><html><body><button id="original">Editor</button></body></html>',
    { url: "http://localhost", pretendToBeVisual: true },
  );
  for (const key of [
    "window",
    "document",
    "navigator",
    "HTMLElement",
    "Element",
    "SVGElement",
    "KeyboardEvent",
    "getComputedStyle",
    "requestAnimationFrame",
    "cancelAnimationFrame",
  ] as const) {
    const value = key === "window" ? dom.window : dom.window[key];
    Object.defineProperty(globalThis, key, {
      value:
        typeof value === "function" &&
        [
          "getComputedStyle",
          "requestAnimationFrame",
          "cancelAnimationFrame",
        ].includes(key)
          ? (value as (...args: unknown[]) => unknown).bind(dom.window)
          : value,
      configurable: true,
    });
  }
  dom.window.HTMLElement.prototype.scrollIntoView = () => {};
  const { render, act, fireEvent, waitFor, cleanup } =
    await import("@testing-library/react");
  const exits: boolean[] = [],
    panels: (string | undefined)[] = [];
  let errors = 0;
  const callbacks = {
    onPrepare: (panel?: string) => {
      panels.push(panel);
    },
    onExit: (completed: boolean) => {
      exits.push(completed);
    },
    onError: () => {
      errors++;
    },
  };
  const view = (active: boolean) =>
    createElement(
      StrictMode,
      null,
      createElement(GuidedTour, { active, ...callbacks }),
    );
  const result = render(view(true));
  const currentStep = () =>
    document.querySelector(".driver-popover-progress-text")?.textContent;
  const waitStep = async (step: number) => {
    await waitFor(() => assert.equal(currentStep(), `${step} de 10`));
    // Driver settles its stage on the following animation frame, even without animation.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 40));
    });
  };
  const next = () =>
    fireEvent.click(document.querySelector(".driver-popover-next-btn")!);
  await waitStep(1);
  assert.equal(document.querySelectorAll(".driver-popover").length, 1);
  act(next);
  await waitStep(2);
  assert.equal(panels.at(-1), "projects");
  act(() => fireEvent.keyUp(document, { key: "ArrowLeft", code: "ArrowLeft" }));
  await waitStep(1);
  act(() => fireEvent.keyUp(document, { key: "Escape", code: "Escape" }));
  assert.deepEqual(exits, [false]);
  assert.equal(document.querySelector(".driver-overlay"), null);
  result.rerender(view(false));
  result.rerender(view(true));
  await waitStep(1);
  for (let step = 2; step <= 10; step++) {
    act(next);
    await waitStep(step);
  }
  act(next);
  assert.deepEqual(exits, [false, true]);
  result.rerender(view(false));
  result.rerender(view(true));
  await waitStep(1);
  act(next);
  result.unmount();
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 60));
  });
  assert.equal(document.querySelector(".driver-popover"), null);
  assert.equal(document.querySelector(".driver-overlay"), null);
  assert.equal(document.body.classList.contains("driver-active"), false);
  assert.deepEqual(exits, [false, true]);
  assert.equal(errors, 0);
  const early = render(view(true));
  act(() => fireEvent.keyDown(window, { key: "Escape", code: "Escape" }));
  early.unmount();
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 60));
  });
  assert.deepEqual(exits, [false, true, false]);
  assert.equal(document.querySelector(".driver-popover"), null);
  cleanup();
  dom.window.close();
});
