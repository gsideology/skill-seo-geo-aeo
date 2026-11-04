# llms.txt, agents.md and the "Use with AI assistants" page

Three documents, three readers:

| File | Reader | Purpose |
|---|---|---|
| `/llms.txt` | LLM crawlers and assistants reading the site | Map of the site: every page with a one-line description, plus a "For AI agents" section |
| `/agents.md` | Agents that act for a user | How to help the user with this site: rules, MCP server and parameters, in-page tools and how to call them |
| `/ai-assistants` (HTML, every language) | People | How to connect their assistant, and a Markdown snippet to paste into its instructions |

All three are generated from the registry at build time, so they list only published pages.

**What these files do and don't do** (checked 2026-11-03): `llms.txt` is a proposal (llmstxt.org, by Jeremy Howard, 2024; page updated 2026), not a standard, and Google states that Search doesn't use `llms.txt` and that it neither helps nor harms visibility. Its value is for agents and tools that read it (assistants browsing the site, IDE agents, Lighthouse's Agentic Browsing check) and as a map you control. Keep it consistent with the pages: never say something there that the pages don't. `agents.md` here is a site guide for agents, not the `AGENTS.md` convention for code repositories.

**Put the procedure first.** Models often read only the beginning of a page or file. Right after the summary of `llms.txt` and `agents.md`, write three steps: (1) connect the MCP server `<url>/mcp` (Streamable HTTP, no sign-in) and call `find_tools` with the user's request in their language, or pick from the list; (2) give the user the page link; (3) never ask for their files — the tools run in their browser and the server returns only names and links. Repeat the gist in a visible block on the homepage.

## llms.txt

Format (llmstxt.org): an H1 with the site name (the only required element), a blockquote summary, paragraphs or lists without headings, then `##` sections of Markdown links `- [Name](absolute URL): description`. A section titled `## Optional` holds links an agent may skip when it needs a shorter context. The proposal also suggests clean Markdown copies of pages at the same URL plus `.md` (`page.md` or `page.html.md`), discoverable with `<link rel="alternate" type="text/markdown">`; add them only if you generate them from the same source as the HTML.

```markdown
# Example Tools

> Free image, PDF and developer tools that run in your browser: no sign-up, no upload.

Example Tools is a collection of N free online tools that run entirely in the user's browser …

## PDF

- [Merge PDF](https://example.com/merge-pdf): Combine several PDFs into one file in the order you choose.
…

## Guides
- [How to merge PDF files](https://example.com/blog/how-to-merge-pdf-files): one-paragraph answer …

## For AI agents

- [Guide for AI agents](https://example.com/agents.md): how to help users with these tools, the MCP server and every agent tool with its parameters (Markdown).
- [Use with AI assistants](https://example.com/ai-assistants): how users connect Claude, ChatGPT and other assistants.
- MCP server: `https://example.com/mcp` (remote, Streamable HTTP, no sign-in). Tools: `find_tools`, `list_tools`, `get_tool`. It returns names and links only; files are never sent.
- WebMCP in the pages: every page registers `find_tools` and `open_tool`; N tool pages also register their own tools (listed below). Recipe for browser agents without native WebMCP: …
- Tool index (JSON, one file per language): https://example.com/agent/tools.en.json, …

Pages with agent tools:
- [JSON Formatter](https://example.com/json-formatter): `format_json`
…

## Other languages
- [Italiano](https://example.com/it): the site in Italian.

## About
- [About](https://example.com/about) · [Privacy](https://example.com/privacy)
```

Write the "For AI agents" section only for things that exist and work; keep the recipe for browser agents identical to the tested one (`templates/webmcp-shim.js`).

## agents.md

Plain Markdown, served as `text/markdown; charset=utf-8` (add the MIME type on Apache/LiteSpeed: `AddType "text/markdown; charset=utf-8" .md`). Template: `templates/agents.template.md` (publish it as `/agents.md`; the template name keeps coding agents from loading it as instructions for this repository). Sections:

1. **One-paragraph summary** of the site (what, how many tools, privacy promise).
2. **How to help the user**: pick a tool and give the link; don't ask the user to upload their files to the assistant; which languages exist and how to get the right link; how to choose (MCP server or `llms.txt`).
3. **MCP server**: address, transport, authentication (none), statelessness; each tool with its parameters (name, type or enum, required, meaning, default); a curl example.
4. **Agent tools in the pages (WebMCP)**: which pages register which tools; the recipe for agents without native WebMCP as a code block that was executed as written; how file tools work (the user drops files into the page, the agent calls the tool; results stay in the page until a download tool saves them).
5. **Per page**: `### [Page](url)` then each tool with its description and parameter list, generated from the tool definitions (`inputSchema`).
6. **More**: links to llms.txt, the human page, the JSON index, the privacy policy.

Generate parameters from the schemas; for tools registered inside components (whose schemas aren't importable at build), list the names and say they act on what is open in the page.

## The "Use with AI assistants" page

Template: `templates/ai-assistants-page.md`. One page per language, same path (`/ai-assistants`, `/it/ai-assistants`, …), linked from the footer and the About page, in the sitemap, `hreflang` like every page.

- **Intro**: the assistant picks the tool and gives the link; the work and the files stay in the user's browser.
- **Connect the MCP server**: the address in a copyable block (with a Copy button); what the server receives (link to the privacy section).
- **Per app**: numbered steps from the vendor's official guide, the guide linked, the date checked, and a note that menu names may be in English and may change. Typical apps: Claude (web/desktop custom connector, "No sign in"), ChatGPT (custom MCP server, "No authentication"), Claude Code (`claude mcp add --transport http <name> <url>`, then `/mcp`), "other apps that support remote MCP servers over Streamable HTTP".
- **Agents in the browser (WebMCP)**: what they can do, that files stay in the page, current browser support (flag/origin trial), link to agents.md.
- **Markdown for your agent**: a localized snippet to paste into custom instructions, project instructions or an `AGENTS.md`, with a Copy button (localized "Copied!"). The example link uses the localized URL of a real tool.

Verify the official steps yourself (fetch the help pages) and record the date; never invent menu labels.

## Privacy texts

Add two paragraphs to the privacy policy, in every language:

- **MCP server**: if a user connects it, the assistant's servers send ours the search words and the tool/category asked about; we use them only to answer and never store them (they travel in the request body, not the URL, so they don't reach access logs); we count calls per method/tool and language in daily totals; the server returns names, descriptions and links and never receives files; what the user writes to the assistant is covered by the assistant's provider.
- **WebMCP**: browser agents can use tools on the page; files stay in the page and the agent sees only the results it asks for (sizes, recognized text).
