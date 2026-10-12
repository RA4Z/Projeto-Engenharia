import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { catalog, cableFields } from "./catalog";
import { number } from "./calculations";
import { equipmentSize } from "./geometry";
import { parseProject, type Project, type Equipment } from "./project";
import Symbol from "../components/symbol";
import { cablePath } from "./cable-path";
import { canvasGeometry } from "./canvas-geometry";

type Box = { x: number; y: number; width: number; height: number };

import { fileStem } from "./files";
export { fileStem } from "./files";

export type ExportOptions = {
  names: boolean;
  details: boolean;
  cableLabels: boolean;
  padding: number;
  orientation: "auto" | "portrait" | "landscape";
  paper: "a3" | "a4";
  marginMm: number;
  filename?: string;
};
export const defaultExportOptions: ExportOptions = {
  names: true,
  details: true,
  cableLabels: true,
  padding: 48,
  orientation: "auto",
  paper: "a3",
  marginMm: 10,
};
export function exportSheet(
  width: number,
  height: number,
  options: ExportOptions,
) {
  const orientation =
    options.orientation === "auto"
      ? width > height
        ? "landscape"
        : "portrait"
      : options.orientation;
  const [short, long] = options.paper === "a4" ? [210, 297] : [297, 420];
  const pageWidth = orientation === "landscape" ? long : short,
    pageHeight = orientation === "landscape" ? short : long;
  return {
    orientation,
    pageWidth,
    pageHeight,
    scale: Math.min(
      (pageWidth - options.marginMm * 2) / width,
      (pageHeight - options.marginMm * 2) / height,
    ),
  };
}
export function diagramLayout(
  project: Project,
  options: ExportOptions = defaultExportOptions,
) {
  const byId = new Map(project.nodes.map((n) => [n.id, n]));
  const boxes = new Map(
    project.nodes.map((n) => {
      const parent = n.parentId ? byId.get(n.parentId) : undefined;
      return [
        n.id,
        {
          x: n.position.x + (parent?.position.x ?? 0),
          y: n.position.y + (parent?.position.y ?? 0),
          ...equipmentSize(n.type),
        },
      ];
    }),
  );
  const cables = project.edges.map((cable) => {
    const source = boxes.get(cable.from)!,
      target = boxes.get(cable.to)!;
    const node = byId.get(cable.from)!;
    const handle = canvasGeometry(node.type).handles.find(
      (h) =>
        h.id ===
        (cable.sourceHandle ?? (node.type === "BUSBAR" ? "out-1" : "out")),
    )!;
    const input = canvasGeometry(byId.get(cable.to)!.type).handles.find(
      (h) => h.id === "in",
    )!;
    const { path, labelX, labelY, points } = cablePath(
      { x: source.x + handle.x + 3.5, y: source.y + handle.y + 3.5 },
      { x: target.x + input.x + 3.5, y: target.y + input.y + 3.5 },
      cable.layout,
    );
    const voltageClass = cableFields[0].options!.find(
      (o) => o.value === cable.properties.voltage_class,
    );
    const label = `${cable.label} · ${number(Number(cable.properties.section_mm2), 0)} mm²${voltageClass && voltageClass.value !== "UNSPECIFIED" ? ` · ${voltageClass.label}` : ""}`;
    return { cable, path, labelX, labelY, label, points };
  });
  const all = Array.from(boxes.values());
  const routePoints = cables.flatMap((c) => c.points);
  const visibleLabels = options.cableLabels ? cables : [];
  const left = Math.min(
    ...all.map((b) => b.x),
    ...visibleLabels.map((c) => c.labelX - 180),
    ...routePoints.map((p) => p.x),
  );
  const right = Math.max(
    ...all.map((b) => b.x + b.width),
    ...visibleLabels.map((c) => c.labelX + 180),
    ...routePoints.map((p) => p.x),
  );
  const top = Math.min(
    ...all.map((b) => b.y - 25),
    ...visibleLabels.map((c) => c.labelY - 25),
    ...routePoints.map((p) => p.y),
  );
  const bottom = Math.max(
    ...all.map((b) => b.y + b.height + 25),
    ...visibleLabels.map((c) => c.labelY + 25),
    ...routePoints.map((p) => p.y),
  );
  return {
    boxes,
    cables,
    bounds: {
      x: left - options.padding,
      y: top - options.padding,
      width: right - left + options.padding * 2,
      height: bottom - top + options.padding * 2,
    },
  };
}

