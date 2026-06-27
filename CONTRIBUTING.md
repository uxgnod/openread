# Contributing to OpenRead

Thanks for helping make OpenRead better.

## Local Setup

```bash
pnpm install
pnpm dev
```

Run checks before opening a pull request:

```bash
pnpm type-check
pnpm lint
pnpm test
pnpm build
```

## Code Style

- Keep entrypoints thin. Put behavior in `src/background`, `src/content`, and `src/shared`.
- Prefer deterministic DOM logic over LLM-driven page manipulation.
- Do not log or commit API keys.
- Keep translation fragments small and scoped to a single DOM block.
- Add focused tests for sanitizing, prompt rendering, caching, and DOM filtering changes.

## Scope

V1 is intentionally small: configurable bilingual web translation through an OpenAI-compatible provider. Larger surfaces such as a floating toolbar, DOM inspector, and site plans belong in later iterations.
