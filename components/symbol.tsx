import type { EquipmentType } from "@/lib/catalog";

export default function Symbol({
  type,
  size = 40,
}: {
  type: EquipmentType;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {type === "SOURCE" && (
        <>
          <path d="M32 0v12M32 52v12" />
          <circle cx="32" cy="32" r="20" />
          <path d="M17 32c5-15 10-15 15 0s10 15 15 0" />
        </>
      )}
      {type === "TRANSFORMER" && (
        <>
          <path d="M32 0v8M32 56v8" />
          <circle cx="32" cy="23" r="15" />
          <circle cx="32" cy="41" r="15" />
        </>
      )}
      {["CIRCUIT_BREAKER", "TIE"].includes(type) && (
        <>
          <path d="M32 0v17M32 47v17M32 47L19 19M27 17h10M27 47h10" />
          <path d="M20 29h24v10H20" />
          {type === "TIE" && <path d="M7 32h10M47 32h10" />}
        </>
      )}
      {type === "SWITCH" && (
        <>
          <path d="M32 0v18M32 46v18M32 46L17 20" />
          <circle cx="32" cy="18" r="2" />
          <circle cx="32" cy="46" r="2" />
        </>
      )}
      {type === "BUSBAR" && (
        <>
          <path strokeWidth="5" d="M5 32h54" />
          <path d="M32 0v32M12 32v32M32 32v32M52 32v32" />
        </>
      )}
      {type === "PANEL" && (
        <>
          <rect x="9" y="5" width="46" height="54" rx="4" />
          <path d="M20 22h24M20 32h24M20 42h16M45 42v7" />
          <path d="M28 0v5M28 59v5" />
        </>
      )}
      {["MOTOR", "GENERATOR"].includes(type) && (
        <>
          <path d="M32 0v12" />
          <circle cx="32" cy="34" r="22" />
          <text
            x="32"
            y="41"
            textAnchor="middle"
            fill="currentColor"
            stroke="none"
            fontSize="23"
            fontFamily="Arial"
          >
            {type === "MOTOR" ? "M" : "G"}
          </text>
          <path d="M26 47h12" />
        </>
      )}
      {type === "LOAD" && (
        <>
          <path d="M32 0v12" />
          <rect x="14" y="12" width="36" height="36" rx="3" />
          <path d="M35 20l-10 14h13l-9 14" />
        </>
      )}
    </svg>
  );
}
