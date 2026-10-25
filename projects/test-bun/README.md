Most of the files in this directory are copied from the test project. These directories should appear gray in your VS Code and will not be synced to Git. They are solely for testing code compatibility across different runtimes.

## Bun runtime compatibility demo

This project exercises milkio's **Bun runtime** support (`[projects.test-bun] runtime = "bun"` in the root `cookbook.toml`). It is intentionally kept as the Bun-runtime compatibility surface of this monorepo:

- `dev` / `build` scripts in `package.json` deliberately invoke the `bun` binary (`bun run`, `bun build --target=bun`).
- The generated entrypoint (`./.milkio/run.ts`) uses Bun's native HTTP server, so starting this demo requires Bun to be installed.
- Nothing in the pnpm/Node/Vite+ tooling, build or CI paths depends on this project; it only needs Bun when the demo itself is started.

For Node.js runtime coverage use `projects/test`, and for Deno runtime coverage use `projects/test-deno`.
