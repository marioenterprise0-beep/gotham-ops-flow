// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";
import { resolve } from "path";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    plugins: [mcpPlugin()],
    resolve: {
      // Explicit aliases for TanStack Start's package `imports` map entries (#-prefixed paths).
      // Lovable's build environment doesn't resolve these from package.json `imports` automatically.
      alias: {
        "#tanstack-start-plugin-adapters": resolve(
          "node_modules/@tanstack/start-client-core/dist/esm/empty-plugin-adapters.js",
        ),
        "#tanstack-start-entry": resolve(
          "node_modules/@tanstack/start-client-core/dist/esm/fake-entries/start.js",
        ),
        "#tanstack-router-entry": resolve(
          "node_modules/@tanstack/start-client-core/dist/esm/fake-entries/router.js",
        ),
      },
    },
  },
});
