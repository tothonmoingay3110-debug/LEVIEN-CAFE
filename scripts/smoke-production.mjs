const passes = [];
const failures = [];

const rawBaseUrl = process.argv[2] || process.env.PRODUCTION_URL;
if (!rawBaseUrl) {
  console.error("Usage: npm.cmd run smoke:production -- https://your-production-domain.com");
  process.exit(1);
}

let baseUrl;
try {
  const parsed = new URL(rawBaseUrl);
  const isLocal = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  if (parsed.protocol !== "https:" && !isLocal) {
    throw new Error("Production smoke tests require an HTTPS URL.");
  }
  parsed.pathname = "/";
  parsed.search = "";
  parsed.hash = "";
  baseUrl = parsed;
} catch (error) {
  console.error(`Invalid production URL: ${error instanceof Error ? error.message : "unknown error"}`);
  process.exit(1);
}

function pass(message) {
  passes.push(message);
}

function fail(message) {
  failures.push(message);
}

async function request(path, expectedStatus) {
  const url = new URL(path, baseUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "LEVIEN-CAFE-production-smoke-test" },
      redirect: "follow",
      signal: controller.signal,
    });
    if (response.status === expectedStatus) pass(`${path} returned ${expectedStatus}.`);
    else fail(`${path} returned ${response.status}; expected ${expectedStatus}.`);
    return response;
  } catch (error) {
    fail(`${path} could not be reached: ${error instanceof Error ? error.message : "unknown error"}.`);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

const homeResponse = await request("/", 200);
await request("/menu", 200);
await request("/admin", 200);

if (homeResponse) {
  const contentType = homeResponse.headers.get("content-type") || "";
  if (contentType.includes("text/html")) pass("Storefront returns HTML.");
  else fail("Storefront did not return HTML.");

  const expectedHeaders = [
    ["x-content-type-options", "nosniff"],
    ["x-frame-options", "DENY"],
    ["referrer-policy", "strict-origin-when-cross-origin"],
  ];
  for (const [name, expectedValue] of expectedHeaders) {
    const value = homeResponse.headers.get(name);
    if (value === expectedValue) pass(`${name} is configured.`);
    else fail(`${name} is missing or invalid.`);
  }
}

const healthResponse = await request("/api/health", 200);
if (healthResponse?.ok) {
  try {
    const body = await healthResponse.json();
    if (body?.status === "ok" && body?.services?.database === "ok") {
      pass("Health endpoint confirms database connectivity.");
    } else {
      fail("Health endpoint returned an unexpected payload.");
    }
    if ((healthResponse.headers.get("cache-control") || "").includes("no-store")) {
      pass("Health response is not cached.");
    } else {
      fail("Health response must use Cache-Control: no-store.");
    }
  } catch {
    fail("Health endpoint did not return valid JSON.");
  }
}

await request("/api/orders/track?token=invalid", 400);

for (const message of passes) console.log(`[ok] ${message}`);
if (failures.length) {
  for (const message of failures) console.error(`[error] ${message}`);
  console.error(`Production smoke test failed with ${failures.length} issue(s).`);
  process.exitCode = 1;
} else {
  console.log("Production smoke tests passed.");
}
