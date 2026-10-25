# @milkio/vite-plugin-milkio

Part of the [milkio](https://github.com/akirarika/milkio) monorepo.

Vite plugin for milkio projects. Add `useVitePluginMilkio()` to `vite.config.ts`:

```ts
import { defineConfig } from "vite";
import { useVitePluginMilkio } from "@milkio/vite-plugin-milkio";

export default defineConfig({
  plugins: [useVitePluginMilkio()],
});
```

## Install

```bash
pnpm add -D @milkio/vite-plugin-milkio
```

## Development

This package lives in `packages/vite-plugin-milkio` of the milkio workspace. Install the workspace dependencies from the repository root, then use the root scripts:

```bash
pnpm install
pnpm test
```

Documentation: [milkio.fun](https://milkio.fun)
