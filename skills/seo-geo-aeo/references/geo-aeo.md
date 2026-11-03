# GEO and AEO: being found, quoted and cited by answer engines

GEO (generative engine optimization) and AEO (answer engine optimization) mean making pages that AI assistants and AI search features retrieve, quote correctly and link to. Nobody outside the vendors knows their ranking systems, so this file contains only what the vendors document, what can be checked on the page, and how to measure the result. No invented statistics: if a claim can't be sourced or tested, it doesn't go in a page or a report.

## What the vendors say (checked 2026-11-03; links in `sources.md`)

- **Google**: from Google Search's perspective, optimizing for generative AI features (AI Overviews, AI Mode) is optimizing for search, and thus "still SEO". There are no extra requirements: the page must be indexed and eligible to show a snippet. Search doesn't use `llms.txt`, special markup or Markdown copies; content doesn't need to be split into chunks; structured data isn't required for AI features (it is for rich results). The most influential long-term factor named is original, non-commodity content with first-hand experience. Don't mass-produce pages for query variations (scaled content abuse) or chase inauthentic mentions. Snippet controls (`nosnippet`, `data-nosnippet`, `max-snippet`, `noindex`) also limit what AI features show.
- **Microsoft Bing**: the AI Performance report in Bing Webmaster Tools (public preview since 2026-02-10) counts citations of your pages in Copilot, AI summaries in Bing and select partners. Its guidance: keep content fresh and use IndexNow; clear headings, tables and FAQ sections; support claims with examples, data and cited sources; keep text, images and video consistent about the same entities; deepen coverage where you are already cited.
- **OpenAI**: pages appear in ChatGPT search when `OAI-SearchBot` may crawl them; `GPTBot` is the training crawler and a separate choice; `ChatGPT-User` fetches pages users ask for. OpenAI's help on searching the web says ChatGPT search "sometimes partners with other search providers". OpenAI's publisher FAQ said that ChatGPT adds `utm_source=chatgpt.com` to referral links; on 2026-11-03 that FAQ's address redirected to an unrelated article, so confirm the tag in your own analytics (`references/measurement.md`).
- **Anthropic**: `Claude-SearchBot` (search quality), `Claude-User` (fetches for users), `ClaudeBot` (training).
- **Perplexity**: `PerplexityBot` surfaces and links sites in Perplexity search and is not used for model training; `Perplexity-User` fetches for users and generally ignores robots.txt.

Consequences: (1) be crawlable and indexable by Google, Bing and each assistant's search crawler (`references/ai-crawlers.md`); (2) write pages that answer clearly with checkable facts (below); (3) make entities unambiguous; (4) measure citations and referrals and recheck monthly (`references/measurement.md`).

## Answer-first passages

Under the H1, and under each H2 that answers a question, put a short passage that answers on its own, then the details.

- **Length: about 40–60 words.** A working heuristic for a passage that can be quoted without its context; no vendor publishes an ideal length, and Google says pages don't need chunking. Write it for readers first.
- **Content**: what it is or the direct answer, the key number or condition, what makes this option different, and for a tool how to use it in one sentence.
- **Self-contained**: name the subject ("Merge PDF combines…"), not "it" or "this tool"; no "as mentioned above".
- **Question wording**: phrase H2s as the question people ask when it reads naturally ("How do I merge PDF files without uploading them?").
- **Test**: read the passage alone. Does it answer the question? Is every fact in it backed by the code, a measurement or a linked source? Is the same answer in every language version?

Example (tool page):

> **Merge PDF** combines several PDF files into one in the order you choose, directly in your browser: the files are never uploaded. Drop the files, drag them into order, optionally pick page ranges, and download the merged PDF. It works offline once the page has loaded.

Every clause there must be true for the real tool (offline use, for instance, must have been tested).

## Facts with sources and dates

