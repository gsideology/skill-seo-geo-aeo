# WebMCP: tools inside the page

WebMCP lets a page declare tools that an AI agent running in the user's browser can call. The tools run in the tab, so they can use the files the user opened there without uploading them.

**Status (checked 2026-11-03; young spec, reread before shipping):**

- Specification: [WebMCP](https://webmachinelearning.github.io/webmcp/), a Draft Community Group Report of the W3C Web Machine Learning Community Group dated 2 November 2026. Not a W3C standard and not on the standards track.
- API in the draft: `document.modelContext.registerTool(tool, options)` returning a promise; tools are removed when the `signal` passed in the options aborts. Older drafts and Chrome builds used `navigator.modelContext` and a `registerTool` that returned `{ unregister }`: the helper below supports both.
- Chrome ([WebMCP docs](https://developer.chrome.com/docs/ai/webmcp), updated 2026-10-07): origin trial from Chrome 149, or locally `chrome://flags/#enable-webmcp-testing`. Visitors without the flag need the origin-trial token on the page. Check the current status before promising it to users.

## Registration helper

`templates/webmcp-register.ts` contains a framework-agnostic version. The essentials:

```ts
export function modelContext() {
  return (document as any).modelContext ?? (navigator as any).modelContext;
}

/** Registers tools until `signal` aborts. Exceptions become `{ error }` the agent can read. */
export function registerTools(tools: AgentTool[], signal: AbortSignal) {
  const mc = modelContext();
  if (!mc || signal.aborted) return;
  for (const tool of tools) {
    const wrapped = { ...tool, execute: async (input) => { try { return await tool.execute(input ?? {}); } catch (e) { return { error: e instanceof Error ? e.message : String(e) }; } } };
    const r = mc.registerTool(wrapped, { signal });
    // Older implementations return a handle instead of honouring the signal.
    if (r && typeof r.unregister === "function") signal.addEventListener("abort", () => r.unregister(), { once: true });
  }
}
```

In React, register in `useEffect` and abort in the cleanup, so client-side navigation removes the old page's tools and registers the new ones.

## Late activation (agents without native WebMCP)

Browser agents (an assistant driving a browser tab) usually have no `document.modelContext`. Let them provide one after the page has loaded and ask the page to register:

- The page re-checks for `modelContext` when a `modelcontextchange` event is dispatched on `window` (React: `useSyncExternalStore` subscribed to that event).
- The agent runs `templates/webmcp-shim.js` in the page, then calls `tools.get("name").execute({...})`.
- Document the recipe in `llms.txt` and `agents.md` exactly as tested.

## Which tools

- **Site-wide, every page**: `find_tools` (search the site's tools by task; reads a static JSON index of the site, so the query never leaves the page) and `open_tool` (navigate the tab to a tool's page; accept a slug in any case, a localized slug or a page URL).
- **Pure tools** (text, data, calculators, generators): call the same functions the UI uses; no duplicated logic. Load their modules only when `modelContext` exists (dynamic import), so normal visitors pay nothing.
- **File tools**: an agent cannot hand files over or open a file picker. The user drops files into the page; the tool works on them and returns sizes/results; a separate `download_*` tool saves the output. Without files, return an instruction: "Ask the user to drop the file(s) into the page…".
- **Don't expose** functions whose result is a secret meant for the user (generated passwords, keys): it would land in the agent's context and its provider's logs.

## Tool design rules

- Names: `snake_case`, unique across the site (check at build), verbs first (`compress_pdf`, `download_compressed_pdf`).
- Description: what it does, limits, defaults, and "Runs locally in this browser tab; nothing is uploaded."
- `inputSchema`: JSON Schema object with `additionalProperties: false`, enums for closed sets, descriptions with units and defaults, `required` only for real requirements.
- Annotations: `readOnlyHint: true` for functions without side effects.
- Validate input yourself (types, ranges, lengths) and throw clear messages; the wrapper turns them into `{ error }`.
- Keep settings in sync with the page UI: a tool that changes options should update the page state the user sees, and wait for it.
- Check at build: every tool listed in the index exists in its module/component source; names unique; schemas valid.

## Declarative forms

Chrome's WebMCP documentation describes a declarative API: annotations on standard HTML forms turn them into tools, and Lighthouse checks both declarative and imperative tools. The attribute names were not on the overview page checked on 2026-11-03; read Chrome's declarative API documentation and the current draft before adding them to real forms (search, contact), then confirm with Lighthouse and the inspector extension.

## Testing

1. **Any browser, no flag**: run `templates/webmcp-shim.js` in the console on a tool page; list `[...tools.keys()]`; call each tool with valid and invalid input; navigate client-side and check that tools change.
2. **Chrome with WebMCP**: enable the flag, check `document.modelContext` exists on an HTTPS page (the API needs a secure context); Chrome's testing API (`navigator.modelContextTesting.getTools()` / `executeTool(name, json)`) when your build has it; DevTools to debug tools and see how the browser parses the JSON Schema.
3. **An agent**: the Model Context Tool Inspector extension (Chrome Web Store) lists registered tools, runs them by hand and lets a Gemini model use them with your API key; what you type goes to that model provider, the files stay in the page.
4. **Lighthouse**: the Agentic Browsing category watches tool registration through the DevTools protocol; it needs Chrome 150 or later and, for the WebMCP audits, the WebMCP origin trial. Audits report "not applicable" when the browser has no WebMCP or the page registers no tools.
