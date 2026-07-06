import fs from "node:fs";
import path from "node:path";

const casesPath = process.argv[2] || "postman/data/rule-engine-api-testcases.json";
const outputPath = process.argv[3] || "postman/POLE_API.postman_collection.json";
const baseUrl = process.argv[4] || "http://100.70.72.120:7001";
const cases = JSON.parse(fs.readFileSync(casesPath, "utf8").replace(/^\uFEFF/, ""));

function parseInput(testCase) {
  try {
    return JSON.parse(testCase.inputRaw || "{}");
  } catch (error) {
    return { method: "GET", url: `${baseUrl}${testCase.path || ""}`, query: {}, body: null, parseError: error.message };
  }
}

function parseExpectedStatuses(expectedRaw) {
  const text = String(expectedRaw || "");
  const setMatch = text.match(/\[([0-9,\s]+)\]/);
  if (setMatch) return setMatch[1].split(",").map((item) => Number(item.trim())).filter(Boolean);
  const statusMatches = [...text.matchAll(/\bHTTP(?:\s+status)?\s*(\d{3})\b/gi)];
  if (statusMatches.length) return [...new Set(statusMatches.map((match) => Number(match[1])))];
  const anyStatus = text.match(/\b([1-5][0-9]{2})\b/);
  return anyStatus ? [Number(anyStatus[1])] : [200];
}

function expectedJson(expectedRaw) {
  return /JSON hợp lệ|validation error|Response là JSON/i.test(String(expectedRaw || ""));
}

function expectedCreatedObject(expectedRaw) {
  return /rule id|vừa tạo|chứa rule id/i.test(String(expectedRaw || ""));
}

function expectedNonEmptyError(expectedRaw) {
  return /chỉ rõ lỗi|validation error|không crash/i.test(String(expectedRaw || ""));
}

function groupName(caseId) {
  if (caseId.startsWith("RE-READ")) return "01. Read";
  if (caseId.startsWith("RE-LC")) return "02. Lifecycle";
  if (caseId.startsWith("RE-CAT")) return "03. Catalog";
  if (caseId.startsWith("RE-EDGE")) return "04. Edge & Negative";
  if (caseId.startsWith("RE-CLEANUP")) return "05. Cleanup";
  return "99. Other";
}

function relativeUrl(input) {
  try {
    const url = new URL(input.url || "", baseUrl);
    let pathname = url.pathname;
    for (const [key, value] of Object.entries(input.pathParams || {})) {
      if (key === "rule_id" && value) {
        pathname = pathname.replace(String(value), "{{rule_id}}");
      }
    }
    const search = new URLSearchParams(url.search);
    for (const [key, value] of Object.entries(input.query || {})) {
      search.set(key, String(value));
    }
    const queryString = search.toString();
    return `${pathname}${queryString ? `?${queryString}` : ""}`;
  } catch {
    return input.path || "/";
  }
}

function requestBody(input) {
  const method = String(input.method || "GET").toUpperCase();
  if (["GET", "HEAD"].includes(method) || input.body === null || input.body === undefined) return undefined;
  const raw = typeof input.body === "string" ? input.body : JSON.stringify(input.body, null, 2);
  return { mode: "raw", raw, options: { raw: { language: "json" } } };
}

function itemFromCase(testCase) {
  const input = parseInput(testCase);
  const method = String(input.method || "GET").toUpperCase();
  const request = {
    method,
    header: [{ key: "Accept", value: "application/json" }],
    url: `{{base_url}}${relativeUrl(input)}`,
    description: [testCase.description, "", `Excel row: ${testCase.sourceRow}`, `Expected: ${testCase.expectedRaw}`].filter(Boolean).join("\n")
  };
  const body = requestBody(input);
  if (body) {
    request.header.push({ key: "Content-Type", value: "application/json" });
    request.body = body;
  }

  return {
    name: `[${testCase.caseId}] ${testCase.description}`,
    request,
    event: [{
      listen: "test",
      script: {
        type: "text/javascript",
        exec: [
          `const expectedStatuses = ${JSON.stringify(parseExpectedStatuses(testCase.expectedRaw))};`,
          `const expectsJson = ${JSON.stringify(expectedJson(testCase.expectedRaw))};`,
          `const expectsCreatedObject = ${JSON.stringify(expectedCreatedObject(testCase.expectedRaw))};`,
          `const expectsNonEmptyError = ${JSON.stringify(expectedNonEmptyError(testCase.expectedRaw))};`,
          `const caseId = ${JSON.stringify(testCase.caseId)};`,
          "const responseTimeSla = Number(pm.environment.get('response_time_sla') || 2000);",
          "const requestName = pm.info.requestName;",
          "",
          "pm.test(`${requestName} - testcase checks`, function () {",
          "  pm.expect(pm.response, 'No HTTP response. Check base_url, network access, VPN, firewall, or self-hosted runner settings.').to.exist;",
          "  pm.expect(pm.response.code).to.be.oneOf(expectedStatuses);",
          "  pm.expect(pm.response.responseTime).to.be.below(responseTimeSla);",
          "  const responseText = pm.response.text();",
          "  pm.expect(responseText).to.not.match(/Traceback|stack trace|SQLAlchemy|database error|password|secret|access_token/i);",
          "  if (expectsNonEmptyError) pm.expect(responseText.trim().length).to.be.greaterThan(0);",
          "  if (expectsJson || responseText.trim().length > 0) {",
          "    let jsonData;",
          "    try { jsonData = pm.response.json(); } catch (error) { if (expectsJson) throw new Error('Response is not valid JSON'); return; }",
          "    pm.expect(jsonData).to.be.an('object');",
          "    if (expectsCreatedObject) {",
          "      const data = jsonData.data || jsonData;",
          "      const createdId = data.id || data.ruleId || data._id;",
          "      pm.expect(createdId, 'created rule id').to.exist;",
          "      if (caseId === 'RE-LC-001') pm.collectionVariables.set('rule_id', createdId);",
          "    }",
          "  }",
          "});"
        ]
      }
    }],
    response: []
  };
}

const folders = new Map();
for (const testCase of cases) {
  const name = groupName(testCase.caseId);
  if (!folders.has(name)) folders.set(name, []);
  folders.get(name).push(itemFromCase(testCase));
}

const collection = {
  info: {
    _postman_id: "9a9e8c8e-1f62-4f41-9d62-8b9d56d41b9a",
    name: "CICD",
    description: "Generated from rule-engine-api-testcases.xlsx for Newman CI/CD.",
    schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  item: [...folders.entries()].map(([name, item]) => ({ name, item })),
  variable: [
    { key: "base_url", value: baseUrl },
    { key: "rule_id", value: "" }
  ]
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(collection, null, 2), "utf8");
console.log(`Wrote ${cases.length} Postman requests to ${outputPath}`);
