// Unit tests for the pure functions of the skill's scripts and the zip builder. Node 18+, no
// dependencies: node tests/unit.test.mjs (exit code 1 on failure).

import assert from "node:assert/strict";
import { parseRobots, rulesFor, isAllowed, inspectHtml, serverTextWords, attr, decode, AGENTS } from "../skills/seo-geo-aeo/scripts/check_ai_access.mjs";
import { crc32, listZip } from "../scripts/build-zip.mjs";

let passed = 0;
const failed = [];
const pending = [];
function test(name, fn) {
  pending.push(
    (async () => {
      try {
        await fn();
        passed++;
      } catch (e) {
        failed.push(`${name}: ${e.message}`);
      }
    })(),
  );
}
const allowed = (robots, agent, path) => isAllowed(rulesFor(parseRobots(robots), agent).rules, path).allowed;

/* robots.txt (RFC 9309) */

test("a named group replaces the * group entirely", () => {
  const r = "User-agent: *\nDisallow: /private/\n\nUser-agent: GPTBot\nDisallow: /\n";
  assert.equal(allowed(r, "GPTBot", "/"), false);
  assert.equal(allowed(r, "OAI-SearchBot", "/"), true);
  assert.equal(allowed(r, "OAI-SearchBot", "/private/x"), false);
  assert.equal(rulesFor(parseRobots(r), "GPTBot").group, "GPTBot");
  assert.equal(rulesFor(parseRobots(r), "ClaudeBot").group, "*");
});

test("a named group with an empty Disallow allows everything, even when * blocks", () => {
  const r = "User-agent: *\nDisallow: /\n\nUser-agent: OAI-SearchBot\nDisallow:\n";
  assert.equal(allowed(r, "OAI-SearchBot", "/anything"), true);
  assert.equal(allowed(r, "GPTBot", "/anything"), false);
});

test("several user-agent lines share one group", () => {
  const r = "User-agent: OAI-SearchBot\nUser-agent: PerplexityBot\nDisallow: /a/\n";
  assert.equal(allowed(r, "OAI-SearchBot", "/a/x"), false);
  assert.equal(allowed(r, "PerplexityBot", "/a/x"), false);
  assert.equal(allowed(r, "ClaudeBot", "/a/x"), true);
});

test("separate groups for the same agent are combined", () => {
  const r = "User-agent: GPTBot\nDisallow: /a/\n\nUser-agent: GPTBot\nDisallow: /b/\n";
  assert.equal(allowed(r, "GPTBot", "/a/1"), false);
  assert.equal(allowed(r, "GPTBot", "/b/1"), false);
  assert.equal(allowed(r, "GPTBot", "/c/1"), true);
});

test("user-agent matching is case-insensitive and ignores a version", () => {
  const r = "User-agent: gptbot/1.4\nDisallow: /\n";
  assert.equal(allowed(r, "GPTBot", "/x"), false);
});

test("the longest match wins; Allow wins a tie", () => {
  const r = "User-agent: *\nDisallow: /folder/\nAllow: /folder/public\nDisallow: /page\nAllow: /page\n";
  assert.equal(allowed(r, "Googlebot", "/folder/public/x"), true);
  assert.equal(allowed(r, "Googlebot", "/folder/secret"), false);
  assert.equal(allowed(r, "Googlebot", "/page"), true);
});

test("* wildcards and the $ end anchor", () => {
  const r = "User-agent: *\nDisallow: /*.pdf$\nDisallow: /*?sort=\n";
  assert.equal(allowed(r, "Bingbot", "/docs/a.pdf"), false);
  assert.equal(allowed(r, "Bingbot", "/docs/a.pdf?x=1"), true);
  assert.equal(allowed(r, "Bingbot", "/list?sort=asc"), false);
  assert.equal(allowed(r, "Bingbot", "/list?page=2"), true);
});

test("comments, CRLF, BOM, rules before any user-agent, sitemaps", () => {
  const r = "﻿Disallow: /ignored\r\n# comment\r\nUser-agent: * # everyone\r\nDisallow: /x/ # private\r\nSitemap: https://example.com/sitemap.xml\r\n";
  const p = parseRobots(r);
  assert.equal(p.groups.length, 1);
  assert.deepEqual(p.sitemaps, ["https://example.com/sitemap.xml"]);
  assert.equal(allowed(r, "Googlebot", "/ignored"), true);
  assert.equal(allowed(r, "Googlebot", "/x/1"), false);
});

