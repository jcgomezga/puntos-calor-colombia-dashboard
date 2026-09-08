import type { Metadata } from "next";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";

const basePath = process.env.GITHUB_ACTIONS === "true" ? "/puntos-calor-colombia-dashboard" : "";

export const metadata: Metadata = {
  title: "Detecciones térmicas IDEAM · Colombia",
  description: "Dashboard nacional para explorar detecciones térmicas IDEAM y su contexto territorial, ambiental y extractivo en Colombia.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: `${basePath}/favicon.svg`,
    shortcut: `${basePath}/favicon.svg`,
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