- Every number, limit, price, speed, format list or compatibility claim comes from the code, a measurement (write the date and the test files) or a linked source with the date checked.
- Facts that change get "as of <date>" or "checked on <date>". When they change, update the page and its `dateModified`/`lastmod`.
- Cite primary sources (the vendor's docs, the standard, the study), not a blog that repeats them.
- Keep the same facts in every language; translations are reviewed, not machine-dumped.
- Never invent statistics, customer counts, quotes or benchmarks, and never present a heuristic as a measured result.

## Entities: say clearly who and what

Answer engines have to know which organization, product or person a page is about.

- Use one name and spelling for the organization and each product everywhere: pages, titles, structured data, profiles, directories.
- An About page with checkable facts: who runs the site, where, how to contact, since when.
- `Organization` JSON-LD on every page (`templates/structured-data.tool.json`, `templates/structured-data.guide.json`): `name`, `url`, `logo` and `sameAs`, which schema.org defines as the "URL of a reference Web page that unambiguously indicates the item's identity", for example the Wikidata item, the Wikipedia article, official profiles and the code repository. Link only profiles you control or that describe you accurately.
- **Wikidata**: if the organization or product meets Wikidata's notability policy and has an item, link it in `sameAs` and keep the item's official website accurate. Don't create promotional items; follow the policy.
- Authors: a `Person` with an author page and `sameAs` when guides carry a byline.
- Keep text, images and video about the same entities consistent (Bing's guidance).

## FAQ only when visible

- A visible FAQ section helps people and gives answer engines question–answer pairs; Bing's guidance names FAQ sections.
- Google stopped showing FAQ rich results on 2026-05-07 and removed their documentation on 2026-06-15. `FAQPage` markup no longer produces a Google rich result.
- If you keep `FAQPage` JSON-LD for other consumers, it must mirror questions and answers that are visible on the page: Google's structured data policies say not to mark up content that isn't visible to readers.
- Answers in FAQs follow the same rules as the rest of the page: short, direct, sourced.

## Comparison pages with honest facts

People ask assistants "X vs Y" and "alternatives to Y". A comparison page is useful only if it is fair.

- One page per real comparison, not generated pages for every pair (Google's scaled content abuse policy).
- The same criteria for every product, in an HTML table (not an image).
- Facts about other products come from their public docs or pricing pages, linked, with the date checked. Say where the other product is better.
- Benchmarks only with a published, reproducible method (files, settings, hardware, date).
- No fake reviews or testimonials; no claims you can't support.
- Recheck the facts when the products change and update the date.

## Freshness

- Update a page when its facts change; show "Updated <date>" only for real content changes.
- `dateModified` in Article JSON-LD and `lastmod` in the sitemap follow content changes, never deploys.
- Notify Bing and the other IndexNow engines when pages are added, changed or removed (`references/search-engines-and-indexing.md`).
- Don't bump dates without changes.

## Crawlable text, not only JavaScript

- The main answer, headings, internal links and JSON-LD should be in the HTML the server sends (server-side rendering or static generation). Google renders JavaScript (see its JavaScript SEO basics). The crawler pages of OpenAI, Anthropic and Perplexity (checked 2026-11-03) don't say whether their crawlers run JavaScript, so don't depend on it.
- Links are `<a href>` elements, not click handlers. Tables are HTML tables. Images have `alt`; videos have transcripts or a text summary.
- Don't block the CSS and JavaScript Googlebot needs to render the page.
- Test: `node scripts/check_ai_access.mjs <url> --paths ...` reports the words of text in the server HTML; compare with what the page shows. Or `curl -s <url>` and read it.

## What not to do

- Mass-produce pages for query variations, or rewrite content "for AI" instead of for readers.
- Show crawlers different content from users (cloaking, against Google's spam policies), including hidden text aimed at language models.
- Publish an `llms.txt` or `agents.md` that says something the pages don't.
- Buy or fake mentions, reviews or citations.
- Invent numbers or present heuristics as measurements.

## Page checklist

- [ ] Indexable: 200, canonical to itself, no `noindex`/`nosnippet` by accident, allowed for the crawlers the owner chose.
- [ ] One `h1`; title and meta description in the page's language; answer-first passage under the `h1`.
- [ ] Facts sourced or measured, with dates; same facts in every language.
- [ ] Main content, links and JSON-LD in the server HTML.
- [ ] JSON-LD valid (Rich Results Test, Schema.org validator); `Organization` with `sameAs`; FAQ markup only for visible FAQs.
- [ ] Internal links: related pages, category, guides that link to the page they describe.
- [ ] In the sitemap with hreflang; `lastmod` only from real changes; IndexNow ping on change.
- [ ] Added to the citation check questions if it answers a question people ask (`references/measurement.md`).
