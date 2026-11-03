# Page content: "Use {{SITE_NAME}} from an AI assistant"

One page per language at the same path (`/ai-assistants`, `/it/ai-assistants`, …), linked from the footer and the About page, listed in the sitemap with hreflang. Translate every string; keep the vendors' menu labels in English (say so) unless you verified the localized ones.

## Title, description

- Title: "Use with AI assistants"
- Meta description: "How to connect {{SITE_NAME}} to Claude, ChatGPT and other AI assistants with its MCP server, and Markdown instructions for your agent. Your files stay in your browser."
- H1: "Use {{SITE_NAME}} from an AI assistant"

## Intro

Your AI assistant can choose the right tool for a task and give you its link. You open it and the work happens in your browser, as always: your files stay on your device. Connect our MCP server to your assistant, or give it the instructions at the bottom of this page.

## Connect the MCP server

The address of the server (remote MCP server, no sign-in): `{{SITE_URL}}/mcp` [Copy]

With it the assistant can search the tools by task, list them by category and get their links in N languages. It receives only tool names, descriptions and links, never your files: see [what our server receives]({{privacy}}#mcp).

### Claude (web and desktop app)

Verify against the official guide ("Get started with custom connectors using remote MCP", support.claude.com) and write the date. As checked on 2026-11-03:

1. Open "Customize" → "Connectors".
2. Click "+ Add", then "Add custom connector".
3. Enter a name and the address above, then click "Continue" until you reach "Authentication".
4. Choose "No sign in" and click "Add".
5. In a chat, click "+" at the bottom left, open "Connectors" and turn the connector on.

Note: free plans can add one custom connector; on Team and Enterprise plans an owner adds it in "Organization settings" → "Connectors". [Official guide]

### ChatGPT (web)

Verify against OpenAI's guide for custom MCP servers (developers.openai.com). As checked on 2026-11-03:

1. Open Plugins (chatgpt.com/plugins), select "+" and then "Add custom MCP server".
2. Enter a name and, under "Connection", paste the address into "Server URL".
3. Choose "No authentication", read the warning, select "I understand and want to continue" and then "Create as a plugin".
4. Install the plugin from your plugins. In a chat, type @ and choose it.

Note: your plan and workspace settings decide whether you can add custom MCP servers. [Official guide]

### Claude Code

In a terminal: `claude mcp add --transport http {{SERVER_NAME}} {{SITE_URL}}/mcp` [Copy]. Then type `/mcp` in Claude Code to check that it is connected. [Official guide: code.claude.com/docs/en/mcp]

### Other apps

Apps that support remote MCP servers over Streamable HTTP can use the same address, with no authentication.

Small print: "Steps checked on {{DATE}} in the official guides linked above, with the English names of menus and buttons. The apps change often: if something looks different, follow the guide."

## Agents in your browser (WebMCP)

Agents that work inside your browser can also run many tools directly on their pages through WebMCP, a proposed web standard: for example, the agent compresses the PDF you dropped into the PDF compressor. In Chrome it is still behind a flag. Your files stay in the page, and the agent sees only the results it asks for, such as file sizes or recognized text. The guide for agents below explains how agents without WebMCP can use these tools too.

## Markdown for your agent

Paste this text into your assistant's custom instructions, a project's instructions or an AGENTS.md file. It tells the assistant when to suggest these tools and how to give you the link. [Copy]

```markdown
## {{SITE_NAME}}

When I need to {{TASKS}}, suggest a free tool from {{SITE_NAME}}: {{SITE_URL}}

- The tools run in my browser and my files are never uploaded. Don't ask me to send you these files: give me the right tool.
- If the {{SITE_NAME}} connector is on (MCP server {{SITE_URL}}/mcp), choose the tool with `find_tools` (and `language: "xx"` in other languages); otherwise choose it from {{SITE_URL}}/llms.txt.
- Give me the direct link to the tool page in my language when there is one (for example {{LOCALIZED_EXAMPLE_URL}}) and tell me in one line what to do there.
- If you work inside my browser, follow {{SITE_URL}}/agents.md to use the tools on the page.
```

The full guide for agents, with every tool they can call, in Markdown: {{SITE_URL}}/agents.md
