"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type RefObject,
} from "react";
import type { ReactFlowInstance } from "@xyflow/react";
import type { Project } from "@/lib/project";
import { viewportNeedsFit } from "@/lib/geometry";
import type { EquipmentFlowNode } from "@/lib/canvas-state";

type Camera = Pick<
  ReactFlowInstance<EquipmentFlowNode>,
  "fitView" | "setViewport"
>;
const focusOptions = {
  padding: 0.2,
  maxZoom: 0.9,
  minZoom: 0.15,
  duration: 250,
};

export function useProjectViewport(
  project: Project | undefined,
  flow: Camera | null,
  canvas: RefObject<HTMLElement | null>,
) {
  const readyProject = useRef<string | null>(null);
  const pendingFocus = useRef<{ projectId: string; ids: string[] } | null>(
    null,
  );
  useLayoutEffect(() => {
    readyProject.current = null;
    pendingFocus.current = null;
  }, [project?.projectId]);

  useEffect(() => {
    if (!project || !flow) return;
    const timer = setTimeout(() => {
      readyProject.current = project.projectId;
      const requested = pendingFocus.current;
      pendingFocus.current = null;
      if (requested?.projectId === project.projectId) {
        void flow.fitView({
          includeHiddenNodes: true,
          ...focusOptions,
          nodes: requested.ids.map((id) => ({ id })),
        });
        return;
      }
      const viewport = project.viewport;
      const box = canvas.current?.getBoundingClientRect();
      if (!project.nodes.length) void flow.setViewport(viewport);
      else if (
        (viewport.x === 0 && viewport.y === 0) ||
        (box && viewportNeedsFit(viewport, box.width, box.height))
      )
        void flow.fitView({
          includeHiddenNodes: true,
          padding: { top: "24px", bottom: "65px", x: "35px" },
          maxZoom: 0.8,
          duration: 0,
        });
      else void flow.setViewport(viewport);
    }, 90);
    return () => clearTimeout(timer);
  }, [project?.projectId, flow, canvas]);

  return useCallback(
    (ids: string[]) => {
      if (!project || !ids.length) return;
      if (!flow || readyProject.current !== project.projectId) {
        pendingFocus.current = { projectId: project.projectId, ids };
        return;
      }
      void flow.fitView({
        includeHiddenNodes: true,
        ...focusOptions,
        nodes: ids.map((id) => ({ id })),
      });
    },
    [project?.projectId, flow],
  );
}
