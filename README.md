> ⚠️ Milkio 1.0 is under development, and there will be a lot of changes to the API at that time. Therefore, it is not recommended to use Milkio in the production environment for the time being, otherwise it may incur more code refactoring costs

<h2 align="center">🥛 Milkio</h2>

<p align="center">
    Documentation - <a href="https://milkio.fun">English</a> | <a href="https://zh-milkio.nito.ink">中文</a> | 日本語 | 한국어
</p>

<p align="center">🌟 Milkio is a Pleasant Framework - Serverless First, TypeScript Only, Support for All JavaScript Runtimes</p>

<br />

<p align="center">
    <a href="https://github.com/akirarika">
        <img src="https://raw.githubusercontent.com/akirarika/.github/main/profile/image.png" width="320px" />
    </a>
</p>

## Development

This monorepo is developed with **pnpm + Node.js (26.x) + [Vite+](https://vite.plus)**. Bun is **not** required for any install, build, test or CI step.

```bash
pnpm install
pnpm run co            # cookbook CLI (dev / generate / test / ...)
pnpm test              # tests via Vite+ (`vp test`, bundled Vitest 5)
```

Milkio applications still support the **Bun runtime** (`runtime = "bun"` in `cookbook.toml`); `projects/test-bun` is the Bun runtime-compatibility demo and is the only place in this repository that intentionally invokes the `bun` binary.

