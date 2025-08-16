import "deco/runtime/htmx/FreshHeadCompat.ts";
import { Layout } from "./_app.tsx";
import manifest, { Manifest } from "./manifest.gen.ts";
import { Deco as Deco } from "@deco/deco";
import { bindings as HTMX } from "@deco/deco/htmx";
import { Hono } from "@hono/hono";
import { mcpServer } from "@deco/mcp";
const app = new Hono();
const deco = await Deco.init<Manifest>({
  manifest,
  bindings: HTMX({
    Layout,
  }),
});

// Mount MCP server middleware
app.use("/*", mcpServer(deco));

// Proxy all routes to Deco
app.all("/*", async (c) => {
  c.res = await deco.fetch(c.req.raw);
  return c.res;
});

const envPort = Deno.env.get("PORT");
Deno.serve({ handler: app.fetch, port: envPort ? +envPort : 8000 });
