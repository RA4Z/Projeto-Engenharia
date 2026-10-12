"use client";

import { useEffect } from "react";
import { flushSync } from "react-dom";
import type { Driver } from "driver.js";
import { tourSteps, type TourPanel } from "@/lib/onboarding";

export default function GuidedTour({
  active,
  onPrepare,
  onExit,
  onError,
}: {
  active: boolean;
  onPrepare: (panel?: TourPanel) => void;
  onExit: (completed: boolean) => void;
  onError: () => void;
}) {
  useEffect(() => {
    if (!active) return;
    let disposed = false;
    let frame = 0;
    let instance: Driver | undefined;
    let navigating = false;

    const exit = (completed: boolean) => {
      if (disposed) return;
      disposed = true;
      window.removeEventListener("keydown", escape, true);
      cancelAnimationFrame(frame);
      if (instance?.isActive()) instance.destroy();
      onExit(completed);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      exit(false);
    };
    window.addEventListener("keydown", escape, true);

    const navigate = (index: number) => {
      if (disposed || navigating || !instance) return;
      navigating = true;
      flushSync(() => onPrepare(tourSteps[index].panel));
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => {
          if (disposed || !instance) return;
          instance.drive(index);
          navigating = false;
        });
      });
    };

    void import("driver.js")
      .then(({ driver }) => {
        if (disposed) return;
        instance = driver({
          animate: false,
          overlayColor: "#182b25",
          overlayOpacity: 0.55,
          overlayClickBehavior: "none",
          disableActiveInteraction: true,
          stagePadding: 6,
          stageRadius: 12,
          popoverClass: "ampai-tour",
          showProgress: true,
          progressText: "{{current}} de {{total}}",
          nextBtnText: "Próximo",
          prevBtnText: "Voltar",
          doneBtnText: "Concluir tour",
          closeBtnLabel: "Encerrar tour",
          steps: tourSteps.map((step) => ({
            element: step.target ? `[data-tour="${step.target}"]` : undefined,
            popover: {
              title: step.title,
              description: step.description,
              side: step.panel ? "left" : "bottom",
              align: "center",
            },
          })),
          onNextClick: (_element, _step, { index }) => {
            if (index !== undefined && index < tourSteps.length - 1)
              navigate(index + 1);
          },
          onPrevClick: (_element, _step, { index }) => {
            if (index !== undefined && index > 0) navigate(index - 1);
          },
          onDoneClick: () => {
            exit(true);
          },
          onCloseClick: () => exit(false),
          onPopoverRender: (popover) => {
            popover.nextButton.focus({ preventScroll: true });
          },
          onDestroyed: () => {
            exit(false);
          },
        });
        navigate(0);
      })
      .catch(() => {
        if (!disposed) {
          exit(false);
          onError();
        }
      });

    return () => {
      disposed = true;
      window.removeEventListener("keydown", escape, true);
      cancelAnimationFrame(frame);
      if (instance?.isActive()) instance.destroy();
    };
  }, [active, onPrepare, onExit, onError]);

  return null;
}
