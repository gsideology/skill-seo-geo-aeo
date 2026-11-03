#!/usr/bin/env node
// Tests a remote MCP server (Streamable HTTP, JSON replies) the way assistants call it, plus optional
// reference cases and latency. Node 18+, no dependencies. Prints what fails; exit code 1 on failure.
//
//   node mcp_smoke_test.mjs <endpoint URL> [--cases cases.json] [--repeat N] [--search-tool find_tools] [--verbose]
//
// cases.json (all fields optional except q for search cases and tool/args for call cases):
//   [ { "q": "merge pdf", "language": "en", "top": "merge-pdf", "in3": "split-pdf", "lang": "en", "none": true, "partial": true },
//     { "tool": "get_tool", "args": { "slug": "MERGE-PDF" }, "expect": { "slug": "merge-pdf" } },
//     { "tool": "find_tools", "args": { "query": "pdf", "extra": 1 }, "isError": true } ]
// Search cases call --search-tool with { query, language? } and read results[].slug, language, partial.

const args = process.argv.slice(2);
const endpoint = args.find((a) => !a.startsWith("--") && /^https?:/.test(a));
const opt = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : d;
};
const flag = (n) => args.includes(`--${n}`);
if (!endpoint) {
  console.error("Usage: node mcp_smoke_test.mjs <endpoint URL> [--cases cases.json] [--repeat N] [--search-tool find_tools] [--verbose]");
  process.exit(2);
}
const repeat = Number(opt("repeat", 0));
const searchTool = opt("search-tool", "find_tools");
const results = [];
const record = (status, name, detail) => {
  results.push({ status, name, detail });
  if (status !== "PASS" || flag("verbose")) console.log(`${status} ${name}${detail && status !== "PASS" ? `\n       ${String(typeof detail === "string" ? detail : JSON.stringify(detail)).slice(0, 400)}` : ""}`);
};
const check = (name, ok, detail) => record(ok ? "PASS" : "FAIL", name, ok ? undefined : detail);
const warnIf = (name, bad, detail) => bad && record("WARN", name, detail);
let id = 1;

async function post(body, timeout = 20_000) {
  const t = performance.now();
  const r = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
    body,
    signal: AbortSignal.timeout(timeout),
  });
  const text = await r.text();
  return { status: r.status, headers: r.headers, text, ms: performance.now() - t, type: r.headers.get("content-type") ?? "" };
}
function parse(text) {
  try {
    return JSON.parse(text);
  } catch {
    // An SSE reply: take the last "data:" line.
    const data = text.split("\n").filter((l) => l.startsWith("data:")).pop();
    try {
      return data ? JSON.parse(data.slice(5)) : undefined;
    } catch {
      return undefined;
    }
  }
}
async function rpc(method, params) {
  const r = await post(JSON.stringify({ jsonrpc: "2.0", id: id++, method, ...(params === undefined ? {} : { params }) }));
  if (!r.text) throw new Error(`HTTP ${r.status} with an empty body`);
  return parse(r.text);
}
async function call(name, a) {
  const r = await rpc("tools/call", { name, arguments: a });
  if (r?.error) return { rpcError: r.error };
  const res = r?.result ?? {};
  let data = res.structuredContent;
  if (data === undefined && !res.isError) data = parse(res.content?.[0]?.text ?? "");
  return { isError: !!res.isError, text: res.content?.[0]?.text ?? "", data };
}

// Preflight: an empty or cut reply usually means something in between swallowed it.
let reachable = true;
try {
  const r = await rpc("ping");
  if (!r) throw new Error("reply is not JSON");
} catch (e) {
  reachable = false;
  const why = e.cause?.code ?? e.message;
  console.log(`FAIL cannot talk to ${endpoint}: ${why}`);
  if (/terminated|empty body|ECONNRESET|chunk/i.test(why)) {
    console.log("     The reply was empty or cut. If GET works but POST doesn't, something between this computer and the server");
    console.log("     (antivirus HTTPS scanning, a proxy) may intercept MCP traffic: check the TLS issuer with");
    console.log("     openssl s_client -connect host:443 | openssl x509 -noout -issuer, or test from another network.");
  }
  results.push({ status: "FAIL", name: "preflight" });
}

