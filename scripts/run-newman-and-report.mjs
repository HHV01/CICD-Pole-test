import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { URL } from "node:url";

fs.mkdirSync("reports", { recursive: true });

const localNewman = path.join("node_modules", ".bin", process.platform === "win32" ? "newman.cmd" : "newman");
const newmanCommand = fs.existsSync(localNewman) ? localNewman : (process.platform === "win32" ? "newman.cmd" : "newman");
const envPath = "postman/env/dev.postman_environment.json";

function readEnvironmentValue(key) {
  if (!fs.existsSync(envPath)) return "";
  try {
    const environment = JSON.parse(fs.readFileSync(envPath, "utf8"));
    const values = Array.isArray(environment.values) ? environment.values : [];
    const match = values.find((item) => item && item.key === key && item.enabled !== false);
    return match?.value || "";
  } catch {
    return "";
  }
}

function firstNonEmpty(...values) {
  return values.find((value) => typeof value === "string" && value.trim()) || "";
}

function isPrivateOrLocalHost(hostname) {
  const host = String(hostname || "").trim().toLowerCase();
  if (!host) return false;
  if (["localhost", "127.0.0.1", "::1"].includes(host)) return true;
  const match = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return false;
  const [a, b] = [Number(match[1]), Number(match[2])];
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

const baseUrl = firstNonEmpty(
  process.env.POLE_BASE_URL,
  process.env.VMS_BASE_URL,
  readEnvironmentValue("base_url")
);

const token = firstNonEmpty(
  process.env.POLE_TOKEN,
  process.env.VMS_TOKEN,
  readEnvironmentValue("token")
);

const responseTimeSla = firstNonEmpty(
  process.env.RESPONSE_TIME_SLA,
  readEnvironmentValue("response_time_sla")
);

if (!baseUrl) {
  console.error("Missing base_url. Set POLE_BASE_URL or VMS_BASE_URL in CI, or update postman/env/dev.postman_environment.json.");
  process.exit(2);
}

try {
  const parsedUrl = new URL(baseUrl);
  const isGitHubHosted = process.env.GITHUB_ACTIONS === "true" && process.env.RUNNER_ENVIRONMENT !== "self-hosted";
  if (isGitHubHosted && isPrivateOrLocalHost(parsedUrl.hostname)) {
    console.error(`Base URL ${baseUrl} is a private/local address.`);
    console.error("GitHub-hosted runners usually cannot reach internal IPs like 10.x.x.x, 172.16-31.x.x, 192.168.x.x, 100.64-127.x.x or localhost.");
    console.error("Use a self-hosted runner inside your company network/VPN, or expose the API through a public reachable URL.");
    process.exit(2);
  }
} catch (error) {
  console.error(`Invalid base_url: ${baseUrl}`);
  console.error(error.message);
  process.exit(2);
}

const args = [
  "run",
  "postman/POLE_API.postman_collection.json",
  "-e",
  "postman/env/dev.postman_environment.json",
  "--reporters",
  "cli,junit,json",
  "--reporter-junit-export",
  "reports/newman-results.xml",
  "--reporter-json-export",
  "reports/newman-results.json"
];

args.push("--env-var", `base_url=${baseUrl}`);
if (token) args.push("--env-var", `token=${token}`);
if (responseTimeSla) args.push("--env-var", `response_time_sla=${responseTimeSla}`);

const result = spawnSync(newmanCommand, args, { stdio: "inherit", shell: process.platform === "win32" });

if (fs.existsSync("reports/newman-results.json")) {
  spawnSync(process.execPath, ["scripts/newman-json-to-html.mjs", "reports/newman-results.json", "reports/newman-report.html"], {
    stdio: "inherit",
    shell: false
  });
}

process.exit(result.status ?? 1);
