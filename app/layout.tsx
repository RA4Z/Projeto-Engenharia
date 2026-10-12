import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AmpAI — Workspace de engenharia",
  description:
    "Editor de diagramas unifilares. Projete, conecte e calcule diretamente no navegador.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
