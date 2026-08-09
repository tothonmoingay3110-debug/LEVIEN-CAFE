import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadLocalEnvironment() {
  const environmentPath = resolve(".env.local");
  if (!existsSync(environmentPath)) return;
  for (const rawLine of readFileSync(environmentPath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (!process.env[key]) process.env[key] = value;
  }
}

loadLocalEnvironment();

const failures = [];
const passes = [];
const requireValue = (name) => {
  const value = process.env[name]?.trim() || "";
  if (!value) failures.push(`${name} is missing.`);
  else passes.push(`${name} is configured.`);
  return value;
};

const supabaseUrl = requireValue("NEXT_PUBLIC_SUPABASE_URL");
const publishableKey = requireValue("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
const serviceRoleKey = requireValue("SUPABASE_SERVICE_ROLE_KEY");
requireValue("ADMIN_USERNAME");
const adminPassword = requireValue("ADMIN_PASSWORD");
const sessionSecret = requireValue("ADMIN_SESSION_SECRET");

try {
  if (supabaseUrl && new URL(supabaseUrl).protocol !== "https:") {
    failures.push("NEXT_PUBLIC_SUPABASE_URL must use HTTPS.");
  }
} catch {
  failures.push("NEXT_PUBLIC_SUPABASE_URL is not a valid URL.");
}
if (publishableKey && serviceRoleKey && publishableKey === serviceRoleKey) {
  failures.push("The public and service-role Supabase keys must be different.");
}
if (adminPassword && adminPassword.length < 12) {
  failures.push("ADMIN_PASSWORD must contain at least 12 characters for production.");
}
const weakAdminPasswords = new Set(["123", "admin", "password", "changeme", "levien"]);
if (adminPassword && weakAdminPasswords.has(adminPassword.toLowerCase())) {
  failures.push("ADMIN_PASSWORD must not use a known default value.");
}
if (sessionSecret && sessionSecret.length < 32) {
  failures.push("ADMIN_SESSION_SECRET must contain at least 32 characters.");
}
if (Object.keys(process.env).some((key) => key.startsWith("NEXT_PUBLIC_") && key.includes("SERVICE_ROLE"))) {
  failures.push("A service-role key must never use the NEXT_PUBLIC_ prefix.");
}

const gitignore = existsSync(resolve(".gitignore")) ? readFileSync(resolve(".gitignore"), "utf8") : "";
if (!gitignore.split(/\r?\n/).map((line) => line.trim()).includes(".env.local")) {
  failures.push(".gitignore must exclude .env.local.");
} else {
  passes.push(".env.local is excluded from Git.");
}

for (const message of passes) console.log(`[ok] ${message}`);
if (failures.length) {
  for (const message of failures) console.error(`[error] ${message}`);
  console.error(`Production readiness failed with ${failures.length} issue(s).`);
  process.exitCode = 1;
} else {
  console.log("Production environment checks passed.");
}
