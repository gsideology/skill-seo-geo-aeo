#!/usr/bin/env node
// Checks a sitemap against the sitemaps.org protocol and Google's hreflang rules, optionally
// fetching every URL. Node 18+, no dependencies.
//
//   node check_sitemap.mjs <sitemap URL or file> [--fetch] [--canonical] [--concurrency 6] [--trailing-slash]
//
//   --fetch           request every <loc>: must answer 200 without redirect
//   --canonical       with --fetch, compare each page's <link rel="canonical"> with its <loc>
//   --trailing-slash  the site's canonical URLs end with "/" (default: they don't, except the root)
// Exit code 1 when something fails. Sitemap index files are followed.

import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const source = args.find((a) => !a.startsWith("--"));
const flag = (n) => args.includes(`--${n}`);
const opt = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : d;
};
if (!source) {
  console.error("Usage: node check_sitemap.mjs <sitemap URL or file> [--fetch] [--canonical] [--concurrency 6] [--trailing-slash]");
  process.exit(2);
}
const UA = "Mozilla/5.0 (compatible; sitemap-check/1.0)";
const errors = [];
const warnings = [];
const fail = (s) => errors.push(s);
const warn = (s) => warnings.push(s);

async function load(src) {
  if (/^https?:\/\//.test(src)) {
    const r = await fetch(src, { headers: { "User-Agent": UA }, redirect: "manual" });
    if (r.status !== 200) fail(`${src}: HTTP ${r.status}`);
    const type = r.headers.get("content-type") ?? "";
    if (!/xml/.test(type)) warn(`${src}: content-type "${type}" (expected application/xml or text/xml)`);
    return r.text();
  }
  return readFileSync(src, "utf8");
}

const decode = (s) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
const attr = (tag, name) => decode(tag.match(new RegExp(`\\s${name}\\s*=\\s*"([^"]*)"`))?.[1] ?? tag.match(new RegExp(`\\s${name}\\s*=\\s*'([^']*)'`))?.[1] ?? "");

/** Light structural check: balanced tags (no full XML parser, but enough to catch broken output). */
function wellFormed(xml, where) {
  const stack = [];
  const re = /<(\/?)([A-Za-z_][\w:.-]*)[^>]*?(\/?)>/g;
  const body = xml.replace(/<\?[\s\S]*?\?>/g, "").replace(/<!--[\s\S]*?-->/g, "").replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, "");
  let m;
  while ((m = re.exec(body))) {
    const [, close, name, self] = m;
    if (self) continue;
    if (!close) stack.push(name);
    else if (stack.pop() !== name) return fail(`${where}: unbalanced </${name}> near offset ${m.index}`), false;
  }
  if (stack.length) return fail(`${where}: unclosed <${stack.pop()}>`), false;
  if (/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[0-9a-f]+;)/i.test(body)) fail(`${where}: unescaped "&"`);
  return true;
}

const urls = new Map(); // loc -> { alternates: Map(hreflang -> href) }
let origin = null;

