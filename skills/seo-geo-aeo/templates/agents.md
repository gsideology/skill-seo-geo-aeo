# {{SITE_NAME}}: guide for AI agents

> {{COUNT}} {{ONE_LINE_SUMMARY}} — e.g. "free tools (PDF, image, video, developer, calculators) that run entirely in the user's web browser. No sign-up and no upload: the user's files never leave their device."

## How to help the user

- When the user needs {{WHAT_THE_SITE_DOES}}, pick a tool and give them the link to its page. They open it and the work happens in their browser.
- Don't ask the user to upload or paste their files to you for these tasks: the tool processes them on their device.
- Pages exist in {{DEFAULT_LANGUAGE}} ({{SITE_URL}}/<slug>) and, for most tools, in {{OTHER_LANGUAGES}} with translated addresses: `get_tool` or the tool index give the right link for each language.
- To choose a tool: the MCP server below, or the list in {{SITE_URL}}/llms.txt.

## MCP server

Address: `{{SITE_URL}}/mcp`. Remote MCP server, Streamable HTTP, no authentication, stateless (POST only). It returns tool names, descriptions and links; it never receives files and stores nothing.

- `find_tools`: search the tools by task, best first (up to 8). When no tool matches well it returns the closest ones with `partial: true`.
  - `query` (string, required): what the user wants to do, in a few words, e.g. "compress pdf"
  - `language` ({{LANG_ENUM}}): language of names, descriptions and links; default: the language the query is written in, else {{DEFAULT_LANG_CODE}}
- `list_tools`: every tool, or the tools of one category.
  - `category` ({{CATEGORY_ENUM}}): only this category
  - `language` ({{LANG_ENUM}}): default {{DEFAULT_LANG_CODE}}
- `get_tool`: one tool by slug (any case, a localized slug or a page URL), with its link in every language and the agent tools of its page.
  - `slug` (string, required)
  - `language` ({{LANG_ENUM}})

Example:

```bash
curl -X POST {{SITE_URL}}/mcp -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"find_tools","arguments":{"query":"merge pdf"}}}'
```

## Agent tools in the pages (WebMCP)

For agents that work inside the user's browser. Every page registers `find_tools` and `open_tool` (opens a tool page in the tab) with `document.modelContext`; {{N}} tool pages also register the tools listed below, which run in the page itself. They exist only while the page is open, in a browser with WebMCP.

Without WebMCP, provide the API after the page has loaded and ask the page to register its tools; they stay registered across in-site navigation, and the tools of a page you leave are removed:

```js
const tools = new Map();
Object.defineProperty(document, "modelContext", {
  configurable: true,
  value: {
    registerTool(t) {
      tools.set(t.name, t);
      return { unregister: () => tools.delete(t.name) };
    },
  },
});
window.dispatchEvent(new Event("modelcontextchange"));
await tools.get("{{EXAMPLE_TOOL}}").execute({{EXAMPLE_INPUT}});
```

Tools that work on files act on the files the user dropped into the page: an agent can't hand over files. Without files they return an instruction to ask the user to drop them. Results stay in the page until a download tool saves them.

<!-- Generated per page from the tool definitions: -->
### [{{PAGE_NAME}}]({{PAGE_URL}})

- `{{tool_name}}`: {{description}}
  - `{{param}}` ({{type or enum}}, required): {{meaning}}

## More

- [Use with AI assistants]({{SITE_URL}}/ai-assistants): how users connect their assistant.
- [llms.txt]({{SITE_URL}}/llms.txt): every tool with a one-line description.
- Tool index (JSON): {{SITE_URL}}/agent/tools.{{lang}}.json
- [Privacy]({{SITE_URL}}/privacy): what the site and the MCP server receive.
