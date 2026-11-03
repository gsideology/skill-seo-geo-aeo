#!/usr/bin/env node
// Checks whether search engines, AI answer engines and AI agents can reach and read a site:
// robots.txt rules per crawler (RFC 9309 matching), Sitemap lines, llms.txt, and for each page the
// HTTP status, noindex/nosnippet, canonical, title/description/h1, JSON-LD and how much text is in the
// server HTML (what a crawler that doesn't run JavaScript gets). Node 18+, no dependencies.
//
//   node check_ai_access.mjs <site URL> [--paths /,/pricing] [--require-allow LIST|none] [--probe-ua] [--min-words 100]
//
//   --paths          pages to check, comma-separated: "/pricing", "pricing", "." for the home, or full URLs
//                    (default: the URL's own path; in Git Bash prefer the forms without a leading slash)
//   --require-allow  crawlers that must be allowed on every checked path (default: the search crawlers
//                    and user-initiated fetchers in the table below; training crawlers are reported only)
//   --probe-ua       also request each page with each crawler's user agent. Informational only: CDNs and
//                    hosts often block a spoofed crawler user agent from a non-crawler IP (anti-spoofing),
//                    so a 403 here does not prove the real crawler is blocked, nor a 200 that it is allowed
//   --min-words      warn when the server HTML has fewer words of text than this (heuristic, default 100)
// Exit code 1 when something fails. The crawler table was checked against the vendors' pages on
// 2026-11-03 (see references/ai-crawlers.md); re-check it before relying on it.

import { pathToFileURL } from "node:url";

