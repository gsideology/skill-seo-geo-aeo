# SEO foundations

Goal: every public page has one canonical URL, is listed in the sitemap with its language versions, is crawlable, describes itself with structured data, and loads fast. Generate everything from the registry.

## URLs and canonical

- Pick one form and stick to it: `https://example.com/page` (no trailing slash) or with slash. Redirect the other form with 301 (careful not to create an open redirect for `//host/` paths).
- Default language at the root, other languages under a prefix: `/it/...`, `/es/...`. Localized slugs are fine (`/it/unire-pdf`) but **never change a published slug**; keep a slug map per language and validate it at build (unique, `[a-z0-9-]`, no clash with fixed pages such as `/about`, `/privacy`, `/blog`).
- Every page: `<link rel="canonical" href="absolute URL of itself">` and `<link rel="alternate" hreflang="xx" href="…">` for each existing language version plus `x-default` (usually the default-language URL). A page that exists only in some languages lists only those.
- Pages scheduled for later must not exist at all before their date (no HTML, no sitemap entry, no index entry); a daily build publishes them.

## Sitemap

- `/sitemap.xml`, generated at build, referenced from `robots.txt` (`Sitemap: https://example.com/sitemap.xml`).
- `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">`; optional `xmlns:image`.
- One `<url>` per language version; each lists **all** its versions with `<xhtml:link rel="alternate" hreflang="…" href="…"/>`, **including itself**, plus `x-default`. The set must be identical (reciprocal) on every version.
- Absolute URLs, same origin, no duplicates, ≤ 50,000 URLs and ≤ 50 MB per file (otherwise a sitemap index).
- `lastmod` only when you really know it (content date), in W3C format; `changefreq`/`priority` are optional and largely ignored.
- Verify with `scripts/check_sitemap.mjs --fetch --canonical`: every URL must answer 200 (no redirect) and its canonical must equal the `<loc>`.

## robots.txt

```
User-Agent: *
Allow: /
Disallow: /internal-path/

Sitemap: https://example.com/sitemap.xml
```

Disallow only what must not be crawled (admin, counters). A crawler with its own `User-agent` group ignores the `*` group, so repeat shared rules in every named group. Which AI crawlers to allow (search, user-initiated, training), how to check that the host/CDN doesn't block them, and how to verify real crawlers: `references/ai-crawlers.md` and `templates/robots.txt`.

## Titles, descriptions, headings

- `<title>`: `Tool name: short value | Site` in the page's language, ≤ 60 characters where possible. Check grammar per language with real names (e.g. a French template "X gratuit" breaks with verbs and feminine nouns; "X : outil gratuit" works for any name). Test the template against every name, not one.
- Meta description: unique, in the page's language, saying what the page does; about 120–160 characters is a common target (Google sets no limit, truncates as needed and may write its own snippet).
- One `h1`, matching the title's intent.
- A short direct answer near the top (about 40–60 words: what it is, how to use it, what makes it different) serves readers and answer engines alike: `references/geo-aeo.md`.

## Structured data (JSON-LD)

One `@graph` per page, with stable `@id`s (`templates/structured-data.tool.json`, `templates/structured-data.guide.json`):

- `Organization` (name, url, logo, `sameAs` to the profiles that identify it: Wikidata, Wikipedia, official accounts, repository) and `WebSite` (with `inLanguage`) on every page.
- `WebPage` (or `AboutPage`, `CollectionPage`) with `breadcrumb` → `BreadcrumbList`.
- Tool pages: `WebApplication`/`SoftwareApplication` with `applicationCategory`, `operatingSystem: "Any"` (browser), `offers` price 0, `isAccessibleForFree`.
- Guides: `BlogPosting`/`Article` with author, `datePublished`, and `dateModified` that changes only when content changes.
- Mark up only what is visible on the page (Google's structured data policies). FAQ: Google no longer shows FAQ rich results (since 2026-05-07); keep `FAQPage` only if it mirrors a visible FAQ and you have another consumer for it.
- Structured data isn't required for Google's AI features, but it is for rich results and it states entities unambiguously.
- Validate with the Rich Results Test and the Schema.org validator; `scripts/check_ai_access.mjs` flags JSON-LD that isn't valid JSON.

## Content rules that also help agents

- Facts on the page (formats, limits, sizes, speeds) come from the code or from measurements with real files; write the date and the test files.
- Keep the same facts in every language; translations are reviewed, not machine-dumped.
- Internal links: related tools, category pages, guides linking to the tool they describe.
- More on writing for answer engines (facts with sources, entities, comparison pages, freshness, text in the server HTML): `references/geo-aeo.md`.

## 404, errors, headers

- A real 404 page with links to the language homes, `noindex`, HTTP status 404.
- Security headers (all compatible with crawlers): `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: SAMEORIGIN`, a minimal enforced CSP (`object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'`) and a full CSP in report-only mode until every page has been checked.
- Cache: HTML revalidated on each request (`max-age=0, must-revalidate`), hashed assets long-lived.
- Never serve dotfiles except `/.well-known/`.

## Performance

- Lighthouse/PageSpeed: aim for 90+ on mobile and desktop; fix LCP (hero image size, fonts with `font-display: swap`, preloaded critical assets), CLS (reserved sizes), INP (no long tasks on input).
- Load heavy code only where needed (dynamic imports per tool), keep fonts self-hosted, no third-party scripts unless needed.

## After launch

Search Console, Bing Webmaster Tools, IndexNow and first links: `references/search-engines-and-indexing.md`. Lighthouse's Agentic Browsing audits: `references/testing-and-verification.md`.
