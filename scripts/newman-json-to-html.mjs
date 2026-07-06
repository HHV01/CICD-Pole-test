import fs from "node:fs";
import path from "node:path";

const inputPath = process.argv[2] || "reports/newman-results.json";
const outputPath = process.argv[3] || "reports/newman-report.html";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function statusClass(failed) {
  return failed > 0 ? "fail" : "pass";
}

function formatUrl(url) {
  if (!url) return "";
  if (typeof url === "string") return url;
  if (url.raw) return url.raw;

  const protocol = url.protocol ? `${url.protocol}://` : "";
  const host = Array.isArray(url.host) ? url.host.join(".") : (url.host || "");
  const port = url.port ? `:${url.port}` : "";
  const pathText = Array.isArray(url.path) ? `/${url.path.join("/")}` : (url.path ? `/${url.path}` : "");
  const query = Array.isArray(url.query)
    ? url.query
        .filter((item) => item && item.key !== undefined && item.value !== undefined)
        .map((item) => `${encodeURIComponent(item.key)}=${encodeURIComponent(item.value)}`)
        .join("&")
    : "";
  return `${protocol}${host}${port}${pathText}${query ? `?${query}` : ""}`;
}

function parseDescription(execution) {
  const content = execution.item?.request?.description?.content || execution.request?.description?.content || "";
  const lines = String(content).split(/\r?\n/);
  const excelRow = (content.match(/Excel row:\s*(\d+)/i) || [])[1] || "";
  const expectedIndex = lines.findIndex((line) => line.trim().startsWith("Expected:"));
  const summary = lines.find((line) => line.trim() && !line.trim().startsWith("Excel row:") && !line.trim().startsWith("Expected:")) || "";
  const expected = expectedIndex >= 0
    ? lines.slice(expectedIndex).join("\n").replace(/^Expected:\s*/i, "").trim()
    : "";
  return { summary, excelRow, expected };
}

function parseCaseId(itemName) {
  return (String(itemName).match(/^\[([^\]]+)\]/) || [])[1] || "";
}

function streamToText(stream) {
  if (!stream) return "";
  if (typeof stream === "string") return stream;
  if (Array.isArray(stream.data)) {
    return Buffer.from(stream.data).toString("utf8");
  }
  if (Array.isArray(stream)) {
    return Buffer.from(stream).toString("utf8");
  }
  return "";
}

function formatBody(text, maxLength = 6000) {
  const raw = String(text || "");
  if (!raw) return "";
  let formatted = raw;
  try {
    formatted = JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    formatted = raw;
  }
  if (formatted.length > maxLength) {
    return `${formatted.slice(0, maxLength)}\n... truncated ${formatted.length - maxLength} characters`;
  }
  return formatted;
}

function findMessage(value) {
  if (!value || typeof value !== "object") return "";
  const candidates = [
    value.error?.message,
    value.message,
    value.data?.message,
    value.meta?.message,
    value.error_description,
    value.errorMessage,
  ];
  const directMessage = candidates.find((candidate) => typeof candidate === "string" && candidate.trim());
  if (directMessage) return directMessage.trim();

  for (const child of Object.values(value)) {
    if (child && typeof child === "object") {
      const nestedMessage = findMessage(child);
      if (nestedMessage) return nestedMessage;
    }
  }

  return "";
}

function responseMessageText(text) {
  const raw = String(text || "").trim();
  if (!raw) return "-";
  try {
    const parsed = JSON.parse(raw);
    return findMessage(parsed) || "-";
  } catch {
    return raw.length > 500 ? `${raw.slice(0, 500)}...` : raw;
  }
}

function requestBodyText(execution) {
  const body = execution.request?.body || execution.item?.request?.body;
  if (!body) return "";
  if (body.raw) return body.raw;
  if (body.urlencoded) return JSON.stringify(body.urlencoded, null, 2);
  if (body.formdata) return JSON.stringify(body.formdata, null, 2);
  return "";
}

const report = JSON.parse(fs.readFileSync(inputPath, "utf8"));
const run = report.run || {};
const stats = run.stats || {};
const timings = run.timings || {};
const executions = run.executions || [];
const failures = run.failures || [];

const requestTotal = stats.requests?.total ?? executions.length;
const requestFailed = stats.requests?.failed ?? 0;
const assertionTotal = stats.assertions?.total ?? 0;
const assertionFailed = stats.assertions?.failed ?? 0;
const durationMs = timings.completed && timings.started ? timings.completed - timings.started : 0;

