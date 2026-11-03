# Optional: privacy-first measurement

To learn which pages, tools and channels (search, AI assistants, MCP) work without cookies, consent banners or third-party analytics. A self-hosted counter: the browser sends short GET requests, the server adds them to daily totals in SQLite, a password-protected page shows them. What to measure for search and AI visibility in general (Search Console, Bing AI Performance, AI referrals, the citation check): `references/measurement.md`.

## Decide the privacy level first (with the owner)

| Level | What you get | What it costs |
|---|---|---|
| Totals only | Views, entries, sources, tools funnel, tech, performance, engagement buckets | Nothing personal is processed; easy to disclose |
| + unique visitors | Visitors, visits, bounce rate, pages per visit, duration | A daily fingerprint: `sha256(daily random salt + host + IP + user agent)`, never stored in clear; the salt is replaced every day so it can't be reversed or linked across days; session rows deleted the next day. Disclose it; legitimate interest |
| Third-party analytics | Everything | Consent banner, data sent to a third party, contradicts "no tracking" claims |

Countries without the IP: derive them from the browser's time zone (`Intl.DateTimeFormat().resolvedOptions().timeZone` → `DateTimeZone::getLocation()` in PHP, plus a table for legacy zone names).

## Events

Write a data contract (one table: event, when, parameters with formats) before coding, and give client and server to different people/agents only after it exists. Typical events:

- `view` (page, browser language, window class, screen width, time zone, theme, WebGPU; on the entry view the referring domain and `utm_*` tags; `i=1` for in-site navigation)
- `open` (a file opened in a tool — never its name or content), `dl` (a result downloaded, how many files), `err` (an error message shown — never its text), `jserr` (only the error type, deduplicated and capped)
- `aff` (partner link click, offer id), `leave` (seconds visible, max scroll %, once per view, with `fetch(..., { keepalive: true })`)
- `vital` (LCP, INP, CLS, FCP, TTFB via the framework's Web Vitals hook, once per metric and navigation), `nf` (404 path, sanitized)

Client rules: off in development and on localhost (except an explicit debug flag for tests), off with Global Privacy Control, Do Not Track, `navigator.webdriver` or an "exclude this browser" flag; load the vitals code only when enabled; never block the page.

Server rules: same-origin requests only (`Sec-Fetch-Site`), a bot user-agent filter, reply 204 before writing, never fail; validate every parameter; cap open-ended keys per day; classify sources (search engines, social, AI assistants such as chatgpt.com, perplexity.ai, claude.ai, gemini.google.com, copilot.microsoft.com, webmail, campaigns), and count a `utm_source` that is an assistant's domain (such as `utm_source=chatgpt.com`) as AI, not as a campaign; derive browser/OS family from the user agent; behind a CDN take the visitor IP from `X-Forwarded-For` (record which header was used, never the address, to verify after deploy).

## Dashboard

Periods and comparison with the previous period; KPI cards; a chart with a selectable metric; realtime (last 5 minutes); pages (views, entries, exits, time, scroll, 404s); tools funnel (views → files opened → downloads, errors, conversion); sources (categories, domains, AI assistants, UTM); audience (countries, languages); technology; weekday × hour heatmap; performance (good/needs improvement/poor and estimated p75); engagement; errors; partner clicks; MCP usage; CSV export; settings (exclude this browser, IP header in use, retention). Inline SVG, no external scripts, works on phones and in dark mode.

## Privacy policy

List exactly what is sent and derived, the fingerprint and its deletion, how long totals are kept, the legal basis, and that GPC/DNT disable it — in every language, and update it **before** collecting anything new.

## Test

Seed realistic traffic over many simulated days (with a fake clock for day changes and salt rotation), check every event lands in the right totals, then browse the built site behind a real web server with the debug flag and confirm the dashboard shows it.
