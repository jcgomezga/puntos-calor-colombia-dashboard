import { readFile, writeFile } from "node:fs/promises";

const path = "app/page.tsx";
let source = await readFile(path, "utf8");

function replaceOnce(before, after, label) {
  if (!source.includes(before)) throw new Error(`${label}: patrón no encontrado`);
  if (source.indexOf(before) !== source.lastIndexOf(before)) throw new Error(`${label}: patrón ambiguo`);
  source = source.replace(before, after);
}

replaceOnce(
  'import { Activity, Building2, CalendarDays, ChevronDown, CircleAlert, Database, Flame, Fuel, Instagram, Layers3, Leaf, Linkedin, MapPinned, Pickaxe, Radio, RefreshCw, ShieldCheck } from "lucide-react";',
  'import { Activity, Building2, CalendarDays, ChevronDown, CircleAlert, Database, Flame, Fuel, Layers3, Leaf, MapPinned, Pickaxe, Radio, RefreshCw, ShieldCheck } from "lucide-react";',
  "retirar imports inexistentes",
);

replaceOnce(
  'function MetricCard({ icon: Icon, label, value, detail }: { icon: typeof Flame; label: string; value: string; detail: string }) {',
  `function InstagramIcon() {\n  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="2" /><circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" /><circle cx="17.4" cy="6.7" r="1" fill="currentColor" /></svg>;\n}\nfunction LinkedInIcon() {\n  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="2" /><circle cx="8" cy="9" r="1.2" fill="currentColor" /><path d="M8 12v5M12 17v-5M12 14c0-1.25 1-2.25 2.25-2.25s2.25 1 2.25 2.25v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>;\n}\n\nfunction MetricCard({ icon: Icon, label, value, detail }: { icon: typeof Flame; label: string; value: string; detail: string }) {`,
  "añadir SVG sociales",
);

replaceOnce('<Instagram size={16} aria-hidden="true" />', '<InstagramIcon />', "usar SVG Instagram");
replaceOnce('<Linkedin size={16} aria-hidden="true" />', '<LinkedInIcon />', "usar SVG LinkedIn");

await writeFile(path, source);
console.log("Iconos sociales reemplazados por SVG internos.");
