import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const vitePackageDir = path.dirname(require.resolve("vite/package.json"));
const viteBin = path.join(vitePackageDir, "bin", "vite.js");

const result = spawnSync(process.execPath, [viteBin, ...process.argv.slice(2)], {
  stdio: "inherit",
  env: {
    ...process.env,
    WRANGLER_LOG_PATH: process.env.WRANGLER_LOG_PATH ?? ".wrangler/wrangler.log",
  },
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
