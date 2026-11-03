# Measuring search and AI visibility

What to measure, where the numbers come from, and a repeatable citation check. Each source sees only part of the picture; write down which one a number comes from.

## Search engine reports

- **Google Search Console**: AI Overviews and AI Mode traffic is counted in the Performance report under the "Web" search type, and Google's AI optimization guide points to a **Generative AI performance report** for visibility in generative AI features (menu names change; check the current Search Console help). Also: Pages (indexing), URL Inspection, Enhancements, Core Web Vitals.
- **Bing Webmaster Tools → AI Performance** (public preview since 2026-02-10): total citations, average cited pages per day, grounding queries (a sample), citations per page and trends, across Copilot, AI summaries in Bing and select partners. It counts citations, not clicks or position in the answer.

## Referral traffic from assistants

1. **Referrer domains.** Classify entry visits whose referrer is an assistant as "AI": for example `chatgpt.com`, `perplexity.ai`, `claude.ai`, `gemini.google.com`, `copilot.microsoft.com` (the list a production site used in 2026; assistants add and change domains, so keep it in one place and review it).
2. **UTM tags.** OpenAI's publisher FAQ said ChatGPT adds `utm_source=chatgpt.com` to referral links (the FAQ's address redirected elsewhere on 2026-11-03; step 3 confirms it on your site). Count a `utm_source` that is an assistant's domain as AI, not as a marketing campaign.
3. **Don't assume every AI visit carries a referrer.** Test it: in each assistant's web app and mobile app, click a citation to your site and look at what your analytics and access logs record (referrer, UTM, user agent). Write down the result with the date; visits that arrive without either look like direct traffic.
4. **Landing pages.** Note which pages AI visitors land on: they show which answers cite you.

Without cookies or third-party analytics: `references/privacy-first-analytics.md`.

## Crawler logs

Requests per crawler token, verified against the vendors' IP ranges, with status codes: are search crawlers fetching the important pages, do user-initiated fetchers (`ChatGPT-User`, `Claude-User`, `Perplexity-User`) get 200, are any blocked by the CDN. Procedure in `references/ai-crawlers.md`.

## The citation check (monthly, repeatable)

Assistants' answers vary between runs and between users, so a single test proves little. A fixed question set run on a schedule shows trends and catches wrong statements about the site.

**Set up once** (`templates/citation-check.csv`):

- 20–50 questions people actually ask that the site should answer, in each language the site serves, written down once and kept fixed. Mix: brand ("what is <name>"), category ("best free tool to merge PDF without uploading"), task ("how do I remove EXIF data from a photo"), comparison ("<name> vs <competitor>"), problem ("why is my PDF too large to email").
- The assistants and modes to test, for example: ChatGPT with search, Perplexity, Gemini, Claude with web search, Microsoft Copilot, Google AI Mode / AI Overviews. Write down the plan or account type used.
- Conditions: a fresh conversation, no custom instructions or memory about the site, the same language and country each time, logged out where the product allows it.

**Each month:**

1. Ask every question in every assistant (twice if time allows, since answers vary) and record per run: date, assistant and mode, language, question, whether the site is **cited** (a link, which URL), **mentioned** (named without a link), competitors cited, and whether what the answer says about the site is **accurate**. Keep a link or screenshot of the answer.
2. Compare with previous months: questions gained or lost, wrong statements, which pages get cited.
3. For each wrong or missing answer, find the cause: is the page crawlable by that assistant's crawler, does it answer the question near the top, are the facts clear and sourced, does the cited source (yours or a third party's) say something outdated? Fix the page or ask the third party to correct theirs.
4. Retest those questions next month. Keep the question set fixed; add new questions as new rows, never edit old ones, so months stay comparable.

Report it as counts over a fixed set ("cited in 12 of 40 questions in ChatGPT search, up from 9"), never as a share of all AI answers, which nobody outside the vendors can measure.

## What not to report

- Visibility scores from third-party tools presented as Google or OpenAI data: Google's guide warns about tools that claim access to internal metrics.
- Percentages without a denominator, or numbers from a single run.
- "Ranking #1 in ChatGPT": answers are generated per conversation and have no stable rank.
