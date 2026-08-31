import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Detecciones de calor · Colombia",
  description: "Dashboard nacional para explorar detecciones térmicas del IDEAM por departamento y municipio.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}
