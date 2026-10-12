"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { analysisSnapshot, type AnalysisSnapshot } from "@/lib/analysis-cache";
import type { Project } from "@/lib/project";

export function useProjectAnalysis(project?: Project) {
  const previous = useRef<AnalysisSnapshot | null>(null);
  const snapshot = useMemo(
    () => (project ? analysisSnapshot(previous.current, project) : null),
    [project?.nodes, project?.edges],
  );
  useLayoutEffect(() => {
    previous.current = snapshot;
  }, [snapshot]);
  return snapshot?.analysis ?? null;
}
