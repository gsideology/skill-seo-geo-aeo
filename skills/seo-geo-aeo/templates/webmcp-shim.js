// Provides document.modelContext to a page whose browser has no native WebMCP, then asks the page
// to register its tools (the page listens for "modelcontextchange", see webmcp-register.ts).
// Paste into the console of a page of the site (or run it from a browser agent), then:
//   [...tools.keys()]
//   await tools.get("format_json").execute({ json: '{"b":1,"a":2}', sortKeys: true })
// Tools of a page you leave with in-site navigation are removed; a full reload loses the shim.
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
