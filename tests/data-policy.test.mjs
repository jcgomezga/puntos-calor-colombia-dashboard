import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

const policyPath = fileURLToPath(
  new URL("../config/data-policy.json", import.meta.url),
);

test("freezes the inclusive historical cutoff at July 1, 2026", async () => {
  const policy = JSON.parse(await readFile(policyPath, "utf8"));

  assert.equal(policy.history_start_date, "2026-07-01");
  assert.equal(policy.history_timezone, "America/Bogota");
  assert.equal(policy.history_start_inclusive, true);
  assert.equal(policy.retain_raw_before_history_start, false);
  assert.equal(policy.history_mode, "cumulative");
});
