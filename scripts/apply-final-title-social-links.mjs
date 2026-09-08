import { readFile, writeFile } from "node:fs/promises";

async function replaceOnce(path, before, after, label) {
  const source = await readFile(path, "utf8");
  if (!source.includes(before)) throw new Error(`${label}: patrón no encontrado en ${path}`);
  if (source.indexOf(before) !== source.lastIndexOf(before)) throw new Error(`${label}: patrón ambiguo en ${path}`);
  await writeFile(path, source.replace(before, after));
}

await replaceOnce(
  "app/page.tsx",
  'import { Activity, Building2, CalendarDays, ChevronDown, CircleAlert, Database, Flame, Fuel, Layers3, Leaf, MapPinned, Pickaxe, Radio, RefreshCw, ShieldCheck } from "lucide-react";',
  'import { Activity, Building2, CalendarDays, ChevronDown, CircleAlert, Database, Flame, Fuel, Instagram, Layers3, Leaf, Linkedin, MapPinned, Pickaxe, Radio, RefreshCw, ShieldCheck } from "lucide-react";',
  "importar iconos sociales",
);

await replaceOnce(
  "app/page.tsx",
  '<p className="eyebrow">MONITOREO TERRITORIAL · COLOMBIA</p><h1>Detecciones de calor</h1>',
  '<p className="eyebrow">MONITOREO TERRITORIAL · COLOMBIA</p><h1>Análisis espacial de detecciones de calor en zonas con potencial uso extractivista</h1>',
  "actualizar título visible",
);

await replaceOnce(
  "app/page.tsx",
  '</header>\n    <section className="notice"',
  `</header>\n    <nav className="social-links" aria-label="Redes sociales de Juan Carlos Gómez García">\n      <a className="social-link instagram" href="https://www.instagram.com/juancgomezg_/" target="_blank" rel="noopener noreferrer" aria-label="Instagram de Juan Carlos Gómez García" title="Instagram"><Instagram size={16} aria-hidden="true" /></a>\n      <a className="social-link linkedin" href="https://www.linkedin.com/in/jcgomezga/" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn de Juan Carlos Gómez García" title="LinkedIn"><Linkedin size={16} aria-hidden="true" /></a>\n    </nav>\n    <section className="notice"`,
  "insertar enlaces sociales",
);

await replaceOnce(
  "app/layout.tsx",
  'title: "Detecciones térmicas IDEAM · Colombia",',
  'title: "Análisis espacial de detecciones de calor en zonas con potencial uso extractivista",',
  "actualizar metadata title",
);

await replaceOnce(
  "app/globals.css",
  '.brand-block { gap: 12px; }',
  '.brand-block { gap: 12px; min-width: 0; }\n.brand-block > div:last-child { min-width: 0; }\n.brand-block h1 { max-width: 780px; line-height: 1.08; text-wrap: balance; }',
  "ajustar título largo",
);

await replaceOnce(
  "app/globals.css",
  '.pulse { width: 7px; height: 7px; border-radius: 50%; background: #37945e; box-shadow: 0 0 0 4px #37945e1d; }',
  `.pulse { width: 7px; height: 7px; border-radius: 50%; background: #37945e; box-shadow: 0 0 0 4px #37945e1d; }\n.social-links { min-height: 36px; margin-top: 8px; display: flex; align-items: center; justify-content: center; gap: 8px; }\n.social-link { width: 30px; height: 30px; display: inline-grid; place-items: center; border: 1px solid var(--line); border-radius: 50%; background: #fff; box-shadow: 0 2px 8px #26382b12; transition: transform .15s ease, box-shadow .15s ease, border-color .15s ease; }\n.social-link.instagram { color: #c13584; }\n.social-link.linkedin { color: #0a66c2; }\n.social-link:hover { transform: translateY(-1px); border-color: #bcc8be; box-shadow: 0 4px 11px #26382b1a; }\n.social-link:focus-visible { outline: 3px solid #2f6844; outline-offset: 2px; }`,
  "estilizar enlaces sociales",
);

await replaceOnce(
  "app/globals.css",
  '  h1 { font-size: 24px; }',
  '  h1 { font-size: 24px; }\n  .brand-block h1 { max-width: none; font-size: 23px; line-height: 1.12; }\n  .social-links { justify-content: flex-start; }',
  "responsive título y redes",
);

console.log("Título y enlaces sociales aplicados.");
