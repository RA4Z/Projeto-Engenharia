"use client";
import { useEffect, useState, type CSSProperties } from "react";
import type { Project } from "@/lib/project";
import type { ExportOptions } from "@/lib/diagram-export";
import OverlayDialog from "./overlay-dialog";

const defaults: ExportOptions = {
  names: true,
  details: true,
  cableLabels: true,
  padding: 48,
  orientation: "auto",
  paper: "a3",
  marginMm: 10,
};
export default function ExportPreview({
  project,
  initialFormat,
  onClose,
  onExported,
}: {
  project: Project;
  initialFormat: "png" | "pdf";
  onClose: () => void;
  onExported: (message: string) => void;
}) {
  const [format, setFormat] = useState(initialFormat),
    [options, setOptions] = useState<ExportOptions>({
      ...defaults,
      filename: project.name,
    });
  const [preview, setPreview] = useState<{
    url: string;
    width: number;
    height: number;
  } | null>(null);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let cancelled = false,
      url: string | undefined;
    setError("");
    setPreview(null);
    void import("@/lib/diagram-export")
      .then(({ renderDiagramSvg }) => {
        if (cancelled) return;
        const drawing = renderDiagramSvg(project, options);
        url = URL.createObjectURL(
          new Blob([drawing.svg], { type: "image/svg+xml;charset=utf-8" }),
        );
        setPreview({ url, width: drawing.width, height: drawing.height });
      })
      .catch((error) => {
        if (!cancelled)
          setError(
            error instanceof Error
              ? error.message
              : "Não foi possível preparar a prévia.",
          );
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [
    project,
    options.names,
    options.details,
    options.cableLabels,
    options.padding,
  ]);
  const orientation =
    options.orientation === "auto"
      ? preview && preview.width > preview.height
        ? "landscape"
        : "portrait"
      : options.orientation;
  const short = options.paper === "a4" ? 210 : 297,
    long = options.paper === "a4" ? 297 : 420;
  const pageWidth = orientation === "landscape" ? long : short,
    pageHeight = orientation === "landscape" ? short : long;
  const change = <K extends keyof ExportOptions>(
    key: K,
    value: ExportOptions[K],
  ) => setOptions((previous) => ({ ...previous, [key]: value }));
  const download = async () => {
    if (busy || !preview) return;
    setBusy(true);
    setError("");
    try {
      const { exportDiagram } = await import("@/lib/diagram-export");
      const result = await exportDiagram(project, format, options);
      onExported(
        `Diagrama ${format.toUpperCase()} exportado.${result.reduced ? " Resolução ajustada ao tamanho do projeto." : ""}`,
      );
      onClose();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Não foi possível exportar. Tente novamente.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <OverlayDialog
      title="Prévia de exportação"
      onClose={onClose}
      busy={busy}
      className="export-preview-dialog"
    >
      <p className="dialog-description">
        Confira o desenho completo e ajuste o arquivo antes de baixar.
      </p>
      <div className="export-preview-grid">
        <fieldset className="export-settings" disabled={busy}>
          <label>
            Formato
            <select
              data-autofocus
              aria-label="Formato da exportação"
              value={format}
              onChange={(e) => setFormat(e.target.value as "png" | "pdf")}
            >
              <option value="png">Imagem PNG</option>
              <option value="pdf">Documento PDF</option>
            </select>
          </label>
          <label>
            Nome do arquivo
            <input
              aria-label="Nome do arquivo"
              maxLength={100}
              value={options.filename}
              onChange={(e) => change("filename", e.target.value)}
            />
          </label>
          <div className="section-title">Informações visíveis</div>
          {(
            [
              ["names", "Nomes dos equipamentos"],
              ["details", "Parâmetros dos equipamentos"],
              ["cableLabels", "Rótulos dos cabos"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="export-checkbox">
              <input
                type="checkbox"
                checked={options[key]}
                onChange={(e) => change(key, e.target.checked)}
              />
              {label}
            </label>
          ))}
          <label>
            Margem do desenho
            <select
              aria-label="Margem do desenho"
              value={options.padding}
              onChange={(e) => change("padding", Number(e.target.value))}
            >
              <option value="16">Compacta — 16 px</option>
              <option value="48">Normal — 48 px</option>
              <option value="96">Ampla — 96 px</option>
            </select>
          </label>
          {format === "pdf" && (
            <>
              <label>
                Papel
                <select
                  aria-label="Tamanho do papel"
                  value={options.paper}
                  onChange={(e) =>
                    change("paper", e.target.value as "a3" | "a4")
                  }
                >
                  <option value="a3">A3</option>
                  <option value="a4">A4</option>
                </select>
              </label>
              <label>
                Orientação
                <select
                  aria-label="Orientação da página"
                  value={options.orientation}
                  onChange={(e) =>
                    change(
                      "orientation",
                      e.target.value as ExportOptions["orientation"],
                    )
                  }
                >
                  <option value="auto">Automática</option>
                  <option value="portrait">Retrato</option>
                  <option value="landscape">Paisagem</option>
                </select>
              </label>
              <label>
                Margem da página
                <select
                  aria-label="Margem da página"
                  value={options.marginMm}
                  onChange={(e) => change("marginMm", Number(e.target.value))}
                >
                  <option value="5">5 mm</option>
                  <option value="10">10 mm</option>
                  <option value="20">20 mm</option>
                </select>
              </label>
            </>
          )}
        </fieldset>
        <div className="preview-surface">
          {preview ? (
            <>
              <div
                className="export-paper"
                style={
                  {
                    aspectRatio:
                      format === "pdf"
                        ? `${pageWidth}/${pageHeight}`
                        : `${preview.width}/${preview.height}`,
                    "--paper-ratio":
                      format === "pdf"
                        ? pageWidth / pageHeight
                        : preview.width / preview.height,
                  } as CSSProperties
                }
              >
                <div
                  className="export-paper-inner"
                  style={{
                    padding:
                      format === "pdf"
                        ? `${(options.marginMm / pageWidth) * 100}%`
                        : 0,
                  }}
                >
                  <img
                    src={preview.url}
                    alt={`Prévia do diagrama ${project.name}`}
                  />
                </div>
              </div>
              <p>
                {format === "pdf"
                  ? `${options.paper.toUpperCase()} · ${orientation === "portrait" ? "Retrato" : "Paisagem"} · margem ${options.marginMm} mm`
                  : "PNG · desenho completo"}
              </p>
            </>
          ) : (
            <p role="status">Preparando prévia…</p>
          )}
        </div>
      </div>
      {error && (
        <p className="export-error" role="alert">
          {error}
        </p>
      )}
      <div className="ux-dialog-footer">
        <button className="secondary-button" disabled={busy} onClick={onClose}>
          Cancelar
        </button>
        <button
          className="primary-button"
          disabled={busy || !preview || !options.filename?.trim()}
          onClick={() => void download()}
        >
          {busy
            ? "Gerando arquivo…"
            : error
              ? "Tentar baixar novamente"
              : `Baixar ${format.toUpperCase()}`}
        </button>
      </div>
    </OverlayDialog>
  );
}