/** Product tokens, purpose and documented user-agent strings (generic form where none is documented). */
export const AGENTS = [
  { token: "Googlebot", vendor: "Google", kind: "search", purpose: "Google Search, including AI Overviews and AI Mode", ua: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" },
  { token: "Google-Extended", vendor: "Google", kind: "training", purpose: "robots.txt token only: Gemini training and grounding outside Search; no effect on Search", ua: null },
  { token: "Bingbot", vendor: "Microsoft", kind: "search", purpose: "Bing search; Bing's AI Performance report counts citations in Copilot and Bing AI answers", ua: "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)" },
  { token: "OAI-SearchBot", vendor: "OpenAI", kind: "search", purpose: "ChatGPT search results", ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36; compatible; OAI-SearchBot/1.4; +https://openai.com/searchbot" },
  { token: "ChatGPT-User", vendor: "OpenAI", kind: "user", purpose: "pages a ChatGPT user asks for (robots.txt may not apply)", ua: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot" },
  { token: "GPTBot", vendor: "OpenAI", kind: "training", purpose: "content that may be used to train OpenAI models", ua: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.4; +https://openai.com/gptbot" },
  { token: "Claude-SearchBot", vendor: "Anthropic", kind: "search", purpose: "search result quality for Claude", ua: null },
  { token: "Claude-User", vendor: "Anthropic", kind: "user", purpose: "pages a Claude user asks for", ua: null },
  { token: "ClaudeBot", vendor: "Anthropic", kind: "training", purpose: "content that may be used to train Anthropic models", ua: null },
  { token: "PerplexityBot", vendor: "Perplexity", kind: "search", purpose: "Perplexity search results (not used for model training)", ua: "Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)" },
  { token: "Perplexity-User", vendor: "Perplexity", kind: "user", purpose: "pages a Perplexity user asks for (generally ignores robots.txt)", ua: "Mozilla/5.0 (compatible; Perplexity-User/1.0; +https://perplexity.ai/perplexity-user)" },
];

/* ------------------------------------------------------------------ robots.txt (RFC 9309) */

/** Parses robots.txt into groups [{ agents: [lowercase tokens], rules: [{ allow, path }] }] and sitemaps. */
export function parseRobots(text) {
  const groups = [];
  const sitemaps = [];
  let current = null;
  let lastWasAgent = false;
  for (const raw of String(text).replace(/^﻿/, "").split(/\r\n|\r|\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const value = m[2].trim();
    if (key === "user-agent") {
      if (!current || !lastWasAgent) groups.push((current = { agents: [], rules: [] }));
      current.agents.push(value.split(/[\s/]/)[0].toLowerCase());
      lastWasAgent = true;
    } else if (key === "allow" || key === "disallow") {
      lastWasAgent = false;
      if (!current) continue; // rules before any user-agent line belong to no group
      if (value === "") continue; // "Disallow:" with no path allows everything; an empty Allow says nothing
      current.rules.push({ allow: key === "allow", path: value });
    } else if (key === "sitemap") {
      sitemaps.push(value);
    } else {
      lastWasAgent = false; // other records (crawl-delay…) keep the group's rules but end its run of user-agent lines
    }
  }
  return { groups, sitemaps };
}

/** The rules that apply to a product token: every group naming it, else every "*" group, else none. */
export function rulesFor(parsed, token) {
  const t = token.toLowerCase();
  const own = parsed.groups.filter((g) => g.agents.includes(t));
  const used = own.length ? own : parsed.groups.filter((g) => g.agents.includes("*"));
  return { group: own.length ? token : used.length ? "*" : "(none)", rules: used.flatMap((g) => g.rules) };
}

function patternToRegExp(path) {
  const anchored = path.endsWith("$");
  const body = (anchored ? path.slice(0, -1) : path).split("*").map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*");
  return new RegExp(`^${body}${anchored ? "$" : ""}`);
}

/** Longest matching rule wins; on a tie Allow wins (RFC 9309 2.2.2). /robots.txt is always allowed. */
export function isAllowed(rules, pathAndQuery) {
  if (pathAndQuery === "/robots.txt") return { allowed: true, rule: null };
  let best = null;
  for (const r of rules) {
    if (!patternToRegExp(r.path).test(pathAndQuery)) continue;
    if (!best || r.path.length > best.path.length || (r.path.length === best.path.length && r.allow && !best.allow)) best = r;
  }
  return { allowed: best ? best.allow : true, rule: best };
}

/* ------------------------------------------------------------------ HTML helpers */

const decode = (s) => s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
const attr = (tag, name) => decode(tag.match(new RegExp(`\\s${name}\\s*=\\s*"([^"]*)"`, "i"))?.[1] ?? tag.match(new RegExp(`\\s${name}\\s*=\\s*'([^']*)'`, "i"))?.[1] ?? "");

/** Words of text in the HTML as served, without scripts, styles and templates. */
export function serverTextWords(html) {
  const text = decode(
    html
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<(script|style|template|svg)\b[\s\S]*?<\/\1>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  );
  return text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

export function inspectHtml(html) {
  const metas = [...html.matchAll(/<meta\b[^>]*>/gi)].map((m) => m[0]);
  const meta = (name) => metas.filter((t) => attr(t, "name").toLowerCase() === name).map((t) => attr(t, "content"));
  const canonical = [...html.matchAll(/<link\b[^>]*>/gi)].map((m) => m[0]).find((t) => /(^|\s)canonical(\s|$)/i.test(attr(t, "rel")));
  const jsonld = [...html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map((m) => {
    try {
      const data = JSON.parse(m[1]);
      const nodes = [data, ...(Array.isArray(data) ? data : []), ...(data?.["@graph"] ?? [])].filter((n) => n && typeof n === "object" && !Array.isArray(n));
      return { ok: true, types: [...new Set(nodes.flatMap((n) => [].concat(n["@type"] ?? [])))], sameAs: nodes.some((n) => n.sameAs) };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });
  return {
    lang: attr(html.match(/<html\b[^>]*>/i)?.[0] ?? "", "lang"),
    title: decode(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").trim(),
    description: meta("description")[0] ?? null,
    robots: [...meta("robots"), ...meta("googlebot")].join(", "),
    canonical: canonical ? attr(canonical, "href") : null,
    h1: (html.match(/<h1\b/gi) ?? []).length,
    words: serverTextWords(html),
    jsonld,
  };
}

/* ------------------------------------------------------------------ CLI */

async function main() {
  const args = process.argv.slice(2);
  const site = args.find((a) => /^https?:\/\//.test(a));
  const opt = (n, d) => {
    const i = args.indexOf(`--${n}`);
    return i >= 0 ? args[i + 1] : d;
  };
  const flag = (n) => args.includes(`--${n}`);
  if (!site) {
    console.error("Usage: node check_ai_access.mjs <site URL> [--paths /,/pricing] [--require-allow LIST|none] [--probe-ua] [--min-words 100]");
    process.exit(2);
  }
  const base = new URL(site);
  const rawPaths = (opt("paths") ?? `${base.pathname}${base.search}`).split(",").map((p) => p.trim()).filter(Boolean);
  // Git Bash rewrites arguments that start with "/" into Windows paths ("/" → "C:/Program Files/Git/").
  const mangled = rawPaths.find((p) => /^[A-Za-z]:[\\/]/.test(p));
  if (mangled) {
    console.error(`"${mangled}" looks like a path rewritten by the shell. Write paths without the leading slash ("merge-pdf", "." for the home), as full URLs, or run with MSYS_NO_PATHCONV=1.`);
    process.exit(2);
  }
  // Accept "/page", "page", "." (the home) and full URLs; compare robots rules on path + query.
  const paths = rawPaths.map((p) => {
    const u = new URL(p === "." ? "/" : /^https?:\/\//.test(p) || p.startsWith("/") ? p : `/${p}`, base.origin);
    return `${u.pathname}${u.search}`;
  });
  const requireOpt = opt("require-allow");
  const required = requireOpt === "none" ? [] : requireOpt ? requireOpt.split(",").map((s) => s.trim()) : AGENTS.filter((a) => a.kind !== "training").map((a) => a.token);
  const minWords = Number(opt("min-words", 100));
  const UA = "Mozilla/5.0 (compatible; seo-geo-aeo-check/1.0)";
  const results = [];
  const say = (status, msg) => {
    results.push(status);
    console.log(`${status.padEnd(4)} ${msg}`);
  };
  const get = (url, ua = UA) => fetch(url, { headers: { "User-Agent": ua, Accept: "text/html,text/plain,*/*" }, redirect: "manual", signal: AbortSignal.timeout(20_000) });

  // robots.txt
  console.log(`\n== robots.txt (${base.origin}/robots.txt)`);
  let parsed = { groups: [], sitemaps: [] };
  let robotsOk = true;
  try {
    const r = await get(`${base.origin}/robots.txt`);
    if (r.status === 200) {
      parsed = parseRobots(await r.text());
      say("PASS", `HTTP 200, ${parsed.groups.length} group(s)`);
    } else if (r.status >= 400 && r.status < 500) {
      await r.body?.cancel();
      say("WARN", `HTTP ${r.status}: under RFC 9309 crawlers may then crawl everything; publish one with a Sitemap line`);
    } else {
      await r.body?.cancel();
      robotsOk = false;
      say("FAIL", `HTTP ${r.status}${r.headers.get("location") ? ` → ${r.headers.get("location")}` : ""}: a 5xx or unreachable robots.txt makes RFC 9309 crawlers assume everything is disallowed; redirects should end at a 200`);
    }
  } catch (e) {
    robotsOk = false;
    say("FAIL", `cannot fetch: ${e.cause?.code ?? e.message}`);
  }
  if (robotsOk) {
    if (parsed.sitemaps.length) say("PASS", `Sitemap: ${parsed.sitemaps.join(", ")}`);
    else say("WARN", "no Sitemap line");
    for (const a of AGENTS) {
      const { group, rules } = rulesFor(parsed, a.token);
      const verdicts = paths.map((p) => ({ p, ...isAllowed(rules, p) }));
      const blocked = verdicts.filter((v) => !v.allowed);
      const detail = `${a.token} [${a.kind}, group ${group}]: ${verdicts.map((v) => `${v.p} ${v.allowed ? "allowed" : `blocked by "${v.rule.allow ? "Allow" : "Disallow"}: ${v.rule.path}"`}`).join("; ")}`;
      if (!blocked.length) say("PASS", detail);
      else if (required.some((t) => t.toLowerCase() === a.token.toLowerCase())) say("FAIL", `${detail} (${a.purpose})`);
      else say("INFO", `${detail} (${a.purpose}; a deliberate choice for the owner)`);
    }
    for (const t of required) if (!AGENTS.some((a) => a.token.toLowerCase() === t.toLowerCase())) {
      const { group, rules } = rulesFor(parsed, t);
      const blocked = paths.filter((p) => !isAllowed(rules, p).allowed);
      say(blocked.length ? "FAIL" : "PASS", `${t} [group ${group}]: ${blocked.length ? `blocked on ${blocked.join(", ")}` : "allowed"}`);
    }
  }

  // llms.txt (optional; Google Search doesn't use it)
  console.log(`\n== llms.txt`);
  try {
    const r = await get(`${base.origin}/llms.txt`);
    if (r.status !== 200) {
      await r.body?.cancel();
      say("INFO", `HTTP ${r.status}: no llms.txt (optional; see references/llms-and-agents-md.md)`);
    } else {
      const text = await r.text();
      const first = text.split(/\r?\n/).find((l) => l.trim());
      if (!first?.startsWith("# ")) say("WARN", "the first line is not an H1 (\"# Site name\"), which llmstxt.org requires");
      else say("PASS", `H1 "${first.slice(2).trim()}", ${(text.match(/\[[^\]]+\]\([^)]+\)/g) ?? []).length} links, ${r.headers.get("content-type")}`);
      if (!/^>\s/m.test(text)) say("WARN", "no blockquote summary after the H1");
    }
  } catch (e) {
    say("WARN", `cannot fetch: ${e.cause?.code ?? e.message}`);
  }

  // Pages
  for (const p of paths) {
    const url = new URL(p, base.origin).href;
    console.log(`\n== ${url}`);
    let r;
    try {
      r = await get(url);
    } catch (e) {
      say("FAIL", `cannot fetch: ${e.cause?.code ?? e.message}`);
      continue;
    }
    if (r.status !== 200) {
      await r.body?.cancel();
      say(r.status >= 300 && r.status < 400 ? "WARN" : "FAIL", `HTTP ${r.status}${r.headers.get("location") ? ` → ${r.headers.get("location")}` : ""} (check the final URL instead)`);
      continue;
    }
    const xrt = r.headers.get("x-robots-tag") ?? "";
    const html = await r.text();
    const h = inspectHtml(html);
    const robots = `${xrt} ${h.robots}`.toLowerCase();
    say("PASS", `HTTP 200, ${r.headers.get("content-type")}, lang "${h.lang || "?"}"`);
    if (/noindex|(^|[\s,])none([\s,]|$)/.test(robots)) say("FAIL", `noindex (${[xrt && `X-Robots-Tag: ${xrt}`, h.robots && `meta: ${h.robots}`].filter(Boolean).join("; ")}): the page can't be indexed or cited from a search index`);
    else if (/nosnippet|max-snippet\s*:\s*0/.test(robots)) say("WARN", `nosnippet / max-snippet:0: Google shows a page in AI features only if it can show a snippet`);
    else say("PASS", "indexable (no noindex/nosnippet in X-Robots-Tag or meta robots)");
    if (!h.canonical) say("WARN", "no canonical link");
    else if (new URL(h.canonical, url).href !== url) say("WARN", `canonical points elsewhere: ${h.canonical}`);
    else say("PASS", "canonical is this URL");
    if (!h.title) say("WARN", "no <title>");
    if (!h.description) say("WARN", "no meta description");
    if (h.h1 !== 1) say("WARN", `${h.h1} <h1> elements in the server HTML (expected 1)`);
    if (h.title && h.description && h.h1 === 1) say("PASS", `title "${h.title.slice(0, 70)}", description ${h.description.length} chars, one h1`);
    if (h.words < minWords) say("WARN", `only ${h.words} words of text in the server HTML: crawlers that don't run JavaScript see little; put the main answer in the HTML (heuristic threshold ${minWords})`);
    else say("PASS", `${h.words} words of text in the server HTML`);
    if (!h.jsonld.length) say("INFO", "no JSON-LD");
    for (const j of h.jsonld) {
      if (!j.ok) say("FAIL", `invalid JSON-LD: ${j.error}`);
      else say("PASS", `JSON-LD: ${j.types.join(", ") || "(no @type)"}${j.sameAs ? ", with sameAs" : ""}`);
    }
    if (flag("probe-ua")) {
      for (const a of AGENTS.filter((x) => x.kind !== "training" || x.ua)) {
        const ua = a.ua ?? `Mozilla/5.0 (compatible; ${a.token}/1.0)`;
        try {
          const x = await get(url, ua);
          await x.body?.cancel();
          say("INFO", `as ${a.token}${a.ua ? "" : " (generic UA string)"}: HTTP ${x.status}${x.status === 200 ? "" : " — anti-spoofing or a bot rule; confirm in the host/CDN bot settings and the access logs"}`);
        } catch (e) {
          say("INFO", `as ${a.token}: ${e.cause?.code ?? e.message}`);
        }
      }
    }
  }

  const n = (s) => results.filter((x) => x === s).length;
  console.log(`\n${n("FAIL") ? `${n("FAIL")} FAILED` : "NO FAILURES"} · ${n("PASS")} passed · ${n("WARN")} warnings · ${n("INFO")} info`);
  // exitCode, not process.exit(): forcing exit while sockets close can crash Node on Windows.
  process.exitCode = n("FAIL") ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
