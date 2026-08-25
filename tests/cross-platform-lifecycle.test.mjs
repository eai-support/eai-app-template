import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const packageJson = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8"),
);
const runSh = await readFile(new URL("../run.sh", import.meta.url), "utf8");
const runPs1 = await readFile(new URL("../run.ps1", import.meta.url), "utf8");
const runBat = await readFile(new URL("../run.bat", import.meta.url), "utf8");

test("prepare uses Husky's cross-platform entry point", () => {
  assert.equal(packageJson.scripts.prepare, "husky");
  assert.doesNotMatch(packageJson.scripts.prepare, /\b(if|then|fi)\b|\$HUSKY/);
});

test("app runner exists for Unix and Windows shells", async () => {
  await access(new URL("../run.sh", import.meta.url));
  await access(new URL("../run.ps1", import.meta.url));
  await access(new URL("../run.bat", import.meta.url));
});

test("app runner clears the selected port before restart", () => {
  assert.match(runSh, /Usage: \.\/run\.sh \[dev\|test\|prod\] \[port\]/);
  assert.match(runSh, /APP_PORT=\$\{2:-\$\{PORT:-3001\}\}/);
  assert.match(runSh, /lsof -tiTCP:"\$APP_PORT" -sTCP:LISTEN/);
  assert.match(runSh, /fuser "\$APP_PORT"\/tcp/);
  assert.match(runSh, /exec npm run "dev:\$ENVIRONMENT"/);
  assert.match(runPs1, /\[ValidateSet\("dev", "test", "prod"\)\]/);
  assert.match(runPs1, /Get-NetTCPConnection -LocalPort \$Port -State Listen/);
  assert.match(runPs1, /Stop-Process -Id \$processId -Force/);
  assert.match(runPs1, /npm run "dev:\$Environment"/);
  assert.match(runBat, /run\.ps1/);
});
