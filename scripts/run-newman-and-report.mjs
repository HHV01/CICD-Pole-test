import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

fs.mkdirSync("reports", { recursive: true });

const localNewman = path.join("node_modules", ".bin", process.platform === "win32" ? "newman.cmd" : "newman");
const newmanCommand = fs.existsSync(localNewman) ? localNewman : (process.platform === "win32" ? "newman.cmd" : "newman");
const args = [
  "run",
  "postman/VMS_API.postman_collection.json",
  "-e",
  "postman/env/dev.postman_environment.json",
  "--reporters",
  "cli,junit,json",
  "--reporter-junit-export",
  "reports/newman-results.xml",
  "--reporter-json-export",
  "reports/newman-results.json"
];

if (process.env.VMS_BASE_URL) {
  args.push("--env-var", `base_url=${process.env.VMS_BASE_URL}`);
}

if (process.env.VMS_TOKEN) {
  args.push("--env-var", `token=${process.env.VMS_TOKEN}`);
}

if (process.env.RESPONSE_TIME_SLA) {
  args.push("--env-var", `response_time_sla=${process.env.RESPONSE_TIME_SLA}`);
}

const result = spawnSync(newmanCommand, args, { stdio: "inherit", shell: process.platform === "win32" });

if (fs.existsSync("reports/newman-results.json")) {
  spawnSync(process.execPath, ["scripts/newman-json-to-html.mjs", "reports/newman-results.json", "reports/newman-report.html"], {
    stdio: "inherit",
    shell: false
  });
}

process.exit(result.status ?? 1);