async function readSitemap(src, depth = 0) {
  const xml = await load(src);
  const where = src;
  console.log(`${where}: ${(xml.length / 1024).toFixed(1)} KB`);
  if (xml.length > 50 * 1024 * 1024) fail(`${where}: over 50 MB`);
  if (!xml.trimStart().startsWith("<?xml")) warn(`${where}: no XML declaration`);
  if (!wellFormed(xml, where)) return;
  if (/<sitemapindex[\s>]/.test(xml)) {
    if (depth > 0) return fail(`${where}: nested sitemap index`);
    for (const m of xml.matchAll(/<sitemap>([\s\S]*?)<\/sitemap>/g)) {
      const loc = decode(m[1].match(/<loc>\s*([^<]*?)\s*<\/loc>/)?.[1] ?? "");
      if (!loc) fail(`${where}: <sitemap> without <loc>`);
      else await readSitemap(loc, depth + 1);
    }
    return;
  }
  if (!/<urlset[^>]*xmlns\s*=\s*"http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9"/.test(xml)) fail(`${where}: <urlset> without the sitemaps.org 0.9 namespace`);
  const usesXhtml = /<xhtml:link/.test(xml);
  if (usesXhtml && !/xmlns:xhtml\s*=\s*"http:\/\/www\.w3\.org\/1999\/xhtml"/.test(xml)) fail(`${where}: xhtml:link used without xmlns:xhtml`);
  if (/<image:/.test(xml) && !/xmlns:image\s*=\s*"http:\/\/www\.google\.com\/schemas\/sitemap-image\/1\.1"/.test(xml)) fail(`${where}: image: used without xmlns:image`);
  let count = 0;
  for (const m of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    count++;
    const block = m[1];
    const locs = [...block.matchAll(/<loc>\s*([^<]*?)\s*<\/loc>/g)].map((x) => decode(x[1]));
    // image:loc is also "loc" inside image:image; keep only the first, top-level one.
    const loc = block.replace(/<image:image>[\s\S]*?<\/image:image>/g, "").match(/<loc>\s*([^<]*?)\s*<\/loc>/)?.[1];
    if (!loc) {
      fail(`${where}: <url> without <loc>`);
      continue;
    }
    const u = decode(loc);
    if (urls.has(u)) {
      // Keep the first entry, so its hreflang set is still checked.
      fail(`duplicate <loc> ${u}`);
      continue;
    }
    let parsed;
    try {
      parsed = new URL(u);
    } catch {
      fail(`not an absolute URL: ${u}`);
      continue;
    }
    origin ??= parsed.origin;
    if (parsed.origin !== origin) fail(`other origin: ${u}`);
    if (u.length > 2048) fail(`over 2048 characters: ${u}`);
    if (/[\s<>"{}|\\^`]/.test(u)) fail(`unescaped character: ${u}`);
    const isRoot = parsed.pathname === "/";
    if (!isRoot && !flag("trailing-slash") && parsed.pathname.endsWith("/")) warn(`trailing slash: ${u}`);
    if (!isRoot && flag("trailing-slash") && !parsed.pathname.endsWith("/")) warn(`no trailing slash: ${u}`);
    for (const lm of block.matchAll(/<lastmod>\s*([^<]*?)\s*<\/lastmod>/g)) {
      if (!/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2}))?$/.test(lm[1]) || Number.isNaN(Date.parse(lm[1]))) fail(`bad lastmod "${lm[1]}" in ${u}`);
      else if (Date.parse(lm[1]) > Date.now() + 86_400_000) warn(`lastmod in the future in ${u}`);
    }
    for (const c of block.matchAll(/<changefreq>\s*([^<]*?)\s*<\/changefreq>/g)) if (!["always", "hourly", "daily", "weekly", "monthly", "yearly", "never"].includes(c[1])) fail(`bad changefreq "${c[1]}" in ${u}`);
    for (const p of block.matchAll(/<priority>\s*([^<]*?)\s*<\/priority>/g)) if (!(Number(p[1]) >= 0 && Number(p[1]) <= 1)) fail(`bad priority "${p[1]}" in ${u}`);
    const alternates = new Map();
    for (const l of block.matchAll(/<xhtml:link\b[^>]*\/?>/g)) {
      const rel = attr(l[0], "rel");
      const hl = attr(l[0], "hreflang");
      const href = attr(l[0], "href");
      if (rel !== "alternate") fail(`xhtml:link rel="${rel}" in ${u}`);
      if (!/^([a-z]{2,3}(-[A-Za-z]{2,4})?|x-default)$/.test(hl)) fail(`bad hreflang "${hl}" in ${u}`);
      if (alternates.has(hl)) fail(`hreflang ${hl} twice in ${u}`);
      alternates.set(hl, href);
    }
    urls.set(u, { alternates, locCount: locs.length });
  }
  if (count > 50_000) fail(`${where}: ${count} URLs (over 50,000)`);
  console.log(`${where}: ${count} URLs`);
}

await readSitemap(source);

