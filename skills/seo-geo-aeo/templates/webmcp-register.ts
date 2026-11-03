// WebMCP registration helpers (framework-agnostic, with a React hook at the end).
// Draft API: document.modelContext.registerTool(tool, { signal }); older builds: navigator.modelContext
// and registerTool returning { unregister }. Tools run in the page: files never leave it.

export type JsonSchema = { [key: string]: unknown };

export interface AgentTool {
  name: string; // snake_case, unique on the site
  title?: string;
  description: string; // what it does, limits, defaults, "Runs locally in this browser tab; nothing is uploaded."
  inputSchema: JsonSchema; // { type: "object", properties, required, additionalProperties: false }
  annotations?: { readOnlyHint?: boolean };
  execute: (input: Record<string, unknown>) => unknown | Promise<unknown>;
}

interface ModelContext {
  registerTool(tool: AgentTool, options?: { signal?: AbortSignal }): Promise<void> | { unregister?: () => void } | void;
}

export const LOCAL_NOTE = "Runs locally in this browser tab; nothing is uploaded.";

/** A browser agent without native WebMCP defines document.modelContext later and dispatches this. */
export const MODEL_CONTEXT_EVENT = "modelcontextchange";

export function modelContext(): ModelContext | undefined {
  if (typeof document === "undefined") return undefined;
  const d = document as Document & { modelContext?: ModelContext };
  const n = navigator as Navigator & { modelContext?: ModelContext };
  return d.modelContext ?? n.modelContext;
}

/** Registers the tools until `signal` aborts. Exceptions become { error } the agent can read. */
export function registerTools(tools: AgentTool[], signal: AbortSignal): void {
  const mc = modelContext();
  if (!mc || signal.aborted) return;
  for (const tool of tools) {
    const wrapped: AgentTool = {
      ...tool,
      execute: async (input) => {
        try {
          return await tool.execute(input ?? {});
        } catch (e) {
          return { error: e instanceof Error ? e.message : String(e) };
        }
      },
    };
    try {
      const r = mc.registerTool(wrapped, { signal });
      if (r && typeof r === "object" && "unregister" in r && typeof r.unregister === "function") {
        const unregister = r.unregister.bind(r);
        signal.addEventListener("abort", unregister, { once: true });
      } else if (r instanceof Promise) {
        r.catch((e) => console.warn(`WebMCP: ${tool.name} not registered`, e));
      }
    } catch (e) {
      console.warn(`WebMCP: ${tool.name} not registered`, e);
    }
  }
}

/** Object schema with every listed property optional unless named in `required`. */
export function schema(properties: Record<string, JsonSchema>, required: string[] = []): JsonSchema {
  return { type: "object", properties, required, additionalProperties: false };
}

/** Input validation helpers: throw clear messages, the wrapper returns them to the agent. */
export function text(input: Record<string, unknown>, key: string, max = 1_000_000): string {
  const v = input[key];
  if (typeof v !== "string") throw new Error(`"${key}" must be a string`);
  if (v.length > max) throw new Error(`"${key}" is longer than ${max} characters`);
  return v;
}

export function oneOf<T extends string>(input: Record<string, unknown>, key: string, values: readonly T[], fallback: T): T {
  const v = input[key] ?? fallback;
  if (!values.includes(v as T)) throw new Error(`"${key}" must be one of: ${values.join(", ")}`);
  return v as T;
}

/* ---------------------------------------------------------------- React (optional) */
// import { useEffect, useSyncExternalStore } from "react";
//
// function subscribe(onChange: () => void) {
//   window.addEventListener(MODEL_CONTEXT_EVENT, onChange);
//   return () => window.removeEventListener(MODEL_CONTEXT_EVENT, onChange);
// }
// export function useModelContext(): boolean {
//   return useSyncExternalStore(subscribe, () => !!modelContext(), () => false);
// }
// /** Registers the page's tools while it is mounted; load the tool module only when WebMCP exists. */
// export function usePageTools(load: () => Promise<AgentTool[]>, deps: unknown[] = []) {
//   const has = useModelContext();
//   useEffect(() => {
//     if (!has) return;
//     const ctrl = new AbortController();
//     load().then((tools) => registerTools(tools, ctrl.signal));
//     return () => ctrl.abort();
//   }, [has, ...deps]);
// }