function lines(text: string, count: number) {
  const chars = Array.from(text);
  const size = Math.ceil(chars.length / count);
  return Array.from({ length: count }, (_, i) =>
    chars.slice(i * size, (i + 1) * size).join(""),
  );
}

function NodeDrawing({
  node: n,
  box,
  options,
}: {
  node: Equipment;
  box: Box;
  options: ExportOptions;
}) {
  const color = catalog[n.type].color;
  if (n.type === "PANEL")
    return (
      <g transform={`translate(${box.x} ${box.y})`}>
        <rect
          width={box.width}
          height={box.height}
          rx="12"
          fill="#f5faf5"
          stroke="#a8c3b2"
          strokeDasharray="4 3"
        />
        <path d={`M0 48H${box.width}`} stroke="#d6e4db" />
        <text
          x="20"
          y="30"
          fontSize="15"
          fill="#217a63"
          textLength={n.label.length > 50 ? 420 : undefined}
          lengthAdjust="spacingAndGlyphs"
        >
          {options.names ? n.label : ""}
        </text>
        <text
          x={box.width - 18}
          y="30"
          textAnchor="end"
          fontSize="12"
          fill="#608170"
        >
          {options.details
            ? `${number(Number(n.properties.voltage_v), 0)} V · ${n.properties.phases === 3 ? "3Φ" : "1Φ"}`
            : ""}
        </text>
        <text x="20" y={box.height - 16} fontSize="10" fill="#608170">
          PAINEL DE DISTRIBUIÇÃO
        </text>
      </g>
    );
  const labelLines = lines(n.label, n.label.length > 28 ? 2 : 1);
  const detail = ["TRANSFORMER", "GENERATOR"].includes(n.type)
    ? `${number(Number(n.properties.power_kva), 0)} kVA`
    : ["MOTOR", "LOAD"].includes(n.type)
      ? `${number(Number(n.properties.power_kw), 1)} kW · ${n.properties.phases === 3 ? "3Φ" : "1Φ"}`
      : ["CIRCUIT_BREAKER", "SWITCH", "TIE", "BUSBAR"].includes(n.type)
        ? `${number(Number(n.properties.nominal_current_a), 0)} A`
        : `${number(Number(n.properties.voltage_v), 0)} V`;
  return (
    <g transform={`translate(${box.x} ${box.y})`} color={color}>
      {n.type === "BUSBAR" ? (
        <g fill="none" stroke={color}>
          <path
            d="M150 0v19M45 19v19M115 19v19M185 19v19M255 19v19"
            strokeWidth="2"
          />
          <path d="M0 19h300" strokeWidth="4" />
        </g>
      ) : (
        <g transform={`translate(${(box.width - 56) / 2} 10)`}>
          <Symbol type={n.type} size={56} />
        </g>
      )}
      <text
        x={box.width / 2}
        y={n.type === "BUSBAR" ? 54 : 84}
        fill="#29493b"
        fontSize="14"
        textAnchor="middle"
      >
        {options.names &&
          labelLines.map((line, i) => (
            <tspan
              key={i}
              x={box.width / 2}
              dy={i ? 14 : 0}
              textLength={line.length > 27 ? box.width - 16 : undefined}
              lengthAdjust="spacingAndGlyphs"
            >
              {line}
            </tspan>
          ))}
      </text>
      <text
        x={box.width / 2}
        y={n.type === "BUSBAR" ? 82 : 118}
        textAnchor="middle"
        fontSize="12"
        fill="#405c4b"
      >
        {options.details ? detail : ""}
      </text>
    </g>
  );
}

