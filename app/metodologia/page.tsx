import type { Metadata } from "next";
import Link from "next/link";
import { HISTORY_START_LABEL } from "@/lib/data-policy";

export const metadata: Metadata = {
  title: "Metodología · Detecciones térmicas IDEAM · Colombia",
  description: "Alcance, fuentes, criterios operativos y pautas de interpretación del dashboard nacional de detecciones térmicas.",
};

const coverFamilies = [
  ["1", "Territorios artificializados"],
  ["2", "Áreas agrícolas"],
  ["3", "Bosques y áreas seminaturales"],
  ["4", "Áreas húmedas"],
  ["5", "Superficies de agua"],
] as const;

export default function MethodologyPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-5 py-8 text-[#17231b] sm:px-8 sm:py-10">
      <Link href="/" className="mb-7 inline-flex items-center rounded-md border border-[#cbd8ce] bg-white px-3 py-2 text-sm font-semibold text-[#214d35] no-underline shadow-sm hover:bg-[#f6f8f6]">
        ← Volver al dashboard
      </Link>

      <header className="mb-8 border-b border-[#dbe3dc] pb-6">
        <p className="mb-2 text-xs font-extrabold tracking-[0.14em] text-[#637068]">METODOLOGÍA PÚBLICA</p>
        <h1 className="mb-3 font-serif text-3xl leading-tight sm:text-4xl">Cómo leer el dashboard de detecciones térmicas</h1>
        <p className="max-w-3xl text-sm leading-6 text-[#526158]">
          Esta página resume qué muestra el portal, qué fuentes integra y qué precauciones deben tenerse al interpretar una detección térmica o sus relaciones territoriales.
        </p>
      </header>

      <div className="grid gap-5">
        <section className="rounded-xl border border-[#dbe3dc] bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-serif text-xl">1. Qué representa cada punto</h2>
          <p className="text-sm leading-6 text-[#46534a]">
            Cada punto corresponde a una detección térmica satelital reportada por IDEAM dentro del periodo consultado. Una detección térmica indica una anomalía de temperatura observada por un sensor; <strong>no confirma por sí sola un incendio forestal</strong>, no delimita una superficie quemada y no identifica la causa del fenómeno.
          </p>
        </section>

        <section className="rounded-xl border border-[#dbe3dc] bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-serif text-xl">2. Universo operativo publicado</h2>
          <p className="text-sm leading-6 text-[#46534a]">
            El portal muestra un <strong>universo operativo de detecciones</strong> construido a partir de los datos disponibles de IDEAM y de criterios de control de calidad instrumental documentados en el proyecto. Por esa razón, el total publicado puede diferir del total bruto descargado. La evaluación de sensibilidad instrumental se conserva en la trazabilidad técnica y se integrará posteriormente en una sección de análisis detallado, sin convertirla en un selector de la interfaz principal.
          </p>
        </section>

        <section className="rounded-xl border border-[#dbe3dc] bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-serif text-xl">3. Fuentes territoriales</h2>
          <p className="mb-3 text-sm leading-6 text-[#46534a]">El dashboard cruza las detecciones con información territorial de varias instituciones:</p>
          <ul className="grid gap-2 pl-5 text-sm leading-6 text-[#46534a]">
            <li><strong>DANE:</strong> departamentos y municipios para asignación territorial.</li>
            <li><strong>IDEAM:</strong> Mapa Nacional de Coberturas de la Tierra 2024.</li>
            <li><strong>RUNAP:</strong> áreas protegidas.</li>
            <li><strong>ANM:</strong> títulos mineros.</li>
            <li><strong>ANLA:</strong> proyectos sometidos a evaluación/licenciamiento ambiental.</li>
            <li><strong>ANH:</strong> áreas contractuales/asignadas de hidrocarburos.</li>
          </ul>
          <p className="mt-3 text-sm leading-6 text-[#46534a]">
            Las expresiones <strong>dentro</strong>, <strong>hasta 1 km</strong> o <strong>entre 1 y 5 km</strong> describen relaciones espaciales. No demuestran que una actividad, proyecto o figura territorial haya originado una detección térmica.
          </p>
        </section>

        <section className="rounded-xl border border-[#dbe3dc] bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-serif text-xl">4. Familias de cobertura IDEAM 2024</h2>
          <p className="mb-3 text-sm leading-6 text-[#46534a]">El filtro principal de coberturas usa las cinco familias de nivel 1:</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {coverFamilies.map(([code, label]) => (
              <div key={code} className="rounded-lg border border-[#e2e8e3] bg-[#f8faf8] px-3 py-2 text-sm text-[#39483f]">
                <strong>{code}</strong> · {label}
              </div>
            ))}
          </div>
          <p className="mt-3 text-sm leading-6 text-[#46534a]">La consulta cartográfica puede mostrar niveles más detallados cuando esos atributos están disponibles en el servicio IDEAM.</p>
        </section>

        <section className="rounded-xl border border-[#dbe3dc] bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-serif text-xl">5. Confianza y FRP</h2>
          <p className="text-sm leading-6 text-[#46534a]">
            El campo <strong>Confianza</strong> reproduce el indicador informado por la fuente/sensor para la detección. Su escala y significado dependen del producto satelital y <strong>no deben interpretarse como una probabilidad de que exista un incendio</strong> ni compararse automáticamente entre sensores distintos. El <strong>FRP</strong> es la potencia radiativa del fuego estimada por el producto y se expresa en MW cuando está disponible; algunos registros pueden aparecer como “Sin dato”.
          </p>
        </section>

        <section className="rounded-xl border border-[#dbe3dc] bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-serif text-xl">6. Situación de proyectos ANLA</h2>
          <p className="text-sm leading-6 text-[#46534a]">
            Las categorías de situación ANLA <strong>no son necesariamente excluyentes a escala de detección</strong>. Una misma detección puede estar relacionada espacialmente con más de un proyecto y esos proyectos pueden encontrarse en situaciones diferentes. Por eso los subtotales por situación no deben sumarse como si fueran grupos mutuamente exclusivos.
          </p>
        </section>

        <section className="rounded-xl border border-[#dbe3dc] bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-serif text-xl">7. Registros sin asignación</h2>
          <p className="text-sm leading-6 text-[#46534a]">
            Algunas detecciones pueden no tener una asignación territorial o de cobertura disponible en los productos usados para el cruce. Esos registros permanecen en el total general cuando cumplen los demás criterios del portal. Por ello, la suma de categorías territoriales o de cobertura puede no coincidir exactamente con el total general visible.
          </p>
        </section>

        <section className="rounded-xl border border-[#dbe3dc] bg-white p-5 shadow-sm">
          <h2 className="mb-3 font-serif text-xl">8. Periodo, actualización y trazabilidad</h2>
          <p className="mb-3 text-sm leading-6 text-[#46534a]">
            El histórico público se conserva desde <strong>{HISTORY_START_LABEL}</strong> y se actualiza mediante flujos automatizados. La aplicación integra datos oficiales procesados y mantiene en el repositorio los scripts, pruebas, reportes de fase y decisiones metodológicas utilizadas para construir el producto.
          </p>
          <a
            href="https://github.com/jcgomezga/puntos-calor-colombia-dashboard"
            target="_blank"
            rel="noreferrer"
            className="inline-flex rounded-md border border-[#cbd8ce] px-3 py-2 text-sm font-semibold text-[#214d35] underline decoration-[#8ba392] underline-offset-2"
          >
            Consultar repositorio y trazabilidad técnica
          </a>
        </section>

        <section className="rounded-xl border border-[#dbe3dc] bg-[#eef4ef] p-5">
          <h2 className="mb-3 font-serif text-xl">9. Análisis detallado</h2>
          <p className="text-sm leading-6 text-[#46534a]">
            El portal principal está diseñado para explorar detecciones individuales. Los análisis de agrupación temporal-espacial, recurrencia, sensibilidad instrumental y otros productos avanzados se mantienen en el proyecto y se incorporarán posteriormente en una sección separada de <strong>Análisis detallado</strong>.
          </p>
        </section>
      </div>
    </main>
  );
}
