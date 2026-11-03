# Search engines after launch: Search Console, Bing, IndexNow, links

A new site is limited more by discovery and links than by markup. Do these once the site is live and the production checks pass.

## Google Search Console

1. Verify the **domain property** (DNS record), so every protocol and subdomain is covered.
2. Submit the sitemap (`Sitemaps` → `https://example.com/sitemap.xml`).
3. **URL Inspection → Request indexing** for the most important URLs: the home in every language and the top pages (about 10 a day; the sitemap covers the rest).
4. After 3–7 days, read the **Pages** report and the help text of each exclusion reason ("Discovered – currently not indexed", "Crawled – currently not indexed", "Duplicate without user-selected canonical"; "Alternate page with proper canonical" is fine for language or parameter variants). Fix causes, not symptoms: internal links, canonicals, thin or duplicate pages, server errors.
5. **Enhancements** (structured data) and **Core Web Vitals**: fix errors; field data appears only with enough traffic.
6. Performance: AI Overviews and AI Mode are counted under the "Web" search type; use the Generative AI performance report for AI features (`references/measurement.md`).
7. Don't mass-request indexing or resubmit the sitemap daily; it is re-read on its own.

## Bing Webmaster Tools

1. Import the site from Search Console (the quickest verification) or verify it directly.
2. Submit the sitemap; check Site Explorer and URL Inspection for crawl problems.
3. **AI Performance**: citations in Copilot, Bing AI summaries and select partners, with grounding queries and cited pages (`references/measurement.md`).
4. Bing's AI Performance report covers Copilot answers, and Bing's guidance for AI citations recommends IndexNow and fresh content; OpenAI's help says ChatGPT search sometimes partners with other search providers. Treat Bing as a first-class engine, not an afterthought.

## IndexNow

IndexNow tells participating engines that URLs were added, updated or deleted; a URL submitted to one is shared with the others. Participants listed on indexnow.org (checked 2026-11-03): Microsoft Bing, Naver, Seznam.cz, Yandex, Yep, and Amazon has an endpoint. Google is not in that list.

1. **Key**: 8–128 characters (`a-z`, `A-Z`, `0-9`, `-`). Host it as `https://example.com/<key>.txt` containing the key (UTF-8). A key file elsewhere on the host needs `keyLocation` and only validates URLs under its path.
2. **One URL**: `GET https://api.indexnow.org/indexnow?url=<url-encoded URL>&key=<key>` (or an engine's own endpoint, such as `https://www.bing.com/indexnow`).
3. **Many URLs** (up to 10,000 per request):
   ```bash
   curl -X POST https://api.indexnow.org/indexnow -H "Content-Type: application/json; charset=utf-8" \
     -d '{"host":"example.com","key":"<key>","keyLocation":"https://example.com/<key>.txt","urlList":["https://example.com/a","https://example.com/b"]}'
   ```
4. **Responses**: 200 submitted; 202 received, key validation pending; 400 bad format; 403 key not valid; 422 URLs not on the host or key mismatch; 429 too many requests.
5. Ping from the deploy workflow with the URLs that changed in that release (new pages, changed content, removed pages), not the whole sitemap every time.

## First links and mentions

- Directories that matter in the niche (for software: AlternativeTo, Product Hunt, relevant "awesome" lists), a public repository or documentation, honest comparison pages (`references/geo-aeo.md`).
- Profiles that identify the organization (and appear in `sameAs`): Wikidata if the entity meets its notability policy, official social accounts, GitHub.
- Earn mentions with something useful (a tool, data, a guide); don't buy links or fake mentions (Google's spam policies; Google's AI guide also says inauthentic mentions don't help).

## Before and after: a short log

Write down, with dates: when each property was verified, sitemaps submitted, URLs requested, IndexNow set up, the Pages report reasons and what was fixed. Search work is slow; the log shows what changed when.