test("no matching group and no * group: everything allowed; /robots.txt always allowed", () => {
  const r = "User-agent: GPTBot\nDisallow: /\n";
  assert.equal(allowed(r, "ClaudeBot", "/x"), true);
  assert.equal(allowed(r, "GPTBot", "/robots.txt"), true);
});

test("the template robots.txt allows search and user agents and keeps /admin/ private", async () => {
  const { readFileSync } = await import("node:fs");
  const r = readFileSync(new URL("../skills/seo-geo-aeo/templates/robots.txt", import.meta.url), "utf8");
  for (const a of AGENTS) {
    assert.equal(allowed(r, a.token, "/"), true, `${a.token} on /`);
    assert.equal(allowed(r, a.token, "/admin/x"), false, `${a.token} on /admin/x`);
  }
  assert.deepEqual(parseRobots(r).sitemaps, ["https://example.com/sitemap.xml"]);
});

/* HTML inspection */

test("inspectHtml reads title, description, robots, canonical, h1, JSON-LD", () => {
  const html = `<!doctype html><html lang="it"><head><title>Unire PDF &amp; altro</title>
<meta name="description" content="Unisci PDF nel browser.">
<meta name="robots" content="noindex, follow">
<link rel="canonical" href="https://example.com/it/unire-pdf">
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Organization","sameAs":["https://www.wikidata.org/wiki/Q1"]},{"@type":"WebPage"}]}</script>
<script type="application/ld+json">{ broken </script>
</head><body><h1>Unire PDF</h1><h1>Due</h1><script>var hidden = "parole nascoste";</script><p>Uno due tre.</p></body></html>`;
  const h = inspectHtml(html);
  assert.equal(h.lang, "it");
  assert.equal(h.title, "Unire PDF & altro");
  assert.equal(h.description, "Unisci PDF nel browser.");
  assert.match(h.robots, /noindex/);
  assert.equal(h.canonical, "https://example.com/it/unire-pdf");
  assert.equal(h.h1, 2);
  assert.equal(h.jsonld.length, 2);
  assert.deepEqual(h.jsonld[0].types, ["Organization", "WebPage"]);
  assert.equal(h.jsonld[0].sameAs, true);
  assert.equal(h.jsonld[1].ok, false);
  assert.equal(h.words, 9); // title 3 + h1 2 + h1 1 + p 3; scripts and JSON-LD not counted
});

test("inspectHtml reads unquoted attributes (minified HTML)", () => {
  const h = inspectHtml("<html lang=fr><head><meta name=robots content=noindex><meta name=description content=Courte><link rel=canonical href=https://example.com/x></head><body><h1>x</h1></body></html>");
  assert.equal(h.lang, "fr");
  assert.equal(h.robots, "noindex");
  assert.equal(h.description, "Courte");
  assert.equal(h.canonical, "https://example.com/x");
});

test("attr ignores look-alike attribute names; decode handles hex references without double decoding", () => {
  assert.equal(attr('<meta data-name="x" name="robots">', "name"), "robots");
  assert.equal(decode("l&#x27;outil &#39;a&#39; &amp;#39; &copy;"), "l'outil 'a' &#39; &copy;");
});

test("serverTextWords skips scripts, styles and comments", () => {
  assert.equal(serverTextWords("<p>one two</p><script>three four</script><style>p{}</style><!-- five --> six"), 3);
  assert.equal(serverTextWords("<div id=app></div>"), 0);
});

/* zip */

test("crc32 of a known string", () => {
  assert.equal(crc32(Buffer.from("123456789")), 0xcbf43926);
});

test("listZip rejects a file that is not a zip", () => {
  assert.throws(() => listZip(Buffer.from("not a zip at all, definitely not")), /not a zip/);
});

await Promise.all(pending);
console.log(`unit: ${passed} passed${failed.length ? `, ${failed.length} failed` : ""}`);
for (const f of failed) console.log(`FAIL ${f}`);
process.exitCode = failed.length ? 1 : 0;
