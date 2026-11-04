#!/usr/bin/env node
// Runs every check of this repository: syntax, skill validation, unit tests, JSON, the three check
// scripts against local fixtures (served by `php -S`, which also runs the PHP MCP template), the zip,
// and the plugin manifests. Node 18+, no dependencies; PHP ≥ 8.1 for the PHP steps (skipped without it).
//
//   node scripts/test.mjs [--verbose]                       offline suite (run before every commit)
//   node scripts/test.mjs --online https://example.com [--mcp https://example.com/mcp]
//                                                            also check a live site (sitemap, AI access, MCP)
// PHP is found through $PHP_BIN, `php` on the PATH, or C:\xampp\php\php.exe. Exit code 1 on failure.

import { spawn, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const skill = join(root, "skills", "seo-geo-aeo");
const args = process.argv.slice(2);
const opt = (n) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const verbose = args.includes("--verbose");
const results = [];
const rel = (p) => relative(root, p).split(/[\\/]/).join("/");

function report(status, name, detail = "") {
  results.push(status);
  console.log(`${status.padEnd(4)} ${name}${detail ? `\n${detail.trimEnd().split("\n").map((l) => `       ${l}`).join("\n")}` : ""}`);
}
function node(script, scriptArgs, { cwd = root, env } = {}) {
  const r = spawnSync(process.execPath, [script, ...scriptArgs], { cwd, encoding: "utf8", env: { ...process.env, ...env }, timeout: 600_000 });
  return { code: r.status, out: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}
/** Runs a step: fn returns [ok, detail]; detail is printed only on failure. */
async function step(name, fn) {
  try {
    const [ok, detail] = await fn();
    report(ok ? "PASS" : "FAIL", name, ok && !verbose ? "" : detail);
  } catch (e) {
    report("FAIL", name, e.stack ?? String(e));
  }
}
const tail = (s, n = 25) => s.trimEnd().split("\n").slice(-n).join("\n");
function walk(dir) {
  return readdirSync(dir).flatMap((n) => {
    if ([".git", "node_modules", "dist"].includes(n)) return [];
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
const files = walk(root);

/* ------------------------------------------------------------------ offline */

await step(`node --check (${files.filter((f) => f.endsWith(".mjs")).length} .mjs files)`, () => {
  const bad = files.filter((f) => f.endsWith(".mjs")).map((f) => [f, spawnSync(process.execPath, ["--check", f], { encoding: "utf8" })]).filter(([, r]) => r.status !== 0);
  return [!bad.length, bad.map(([f, r]) => `${rel(f)}: ${r.stderr}`).join("\n")];
});

await step("validate-skill (frontmatter, links, length, line endings)", () => {
  const r = node("scripts/validate-skill.mjs", []);
  return [r.code === 0, r.out];
});

await step("unit tests (robots.txt matching, HTML inspection, zip)", () => {
  const r = node("tests/unit.test.mjs", []);
  return [r.code === 0, r.out];
});

await step(`JSON files parse (${files.filter((f) => f.endsWith(".json")).length})`, () => {
  const bad = [];
  for (const f of files.filter((x) => x.endsWith(".json"))) {
    try {
      JSON.parse(readFileSync(f, "utf8"));
    } catch (e) {
      bad.push(`${rel(f)}: ${e.message}`);
    }
  }
  return [!bad.length, bad.join("\n")];
});

await step("check_sitemap fails a broken sitemap with the expected reasons", () => {
  const r = node(join(skill, "scripts/check_sitemap.mjs"), [join(root, "tests/fixtures/sitemap-bad.xml")]);
  const expected = ["bad lastmod", "duplicate <loc>", "other origin", "doesn't list itself", "differ from those of"];
  const missing = expected.filter((e) => !r.out.includes(e));
  return [r.code === 1 && !missing.length, `exit ${r.code}; missing: ${missing.join(", ")}\n${r.out}`];
});

await step("check_sitemap accepts hreflang with script and numeric region (es-419, zh-Hant-TW)", () => {
  const dir = mkdtempSync(join(tmpdir(), "seo-geo-aeo-sitemap-"));
  const f = join(dir, "sitemap.xml");
  const alt = (u) => ["en", "es-419", "zh-Hant-TW", "x-default"].map((h, i) => `<xhtml:link rel="alternate" hreflang="${h}" href="https://example.com/${["", "es", "zh", ""][i]}"/>`).join("");
  const url = (p) => `<url><loc>https://example.com/${p}</loc>${alt()}</url>`;
  writeFileSync(f, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${url("")}${url("es")}${url("zh")}</urlset>\n`);
  const r = node(join(skill, "scripts/check_sitemap.mjs"), [f]);
  rmSync(dir, { recursive: true, force: true });
  return [r.code === 0 && !/bad hreflang/.test(r.out), r.out];
});

await step("check_sitemap never reads a local file named by a sitemap index", () => {
  const dir = mkdtempSync(join(tmpdir(), "seo-geo-aeo-index-"));
  const secret = join(dir, "secret.xml");
  writeFileSync(secret, `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://example.com/leaked</loc></url></urlset>`);
  const index = join(dir, "index.xml");
  writeFileSync(index, `<?xml version="1.0"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>${secret}</loc></sitemap></sitemapindex>`);
  const r = node(join(skill, "scripts/check_sitemap.mjs"), [index]);
  rmSync(dir, { recursive: true, force: true });
  return [r.code === 1 && /not an absolute http\(s\) URL/.test(r.out) && !/leaked|1 URLs/.test(r.out), r.out];
});

await step("check_sitemap rejects a non-numeric --concurrency before any request", () => {
  const r = node(join(skill, "scripts/check_sitemap.mjs"), [join(root, "tests/fixtures/sitemap-bad.xml"), "--concurrency", "x"]);
  return [r.code === 2 && /--concurrency must be a positive integer/.test(r.out), `exit ${r.code}\n${r.out}`];
});

/** Like node(), but asynchronous, so an HTTP server in this process can answer the child. */
function nodeAsync(script, scriptArgs) {
  return new Promise((res) => {
    const c = spawn(process.execPath, [script, ...scriptArgs], { cwd: root });
    let out = "";
    c.stdout.on("data", (d) => (out += d));
    c.stderr.on("data", (d) => (out += d));
    c.on("close", (code) => res({ code, out }));
  });
}

await step("check_ai_access follows robots.txt redirects and reads unquoted noindex", async () => {
  const { createServer: createHttp } = await import("node:http");
  const page = (robots) => `<!doctype html><html lang=en><head><title>T</title><meta name=description content=D>${robots}<link rel=canonical href=/p></head><body><h1>H</h1></body></html>`;
  const srv = createHttp((req, res) => {
    if (req.url === "/robots.txt") return res.writeHead(301, { Location: "/real-robots.txt" }).end();
    if (req.url === "/real-robots.txt") return res.writeHead(200, { "Content-Type": "text/plain" }).end("User-agent: *\nDisallow: /admin/\nSitemap: http://127.0.0.1/sitemap.xml\n");
    if (req.url === "/p") return res.writeHead(200, { "Content-Type": "text/html" }).end(page(""));
    if (req.url === "/hidden") return res.writeHead(200, { "Content-Type": "text/html" }).end(page("<meta name=robots content=noindex>"));
    res.writeHead(404).end();
  });
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${srv.address().port}/`;
  try {
    const a = await nodeAsync(join(skill, "scripts/check_ai_access.mjs"), [base, "--paths", "p", "--min-words", "0"]);
    const b = await nodeAsync(join(skill, "scripts/check_ai_access.mjs"), [base, "--paths", "hidden", "--min-words", "0"]);
    const ok = a.code === 0 && /robots\.txt redirects/.test(a.out) && /PASS GPTBot/.test(a.out) && b.code === 1 && /FAIL noindex/.test(b.out);
    return [ok, `redirect run: exit ${a.code}\n${tail(a.out, 20)}\nunquoted noindex run: exit ${b.code}\n${tail(b.out, 10)}`];
  } finally {
    srv.close();
  }
});

/* ------------------------------------------------------------------ PHP: template + fixtures over HTTP */

function findPhp() {
  for (const c of [process.env.PHP_BIN, "php", "C:\\xampp\\php\\php.exe"].filter(Boolean)) {
    const r = spawnSync(c, ["-r", "echo PHP_VERSION;"], { encoding: "utf8" });
    if (r.status === 0 && /^\d+\.\d+/.test(r.stdout.trim().split("\n").pop())) return { bin: c, version: r.stdout.trim().split("\n").pop() };
  }
  return null;
}
const freePort = () =>
  new Promise((res, rej) => {
    const s = createServer();
    s.once("error", rej);
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close(() => res(port));
    });
  });

const php = findPhp();
if (!php) {
  report("SKIP", "PHP steps: no PHP found (set PHP_BIN); the MCP template and the HTTP checks were not run");
} else {
  await step(`php -l templates/mcp-server.php (PHP ${php.version})`, () => {
    const r = spawnSync(php.bin, ["-l", join(skill, "templates/mcp-server.php")], { encoding: "utf8" });
    return [r.status === 0 && /No syntax errors/.test(r.stdout), `${r.stdout}${r.stderr}`];
  });

  const port = await freePort();
  const origin = `http://127.0.0.1:${port}`;
  const docroot = mkdtempSync(join(tmpdir(), "seo-geo-aeo-test-"));
  const fill = (src, dst) => {
    for (const f of walk(src)) {
      const out = join(dst, relative(src, f));
      mkdirSync(dirname(out), { recursive: true });
      writeFileSync(out, readFileSync(f, "utf8").replaceAll("{{ORIGIN}}", origin));
    }
  };
  fill(join(root, "tests/fixtures/site"), docroot);
  // The endpoint lives under /a/, as on the original site: some antivirus HTTPS scanners intercept "/mcp".
  fill(join(root, "tests/fixtures/agent"), join(docroot, "a", "agent"));
  cpSync(join(skill, "templates/mcp-server.php"), join(docroot, "a", "mcp.php"));
  const server = spawn(php.bin, ["-S", `127.0.0.1:${port}`, "-t", docroot], { stdio: "ignore" });
  let up = false;
  for (let i = 0; i < 50 && !up; i++) {
    await new Promise((r) => setTimeout(r, 100));
    up = await fetch(`${origin}/robots.txt`).then((r) => r.ok, () => false);
  }
  try {
    if (!up) report("FAIL", `php -S on ${origin} did not start`);
    else {
      const endpoint = `${origin}/a/mcp.php`;
      await step("mcp_smoke_test: PHP template + reference cases, no failures and no warnings", () => {
        const r = node(join(skill, "scripts/mcp_smoke_test.mjs"), [endpoint, "--cases", join(skill, "templates/cases.example.json"), "--repeat", "3"]);
        // The one tolerated warning depends on this computer, not on the code: antivirus cutting MCP-Protocol-Version requests.
        const warns = r.out.split("\n").filter((l) => /^WARN/.test(l) && !/MCP-Protocol-Version header are cut/.test(l));
        return [r.code === 0 && /ALL PASSED/.test(r.out) && !warns.length, r.out];
      });
      await step("PHP template serves the Server Card at <endpoint>/server-card (type, CORS, ETag)", async () => {
        const r = await fetch(`${endpoint}/server-card`);
        const body = await r.text();
        const etag = r.headers.get("etag");
        const again = etag ? await fetch(`${endpoint}/server-card`, { headers: { "If-None-Match": etag } }) : null;
        await again?.body?.cancel();
        const ok = r.status === 200 && r.headers.get("content-type") === "application/mcp-server-card+json" && r.headers.get("access-control-allow-origin") === "*" && JSON.parse(body).remotes?.[0]?.url === endpoint && again?.status === 304;
        return [ok, `HTTP ${r.status} ${r.headers.get("content-type")} etag ${etag} → ${again?.status}\n${body.slice(0, 300)}`];
      });
      await step("mcp_smoke_test fails a wrong expectation", () => {
        const bad = join(docroot, "cases-wrong.json");
        writeFileSync(bad, JSON.stringify([{ q: "compress pdf", top: "merge-pdf" }]));
        const r = node(join(skill, "scripts/mcp_smoke_test.mjs"), [endpoint, "--cases", bad]);
        return [r.code === 1 && /FAIL search "compress pdf"/.test(r.out), r.out];
      });
      await step("check_sitemap --fetch --canonical on the fixture site", () => {
        const r = node(join(skill, "scripts/check_sitemap.mjs"), [`${origin}/sitemap.xml`, "--fetch", "--canonical"]);
        return [r.code === 0 && /OK: 4 URLs, no problems/.test(r.out), r.out];
      });
      await step("check_ai_access on the fixture site (robots per crawler, llms.txt, pages)", () => {
        const r = node(join(skill, "scripts/check_ai_access.mjs"), [`${origin}/`, "--paths", ".,merge-pdf.html,it/unire-pdf.html"]);
        return [r.code === 0 && /NO FAILURES/.test(r.out) && !/^WARN/m.test(r.out) && /PASS GPTBot/.test(r.out), r.out];
      });
      await step("check_ai_access fails a noindex page and a required crawler that is blocked", () => {
        const a = node(join(skill, "scripts/check_ai_access.mjs"), [`${origin}/`, "--paths", "private.html"]);
        const b = node(join(skill, "scripts/check_ai_access.mjs"), [`${origin}/`, "--paths", "merge-pdf.html", "--require-allow", "Googlebot"]);
        const c = node(join(skill, "scripts/check_ai_access.mjs"), [`${origin}/`, "--paths", "admin/,merge-pdf.html", "--require-allow", "GPTBot"]);
        const ok = a.code === 1 && /FAIL noindex/.test(a.out) && b.code === 0 && c.code === 1 && /FAIL GPTBot \[training/.test(c.out);
        return [ok, `noindex run: exit ${a.code}\n${tail(a.out, 8)}\nrequire Googlebot: exit ${b.code}\nrequire GPTBot: exit ${c.code}\n${tail(c.out, 12)}`];
      });
    }
  } finally {
    server.kill();
    await new Promise((r) => setTimeout(r, 300));
    rmSync(docroot, { recursive: true, force: true });
  }
}

/* ------------------------------------------------------------------ zip and plugin */

await step("build-zip: dist/seo-geo-aeo.zip has the skill folder at its root and every skill file", async () => {
  const r = node("scripts/build-zip.mjs", []);
  if (r.code !== 0) return [false, r.out];
  const { listZip } = await import("./build-zip.mjs");
  const names = listZip(readFileSync(join(root, "dist/seo-geo-aeo.zip"))).map((e) => e.name);
  const expected = walk(skill).map((f) => `seo-geo-aeo/${relative(skill, f).split(/[\\/]/).join("/")}`);
  const problems = [
    ...expected.filter((n) => !names.includes(n)).map((n) => `missing ${n}`),
    ...names.filter((n) => !n.startsWith("seo-geo-aeo/")).map((n) => `outside the skill folder: ${n}`),
    ...names.filter((n) => n.includes("\\")).map((n) => `backslash in ${n}`),
  ];
  if (!names.includes("seo-geo-aeo/SKILL.md")) problems.push("no seo-geo-aeo/SKILL.md");
  const unzip = spawnSync("unzip", ["-tq", join(root, "dist/seo-geo-aeo.zip")], { encoding: "utf8" });
  if (unzip.status !== null && unzip.status !== 0) problems.push(`unzip -t: ${unzip.stdout}${unzip.stderr}`);
  return [!problems.length, problems.join("\n")];
});

{
  // On Windows the CLI is a .cmd shim, which needs a shell; pass one command string (no user input in it).
  const claude = (cmd, cwd) => spawnSync(`claude ${cmd}`, { cwd, encoding: "utf8", shell: true });
  const probe = claude("--version");
  if (probe.status !== 0) report("SKIP", "claude plugin validate: Claude Code CLI not found");
  else
    await step(`claude plugin validate . (Claude Code ${probe.stdout.trim().split(" ")[0]})`, () => {
      const r = claude("plugin validate .", root);
      const out = `${r.stdout}${r.stderr}`;
      return [r.status === 0 && /Validation passed/.test(out), out];
    });
}

/* ------------------------------------------------------------------ online (optional) */

const site = opt("online");
if (site) {
  const base = site.replace(/\/$/, "");
  await step(`online: check_sitemap ${base}/sitemap.xml --fetch --canonical`, () => {
    const r = node(join(skill, "scripts/check_sitemap.mjs"), [`${base}/sitemap.xml`, "--fetch", "--canonical"]);
    return [r.code === 0, tail(r.out, 40)];
  });
  await step(`online: check_ai_access ${base}/`, () => {
    const r = node(join(skill, "scripts/check_ai_access.mjs"), [`${base}/`]);
    return [r.code === 0, r.out];
  });
  const mcp = opt("mcp");
  if (mcp)
    await step(`online: mcp_smoke_test ${mcp}`, () => {
      const r = node(join(skill, "scripts/mcp_smoke_test.mjs"), [mcp, "--repeat", "5"]);
      return [r.code === 0, r.out];
    });
}

const n = (s) => results.filter((x) => x === s).length;
console.log(`\n${n("FAIL") ? `${n("FAIL")} FAILED` : "ALL PASSED"} · ${n("PASS")} passed · ${n("SKIP")} skipped`);
process.exitCode = n("FAIL") ? 1 : 0;