export function renderDiagramSvg(
  input: Project,
  custom: Partial<ExportOptions> = {},
) {
  const options = { ...defaultExportOptions, ...custom };
  if (
    !Number.isFinite(options.padding) ||
    options.padding < 0 ||
    options.padding > 200 ||
    !Number.isFinite(options.marginMm) ||
    options.marginMm < 0 ||
    options.marginMm > 40
  )
    throw new Error("Margem fora do intervalo permitido.");
  const project = parseProject(input);
  if (!project.nodes.length)
    throw new Error(
      "Adicione pelo menos um equipamento antes de exportar o diagrama.",
    );
  const { boxes, cables, bounds } = diagramLayout(project, options);
  // The drawing is generated from the durable model, independently of zoom, pan and selection.
  const svg = renderToStaticMarkup(
    createElement(
      "svg",
      {
        xmlns: "http://www.w3.org/2000/svg",
        width: bounds.width,
        height: bounds.height,
        viewBox: `${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`,
        fontFamily: "Arial, sans-serif",
      },
      <rect
        x={bounds.x}
        y={bounds.y}
        width={bounds.width}
        height={bounds.height}
        fill="white"
      />,
      ...project.nodes
        .filter((n) => n.type === "PANEL")
        .map((n) => (
          <NodeDrawing
            key={n.id}
            node={n}
            box={boxes.get(n.id)!}
            options={options}
          />
        )),
      ...cables.map(({ cable, path }) => (
        <path
          key={cable.id}
          d={path}
          fill="none"
          stroke="#78938a"
          strokeWidth="1.6"
        />
      )),
      ...project.nodes
        .filter((n) => n.type !== "PANEL")
        .map((n) => (
          <NodeDrawing
            key={n.id}
            node={n}
            box={boxes.get(n.id)!}
            options={options}
          />
        )),
      ...(options.cableLabels ? cables : []).map(
        ({ cable, label, labelX, labelY }) => (
          <g key={cable.id}>
            <rect
              x={labelX - Math.min(340, label.length * 6 + 16) / 2}
              y={labelY - 10}
              width={Math.min(340, label.length * 6 + 16)}
              height="20"
              rx="3"
              fill="white"
            />
            <text
              x={labelX}
              y={labelY + 4}
              textAnchor="middle"
              fontSize="13"
              fill="#405c4b"
              textLength={label.length > 50 ? 330 : undefined}
              lengthAdjust="spacingAndGlyphs"
            >
              {label}
            </text>
          </g>
        ),
      ),
    ),
  );
  return { svg, width: bounds.width, height: bounds.height };
}

export function rasterSize(width: number, height: number) {
  const scale = Math.min(
    3,
    8192 / width,
    8192 / height,
    Math.sqrt(16_000_000 / (width * height)),
  );
  return {
    width: Math.max(1, Math.floor(width * scale)),
    height: Math.max(1, Math.floor(height * scale)),
    reduced: scale < 3,
  };
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export async function exportDiagram(
  project: Project,
  format: "png" | "pdf",
  custom: Partial<ExportOptions> = {},
) {
  const options = { ...defaultExportOptions, ...custom };
  const drawing = renderDiagramSvg(project, options);
  const size = rasterSize(drawing.width, drawing.height);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext("2d");
  if (!context)
    throw new Error("Seu navegador não conseguiu preparar a imagem.");
  const url = URL.createObjectURL(
    new Blob([drawing.svg], { type: "image/svg+xml;charset=utf-8" }),
  );
  const img = new Image();
  let imageTimer: ReturnType<typeof setTimeout> | undefined;
  try {
    await new Promise<void>((resolve, reject) => {
      imageTimer = setTimeout(
        () =>
          reject(new Error("A renderização demorou demais. Tente novamente.")),
        15000,
      );
      img.onload = () => {
        clearTimeout(imageTimer);
        resolve();
      };
      img.onerror = () => {
        clearTimeout(imageTimer);
        reject(new Error("Não foi possível renderizar o diagrama."));
      };
      img.src = url;
    });
    context.drawImage(img, 0, 0, size.width, size.height);
    const png = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) =>
          blob
            ? resolve(blob)
            : reject(new Error("Não foi possível gerar a imagem.")),
        "image/png",
      ),
    );
    if (format === "png")
      downloadBlob(png, `${fileStem(options.filename || project.name)}.png`);
    else {
      const { jsPDF } = await import("jspdf");
      const sheet = exportSheet(drawing.width, drawing.height, options);
      const pdf = new jsPDF({
        orientation: sheet.orientation,
        unit: "mm",
        format: options.paper,
        compress: true,
      });
      const pageWidth = pdf.internal.pageSize.getWidth(),
        pageHeight = pdf.internal.pageSize.getHeight();
      const scale = Math.min(
        (pageWidth - options.marginMm * 2) / drawing.width,
        (pageHeight - options.marginMm * 2) / drawing.height,
      );
      const width = drawing.width * scale,
        height = drawing.height * scale;
      pdf.setProperties({
        title: project.name,
        subject: "Diagrama unifilar",
        creator: "AmpAI",
      });
      pdf.addImage(
        new Uint8Array(await png.arrayBuffer()),
        "PNG",
        (pageWidth - width) / 2,
        (pageHeight - height) / 2,
        width,
        height,
      );
      downloadBlob(
        pdf.output("blob"),
        `${fileStem(options.filename || project.name)}.pdf`,
      );
    }
    return { ...size, format };
  } finally {
    clearTimeout(imageTimer);
    img.onload = null;
    img.onerror = null;
    URL.revokeObjectURL(url);
    canvas.width = 0;
    canvas.height = 0;
  }
}
