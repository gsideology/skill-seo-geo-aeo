# skill-seo-geo-aeo

This repository is one Claude skill, `seo-geo-aeo`: SEO, GEO, AEO and agentic navigation for websites, with a test → fix → retest loop and dependency-free check scripts. It is also a Claude Code plugin and a one-plugin marketplace. Read `README.md` for what it does and how people install it.

## Structure

```
.claude-plugin/plugin.json        plugin manifest (name seo-geo-aeo; bump "version" on every release)
.claude-plugin/marketplace.json   marketplace "skill-seo-geo-aeo" listing this repo as the plugin (source "./")
skills/seo-geo-aeo/               THE SKILL (this folder is what the zip and the plugin ship)
  SKILL.md                        frontmatter + workflow; links to everything else
  references/*.md                 one topic per file, linked from SKILL.md (one level deep)
  references/sources.md           every external source with the date it was checked
  templates/                      robots.txt, JSON-LD, citation check, MCP server (PHP), Server Card, AI Catalog, WebMCP…
  scripts/                        check_sitemap.mjs, check_ai_access.mjs, mcp_smoke_test.mjs (Node 18+, no deps)
scripts/build-zip.mjs             dist/seo-geo-aeo.zip for claude.ai (dist/ is ignored by git)
scripts/validate-skill.mjs        frontmatter, links, length, line endings
scripts/test.mjs                  the whole suite (offline; --online for a live site)
tests/unit.test.mjs               robots.txt matching, HTML inspection, zip
tests/fixtures/                   fixture site + MCP index served by `php -S` during the tests
```

## Rules

1. **Every claim is sourced or tested.** A statement about a vendor, a spec or a product behaviour needs an official source in `references/sources.md` with the date checked, or a test in this repo (or a dated observation, labelled as such). No invented statistics, quotes or benchmarks; a heuristic is called a heuristic. When a source can't be confirmed, leave the claim out or mark it "to verify".
2. **Scripts stay dependency-free.** Node 18+ built-ins only (`node:fs`, `node:zlib`, `fetch`…), no `package.json` dependencies; the PHP template needs PHP ≥ 8.1 and nothing else. Scripts print what fails and exit 1 on failure; use `process.exitCode`, not `process.exit()`, after network calls (Windows).
3. **Re-verify young specs before every release:** WebMCP, MCP Server Card, AI Catalog / ARD, the MCP protocol revision, Lighthouse Agentic Browsing, AI crawler names, Search Console/Bing report names, the claude.ai upload path. Reread the sources, update the facts and the dates in `references/sources.md` and in the "Young specs" table of `SKILL.md`, then rerun the tests.
4. **Run the tests before committing:** `node scripts/test.mjs` must say ALL PASSED. It needs PHP for the template and the HTTP checks (`PHP_BIN=/path/to/php` if `php` isn't on the PATH); without PHP those steps are skipped, so don't commit changes to the PHP template or the check scripts untested. Before a release also run `node scripts/test.mjs --online https://<a real site> --mcp https://<its MCP endpoint>`.
5. **Skill format** (Agent Skills docs, checked 2026-11-03): frontmatter keys `name` and `description` only (claude.ai uploads reject Claude-Code-only keys); `name` = folder name, lowercase/digits/hyphens, ≤ 64 chars, no "anthropic"/"claude"; `description` ≤ 1024 chars, no `<` or `>`, says what the skill does and when to use it; SKILL.md body under 500 lines, details in `references/`. `scripts/validate-skill.mjs` enforces this.
6. **Generic content only.** The skill came from a real site; keep examples on `example.com`, no private repository details, credentials, analytics data or client names.
7. **LF line endings, UTF-8 without BOM** (`.gitattributes` enforces LF; the validator fails on CRLF).
8. **The owner decides** the license, public visibility, publishing the marketplace or submitting to directories. Don't add a LICENSE file, make the repository public or submit anything without being asked.
9. Branch for changes; don't push to `main` without the owner's go-ahead. Commit messages say what changed and how it was tested.

## Release checklist

1. Rule 3 (re-verify), then `node scripts/test.mjs` and the `--online` run.
2. Bump `version` in `.claude-plugin/plugin.json`.
3. `node scripts/build-zip.mjs`; attach `dist/seo-geo-aeo.zip` to a GitHub release if the owner wants one.

## Using the skill

- **Claude Code, from a clone:** copy `skills/seo-geo-aeo` to `~/.claude/skills/` (all projects) or `<project>/.claude/skills/` (one project). Claude loads it when a task matches the description; ask for it by name ("use the seo-geo-aeo skill to audit https://example.com") to be sure.
- **Claude Code, as a plugin:** `/plugin marketplace add gsideology/skill-seo-geo-aeo`, then `/plugin install seo-geo-aeo@skill-seo-geo-aeo`; the skill is `/seo-geo-aeo:seo-geo-aeo`. The repository is private: installers need read access.
- **claude.ai:** `node scripts/build-zip.mjs`, then upload `dist/seo-geo-aeo.zip` (see README for the current menu path).
- With the skill installed, working on this repo is also dogfooding: run its scripts against a real site and fix whatever the output shows is unclear.
