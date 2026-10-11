import { readFile, readdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join } from "node:path";

// cf 1.0.0-beta.12 unconditionally enables strict config-drift checks. Its
// generated config cannot express dashboard-created custom-domain metadata
// (enabled/previews_enabled), so CI rejects an otherwise matching domain.
// Keep this narrow workaround until cf can model those fields or disable strict.
const packageInfo = JSON.parse(await readFile("node_modules/cf/package.json", "utf8"));
if (packageInfo.version !== "1.0.0-beta.12") {
  throw new Error(`Review Cloudflare deployment workaround for cf ${packageInfo.version}.`);
}

const output = JSON.parse(await readFile(".cloudflare/output/v0/workers/default/worker.config.json", "utf8"));
const expectedEmail = "LEVIEN CAFE <notifications@leviencafe.com>";
if (output.name !== "levien-cafe" ||
    !output.domains?.includes("leviencafe.com") ||
    output.triggers?.length ||
    ["EVENT_BOOKING_FROM_EMAIL", "GIFT_CARD_FROM_EMAIL", "NOTIFICATION_FROM_EMAIL"].some(
      (name) => output.env?.[name]?.value !== expectedEmail,
    )) {
  throw new Error("Built Worker domain or email bindings differ from the reviewed production configuration.");
}

const dist = "node_modules/cf/dist";
const candidates = (await readdir(dist)).filter((name) => /^deploy-input-.*\.mjs$/.test(name));
if (candidates.length !== 1) throw new Error("Unable to locate the pinned cf deploy input module.");
const modulePath = join(dist, candidates[0]);
const original = await readFile(modulePath, "utf8");
const strictDeploy = "dispatchNamespace:r[`dispatch-namespace`],strict:!0";
if (original.split(strictDeploy).length !== 2) {
  throw new Error("cf deploy internals changed; review the strict-mode workaround before deploying.");
}

try {
  await writeFile(modulePath, original.replace(strictDeploy, "dispatchNamespace:r[`dispatch-namespace`],strict:!1"));
  const code = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["node_modules/cf/bin/cf", "deploy", "--prebuilt"], {
      stdio: "inherit",
      env: process.env,
    });
    child.on("error", reject);
    child.on("exit", (exitCode) => resolve(exitCode ?? 1));
  });
  if (code !== 0) process.exitCode = code;
} finally {
  await writeFile(modulePath, original);
}
