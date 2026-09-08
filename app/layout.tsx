import type { Metadata } from "next";
import Script from "next/script";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";
import { AnalyticsInteractionTracker } from "@/components/analytics-interaction-tracker";
import { GA_MEASUREMENT_ID } from "@/lib/analytics";

const basePath = process.env.GITHUB_ACTIONS === "true" ? "/puntos-calor-colombia-dashboard" : "";
const analyticsEnabled = process.env.NODE_ENV === "production";

export const metadata: Metadata = {
  title: "Análisis espacial de detecciones de calor en zonas con potencial uso extractivista",
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
      <body className="antialiased">
        {children}
        {analyticsEnabled ? (
          <>
            <AnalyticsInteractionTracker />
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
              strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                window.gtag = gtag;
                gtag('js', new Date());
                gtag('config', '${GA_MEASUREMENT_ID}');
              `}
            </Script>
          </>
        ) : null}
      </body>
    </html>
  );
}