const rows = executions.map((execution) => {
  const itemName = execution.item?.name || "Unnamed request";
  const method = execution.request?.method || "";
  const url = formatUrl(execution.request?.url || execution.item?.request?.url);
  const code = execution.response?.code ?? "";
  const status = execution.response?.status || "";
  const responseTime = execution.response?.responseTime ?? "";
  const assertionFailures = (execution.assertions || []).filter((assertion) => assertion.error);
  const failed = assertionFailures.length;
  const resultLabel = failed > 0 ? "FAIL" : "PASS";
  const { summary, excelRow, expected } = parseDescription(execution);
  const caseId = parseCaseId(itemName);
  const errorText = assertionFailures.map((assertion) => assertion.error?.message).filter(Boolean).join("; ");
  const rawResponseBody = streamToText(execution.response?.stream);
  const responseBody = formatBody(rawResponseBody);
  const responseMessage = responseMessageText(rawResponseBody);
  const requestBody = formatBody(requestBodyText(execution), 2500);
  const requestBodyRow = requestBody
    ? `<tr><th>Request Body</th><td><pre>${escapeHtml(requestBody)}</pre></td></tr>`
    : "";
  const responseBodyRow = responseBody
    ? `<tr><th>Response Body</th><td><details open><summary>View response JSON</summary><pre>${escapeHtml(responseBody)}</pre></details></td></tr>`
    : `<tr><th>Response Body</th><td>-</td></tr>`;

  return `
    <section class="request ${statusClass(failed)}">
      <div class="request-head">
        <div>
          <h2>${escapeHtml(itemName)}</h2>
          <p>${escapeHtml(summary)}</p>
        </div>
        <div class="pill ${statusClass(failed)}">${resultLabel}</div>
      </div>
      <table>
        <tr><th>Case ID</th><td>${escapeHtml(caseId || "-")}</td></tr>
        <tr><th>Excel Row</th><td>${escapeHtml(excelRow || "-")}</td></tr>
        <tr><th>API Purpose</th><td>${escapeHtml(summary || "-")}</td></tr>
        <tr><th>Method</th><td><strong>${escapeHtml(method)}</strong></td></tr>
        <tr><th>URL</th><td class="mono">${escapeHtml(url)}</td></tr>
        ${requestBodyRow}
        <tr><th>Expected Result</th><td class="pre">${escapeHtml(expected || "-")}</td></tr>
        <tr><th>Actual Result</th><td>HTTP ${escapeHtml(code)} ${escapeHtml(status)}; ${escapeHtml(responseTime)} ms</td></tr>
        <tr><th>Status</th><td><span class="inline-status ${statusClass(failed)}">${resultLabel}</span></td></tr>
        ${responseBodyRow}
        <tr><th>Message trả về</th><td>${escapeHtml(responseMessage)}${errorText ? `<div class="error">${escapeHtml(errorText)}</div>` : ""}</td></tr>
      </table>
    </section>`;
}).join("");

const failureList = failures.length
  ? `<section class="panel fail"><h2>Failures</h2><ul>${failures.map((failure) => `<li>${escapeHtml(failure.source?.name || failure.error?.name || "Failure")}: ${escapeHtml(failure.error?.message || "")}</li>`).join("")}</ul></section>`
  : "";

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Newman API Report</title>
  <style>
    :root {
      color-scheme: light;
      font-family: Arial, sans-serif;
      --bg: #f5f7fb;
      --text: #182033;
      --muted: #667085;
      --line: #d8deea;
      --pass: #067647;
      --pass-bg: #e7f7ee;
      --fail: #b42318;
      --fail-bg: #fff0ed;
      --card: #ffffff;
    }
    * { box-sizing: border-box; }
    body { margin: 0; background: var(--bg); color: var(--text); }
    main { max-width: 1100px; margin: 0 auto; padding: 32px 20px; }
    h1 { margin: 0 0 8px; font-size: 28px; }
    h2 { margin: 0 0 8px; font-size: 18px; }
    p { margin: 0; color: var(--muted); }
    .summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin: 24px 0; }
    .card, .request, .panel { background: var(--card); border: 1px solid var(--line); border-radius: 8px; padding: 16px; }
    .card strong { display: block; font-size: 26px; margin-top: 6px; }
    .request { margin-bottom: 14px; }
    .request.pass { border-left: 5px solid var(--pass); }
    .request.fail { border-left: 5px solid var(--fail); }
    .request-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
    .pill { padding: 6px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; }
    .pill.pass { color: var(--pass); background: var(--pass-bg); }
    .pill.fail { color: var(--fail); background: var(--fail-bg); }
    .meta { display: flex; flex-wrap: wrap; gap: 8px; margin: 14px 0; }
    .meta span { border: 1px solid var(--line); border-radius: 6px; padding: 5px 8px; color: var(--muted); font-size: 13px; }
    table { width: 100%; border-collapse: collapse; margin-top: 14px; }
    th, td { border-top: 1px solid var(--line); padding: 9px 8px; text-align: left; vertical-align: top; }
    th { width: 170px; color: var(--muted); font-size: 13px; font-weight: 700; }
    .mono { font-family: Consolas, monospace; font-size: 13px; word-break: break-all; }
    .pre { white-space: pre-line; }
    pre { margin: 8px 0 0; white-space: pre-wrap; word-break: break-word; font-family: Consolas, monospace; font-size: 12px; line-height: 1.45; background: #0f172a; color: #e6edf7; border-radius: 6px; padding: 12px; max-height: 360px; overflow: auto; }
    details summary { cursor: pointer; color: var(--muted); font-size: 13px; }
    .inline-status { font-weight: 700; }
    .inline-status.pass { color: var(--pass); }
    .inline-status.fail { color: var(--fail); }
    ul { margin: 12px 0 0; padding-left: 20px; }
    li { margin: 7px 0; }
    .assertion span { font-weight: 700; margin-right: 8px; }
    .assertion.pass span { color: var(--pass); }
    .assertion.fail span, .error { color: var(--fail); }
    @media (max-width: 760px) {
      .summary { grid-template-columns: 1fr 1fr; }
      .request-head { display: block; }
      .pill { display: inline-block; margin-top: 12px; }
    }
  </style>
</head>
<body>
  <main>
    <h1>Newman API Report</h1>
    <p>Collection: ${escapeHtml(report.collection?.name || "CICD")}</p>
    <div class="summary">
      <div class="card">Requests<strong>${requestTotal - requestFailed}/${requestTotal}</strong></div>
      <div class="card">Assertions<strong>${assertionTotal - assertionFailed}/${assertionTotal}</strong></div>
      <div class="card">Failures<strong>${assertionFailed}</strong></div>
      <div class="card">Duration<strong>${durationMs} ms</strong></div>
    </div>
    ${failureList}
    ${rows}
  </main>
</body>
</html>`;

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, html, "utf8");
console.log(`HTML report written to ${outputPath}`);