// hreflang: self-reference, x-default, alternates present in the sitemap, reciprocity.
const langs = new Map();
let withAlternates = 0;
for (const [loc, { alternates }] of urls) {
  if (!alternates.size) continue;
  withAlternates++;
  for (const hl of alternates.keys()) langs.set(hl, (langs.get(hl) ?? 0) + 1);
  if (![...alternates.values()].includes(loc)) fail(`${loc} doesn't list itself among its alternates`);
  if (!alternates.has("x-default")) warn(`${loc} has no x-default`);
  for (const [hl, href] of alternates) {
    const other = urls.get(href);
    if (!other) {
      fail(`alternate ${href} (${hl}) of ${loc} is not a <loc> of the sitemap`);
      continue;
    }
    const same = other.alternates.size === alternates.size && [...alternates].every(([k, v]) => other.alternates.get(k) === v);
    if (!same) fail(`alternates of ${href} differ from those of ${loc}`);
  }
}
if (withAlternates) console.log(`hreflang: ${[...langs].map(([k, v]) => `${k} ${v}`).join(", ")}`);

if (flag("fetch")) {
  const list = [...urls.keys()];
  const concurrency = Number(opt("concurrency", 6));
  let next = 0;
  let ok = 0;
  const statuses = new Map();
  async function worker() {
    while (next < list.length) {
      const u = list[next++];
      try {
        let r = await fetch(u, { headers: { "User-Agent": UA }, redirect: "manual" });
        if (r.status !== 200) {
          // CDNs occasionally answer a 3xx/5xx once under load: retry before reporting it.
          const first = `${r.status}${r.headers.get("location") ? ` → ${r.headers.get("location")}` : ""}`;
          await r.body?.cancel();
          await new Promise((res) => setTimeout(res, 1500));
          r = await fetch(u, { headers: { "User-Agent": UA }, redirect: "manual" });
          if (r.status === 200) warn(`${u}: transient HTTP ${first} on the first try, 200 on retry`);
        }
        statuses.set(r.status, (statuses.get(r.status) ?? 0) + 1);
        if (r.status !== 200) {
          fail(`${u}: HTTP ${r.status}${r.headers.get("location") ? ` → ${r.headers.get("location")}` : ""}`);
          await r.body?.cancel();
          continue;
        }
        if (flag("canonical")) {
          const html = await r.text();
          const tag = html.match(/<link[^>]+rel=["']canonical["'][^>]*>/i)?.[0];
          const href = tag ? attr(tag, "href") : null;
          // Compare normalized URLs: "https://example.com" and "https://example.com/" are the same address.
          const same = (a, b) => {
            try {
              return new URL(a, u).href === new URL(b).href;
            } catch {
              return false;
            }
          };
          if (!href) warn(`${u}: no canonical link`);
          else if (!same(href, u)) fail(`${u}: canonical is ${href}`);
          const robots = html.match(/<meta[^>]+name=["']robots["'][^>]*>/i)?.[0];
          if (robots && /noindex/i.test(attr(robots, "content"))) fail(`${u}: noindex page in the sitemap`);
        } else await r.body?.cancel();
        ok++;
      } catch (e) {
        fail(`${u}: ${e.cause?.code ?? e.message}`);
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  console.log(`fetched ${list.length}: ${[...statuses].map(([s, n]) => `${n}× ${s}`).join(", ")}; ${ok} OK`);
  if (warnings.some((w) => /transient HTTP/.test(w))) console.log("Note: transient non-200 answers come from the host/CDN; if they recur, check its logs and Search Console's crawl stats.");
}

for (const w of warnings.slice(0, 30)) console.log(`WARN ${w}`);
if (warnings.length > 30) console.log(`… ${warnings.length - 30} more warnings`);
for (const e of errors.slice(0, 50)) console.log(`FAIL ${e}`);
if (errors.length > 50) console.log(`… ${errors.length - 50} more failures`);
console.log(errors.length ? `\n${errors.length} problem(s)` : `\nOK: ${urls.size} URLs, no problems${warnings.length ? ` (${warnings.length} warnings)` : ""}`);
// exitCode instead of process.exit(): forcing exit while sockets close can crash Node on Windows.
process.exitCode = errors.length ? 1 : 0;
