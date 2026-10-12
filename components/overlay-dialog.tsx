"use client";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

export default function OverlayDialog({
  title,
  onClose,
  children,
  className = "",
  busy = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  busy?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null),
    id = useId();
  useEffect(() => {
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    (
      ref.current?.querySelector<HTMLElement>("[data-autofocus]") ??
      ref.current?.querySelector<HTMLElement>("input,select,button")
    )?.focus();
    return () => {
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  return (
    <div
      className="modal-backdrop ux-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        ref={ref}
        className={`ux-dialog ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            if (!busy) onClose();
          }
          if (e.key !== "Tab") return;
          const fields = Array.from(
            ref.current!.querySelectorAll<HTMLElement>(
              'input:not(:disabled),select:not(:disabled),button:not(:disabled),[tabindex="0"]',
            ),
          ).filter((el) => !el.closest("[hidden]"));
          const index = fields.indexOf(document.activeElement as HTMLElement);
          if (e.shiftKey && index <= 0) {
            e.preventDefault();
            fields.at(-1)?.focus();
          } else if (!e.shiftKey && index === fields.length - 1) {
            e.preventDefault();
            fields[0]?.focus();
          }
        }}
      >
        <div className="ux-dialog-header">
          <h2 id={id}>{title}</h2>
          <button
            disabled={busy}
            className="icon-button"
            aria-label={`Fechar ${title}`}
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