if (reachable) {

  // Protocol
  let r = await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "mcp-smoke-test", version: "1" } });
  check("initialize echoes 2025-06-18", r?.result?.protocolVersion === "2025-06-18", r);
  check("initialize: capabilities.tools and serverInfo", !!r?.result?.capabilities?.tools && !!r?.result?.serverInfo?.name, r?.result);
  warnIf("initialize: no instructions for the model", !r?.result?.instructions, "");
  r = await rpc("initialize", { protocolVersion: "1999-01-01" });
  check("unknown protocol version → a version the server supports", typeof r?.result?.protocolVersion === "string" && r.result.protocolVersion !== "1999-01-01", r?.result);
  let p = await post(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }));
  check("notification → 202 with no body", p.status === 202 && p.text === "", { status: p.status, body: p.text.slice(0, 100) });
  r = await rpc("ping");
  check("ping → {}", r?.result && Object.keys(r.result).length === 0, r);
  r = await rpc("tools/list");
  const tools = r?.result?.tools ?? [];
  check(`tools/list (${tools.length} tools)`, tools.length > 0, r);
  for (const t of tools) {
    check(`${t.name}: inputSchema is an object schema`, t.inputSchema?.type === "object", t.inputSchema);
    warnIf(`${t.name}: inputSchema allows extra properties`, t.inputSchema?.additionalProperties !== false, "");
    warnIf(`${t.name}: no readOnlyHint`, t.annotations?.readOnlyHint !== true, "only if the tool has no side effects");
    warnIf(`${t.name}: short description`, (t.description ?? "").length < 40, t.description);
  }
  r = await rpc("resources/list");
  check("unknown method → -32601", r?.error?.code === -32601, r);
  p = await post("{not json");
  check("parse error → -32700", parse(p.text)?.error?.code === -32700, { status: p.status, body: p.text.slice(0, 200) });
  warnIf("parse error → HTTP status other than 400", p.status !== 400, p.status);
  p = await post(JSON.stringify({ foo: 1 }));
  check("invalid request → -32600", parse(p.text)?.error?.code === -32600, p.text.slice(0, 200));
  p = await post("x".repeat(70_000));
  warnIf("oversized body not rejected (413)", p.status !== 413, p.status);
  const g = await fetch(endpoint, { headers: { Accept: "text/event-stream" }, signal: AbortSignal.timeout(20_000) });
  check("GET as an MCP client (Accept: text/event-stream) → 405 or an SSE stream", g.status === 405 || (g.headers.get("content-type") ?? "").includes("text/event-stream"), g.status);
  await g.body?.cancel();
  // A model that opens the URL with a web-fetch tool should learn what it is, not see an error.
  const plain = await fetch(endpoint, { headers: { Accept: "text/html,*/*" }, signal: AbortSignal.timeout(20_000) });
  const plainText = await plain.text();
  warnIf("GET from a browser/fetch tool returns an error: serve a short page saying it's an MCP server and how to connect", !plain.ok || !/mcp/i.test(plainText), `HTTP ${plain.status}`);
  // Pre-connection discovery: AI Catalog → MCP Server Card (SEP-2127).
  const origin = new URL(endpoint).origin;
  const cat = await fetch(`${origin}/.well-known/ai-catalog.json`, { signal: AbortSignal.timeout(20_000) }).catch(() => null);
  const catalog = cat?.ok ? await cat.json().catch(() => null) : null;
  warnIf("no /.well-known/ai-catalog.json listing the MCP server card", !catalog?.entries?.some((x) => x.type === "application/mcp-server-card+json"), cat ? `HTTP ${cat.status}` : "unreachable");
  const cardUrl = catalog?.entries?.find((x) => x.type === "application/mcp-server-card+json")?.url ?? `${endpoint.replace(/\/$/, "")}/server-card`;
  const cardRes = await fetch(cardUrl, { headers: { Accept: "application/mcp-server-card+json" }, signal: AbortSignal.timeout(20_000) }).catch(() => null);
  const card = cardRes?.ok ? await cardRes.json().catch(() => null) : null;
  warnIf(`no valid MCP Server Card at ${cardUrl}`, !card?.$schema?.includes("server-card") || !card?.remotes?.length, cardRes ? `HTTP ${cardRes.status}` : "unreachable");
  const o = await fetch(endpoint, { method: "OPTIONS", headers: { Origin: "https://example.org", "Access-Control-Request-Method": "POST" }, signal: AbortSignal.timeout(20_000) });
  warnIf("OPTIONS: no CORS (browser-based MCP clients can't connect)", !o.headers.get("access-control-allow-origin"), o.status);
  r = await rpc("tools/call", { name: "no_such_tool_xyz", arguments: {} });
  check("unknown tool → -32602 or isError", r?.error?.code === -32602 || r?.result?.isError === true, r);
  if (tools[0]) {
    const t = await call(tools[0].name, { __not_a_parameter__: 1 });
    warnIf(`${tools[0].name}: undeclared parameter accepted`, !t.isError && !t.rpcError, t.text.slice(0, 200));
  }

  // Cases
  const casesFile = opt("cases");
  if (casesFile) {
    const { readFileSync } = await import("node:fs");
    const cases = JSON.parse(readFileSync(casesFile, "utf8"));
    for (const k of cases) {
      if (k.q !== undefined) {
        const label = `search "${k.q}"${k.language ? ` (${k.language})` : ""}`;
        const res = await call(searchTool, k.language ? { query: k.q, language: k.language } : { query: k.q });
        const d = res.data ?? {};
        const slugs = (d.results ?? []).map((x) => x.slug);
        const problems = [];
        if (res.rpcError || res.isError) problems.push(`error: ${res.text || JSON.stringify(res.rpcError)}`);
        if (k.top && slugs[0] !== k.top) problems.push(`first is ${slugs[0] ?? "nothing"}, expected ${k.top}`);
        if (k.in3 && !slugs.slice(0, 3).includes(k.in3)) problems.push(`${k.in3} not in the first 3`);
        if (k.lang && d.language !== k.lang) problems.push(`language ${d.language}, expected ${k.lang}`);
        if (k.none && slugs.length) problems.push("expected no result");
        if (k.partial && d.partial !== true) problems.push("expected partial: true");
        if (!k.partial && !k.none && d.partial) problems.push("only partial matches");
        check(label, !problems.length, `${problems.join("; ")} · got ${slugs.slice(0, 5).join(", ") || "(none)"}`);
      } else if (k.tool) {
        const res = await call(k.tool, k.args ?? {});
        const label = `${k.tool} ${JSON.stringify(k.args ?? {})}`;
        if (k.isError) check(`${label} → isError`, res.isError || !!res.rpcError, res.text);
        else {
          const d = res.data ?? {};
          const bad = Object.entries(k.expect ?? {}).filter(([key, v]) => JSON.stringify(d[key]) !== JSON.stringify(v));
          check(label, !res.isError && !res.rpcError && !bad.length, bad.length ? bad.map(([key, v]) => `${key}: ${JSON.stringify(d[key])} ≠ ${JSON.stringify(v)}`).join("; ") : res.text);
        }
      }
    }
  }

  // Latency
  if (repeat > 0 && tools[0]) {
    const name = tools.some((t) => t.name === searchTool) ? searchTool : tools[0].name;
    const body = JSON.stringify({ jsonrpc: "2.0", id: 1, method: name === searchTool ? "tools/call" : "tools/list", params: name === searchTool ? { name, arguments: { query: "test" } } : undefined });
    const times = [];
    const failures = [];
    for (let i = 1; i <= repeat; i++) {
      try {
        const x = await post(body);
        times.push(x.ms);
        if (x.status !== 200 || !x.text) failures.push(`#${i}: HTTP ${x.status}, ${x.text.length} bytes`);
      } catch (e) {
        failures.push(`#${i}: ${e.message}`);
      }
      await new Promise((res) => setTimeout(res, 500));
    }
    const s = [...times].sort((a, b) => a - b);
    const at = (q) => Math.round(s[Math.min(s.length - 1, Math.floor(q * s.length))] ?? 0);
    const summary = `${repeat} calls · median ${at(0.5)} ms · p95 ${at(0.95)} ms · max ${at(1)} ms`;
    check(`latency: every call answered (${summary})`, !failures.length, failures);
    warnIf(`latency: ${times.filter((t) => t > 2000).length} calls over 2 s (often the host)`, times.some((t) => t > 2000), summary);
  }

}

const n = (st) => results.filter((x) => x.status === st).length;
console.log(`\n${n("FAIL") ? `${n("FAIL")} FAILED` : "ALL PASSED"} · ${n("PASS")} passed · ${n("WARN")} warnings`);
// exitCode, not process.exit(): forcing exit while sockets close can crash Node on Windows.
process.exitCode = n("FAIL") ? 1 : 0;
