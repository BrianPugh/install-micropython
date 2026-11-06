# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a GitHub Action that builds and installs the MicroPython Unix port for CI/CD workflows. It provides the `micropython` runtime and `mpy-cross` cross-compiler, with automatic caching for faster subsequent builds.

## Commands

```bash
npm ci           # Install dependencies
npm run build    # Bundle index.js with dependencies to dist/index.js using @vercel/ncc
npm test         # Run eslint (also available as npm run lint)
```

## Architecture

**Single-file action** with straightforward execution flow:

1. `index.js` - Core logic: clone repo → check cache → build if needed → install binaries → export env vars, set outputs
2. `action.yml` - Action metadata defining inputs (repository, reference, cflags, submodules), outputs (cache-hit, sha), and Node 24 runtime
3. `dist/index.js` - Bundled production file (auto-generated, committed to git)

**Key implementation details:**
- Binaries installed to `/usr/local/bin/` (micropython, mpy-cross)
- Repository cloned to `~/micropython` (`os.homedir()`, i.e. `/home/runner/micropython` on GitHub-hosted runners)
- All git commands use the argument-array form of `exec.exec` with `--` separators (never string interpolation) to prevent argument injection via the `repository`/`reference` inputs
- Cache key format: `install-micropython-3-${ImageOS}-${arch}-glibc${version}-${repository}-${sha}-${cflags}` (the `-3-` is a manual cache version bump; increment it to invalidate all caches). The runner-environment part keeps binaries built on one image (e.g. `ubuntu-latest` = 26.04) from being restored on another with an older glibc (e.g. `ubuntu-24.04`), where they fail with `GLIBC_x.y not found`. The resolved `HEAD` SHA (via `git rev-parse`) is what goes into the cache key, not the raw reference input
- Clone strategy: if a `reference` input is given, `git ls-remote --tags` probes whether it's a tag — tags get `git clone --depth 1 --branch <reference>` (fast; tag ref present so `git describe` version strings stay exact), branches/SHAs get a full clone + checkout (so `git describe` has tag history). No reference → shallow clone of the default branch
- `make submodules` (ports/unix) always runs when building from source (required), and also runs on cache hits unless the `submodules` input is false — this keeps `MPY_DIR` usable for natmod builds on warm runs. On cache hit the action then returns early — no build, binaries restored to `/usr/local/bin/`. Builds use `make -jN` with N from `os.cpus().length`
- `cache.saveCache` failures are downgraded to warnings (a concurrent job may have already reserved the key)
- `CFLAGS_EXTRA` (from the `cflags` input) is applied only to the Unix port build, not mpy-cross — mpy-cross's fixed config (e.g. `MICROPY_PY_SYS (0)`) fails to compile with many otherwise-valid feature flags
- `COMPAT_CFLAGS` (e.g. `-Wno-unterminated-string-initialization`) is passed via `CFLAGS_EXTRA` to both the mpy-cross and Unix port builds, ahead of the user's `cflags`, so older MicroPython releases build under `-Werror` on newer GCC. Only use plain `-Wno-<warning>` flags here: GCC silently ignores unknown ones, but an unknown `-Wno-error=<warning>` is a hard error on older GCC. They are left out of the cache key (they don't change the binaries). The exported `CFLAGS_EXTRA` stays the user's `cflags` only

**Dependencies:** `@actions/cache`, `@actions/core`, `@actions/exec`, `@actions/io`

## CI/CD Workflows

- **test.yaml**: Runs on push/PR to main. Lints, tests with MicroPython v1.22.1 (tag/shallow), master (branch/full clone), and latest, then exercises the cache-restore path (`test-cache` job re-runs with the same pinned reference, asserts `cache-hit == 'true'`, and checks both `submodules` settings) and the `cflags` input (`-DMICROPY_PY_SYS_TRACEBACKLIMIT=1`, verified by setting `sys.tracebacklimit`). `test-old-reference-new-gcc` builds v1.22.0 from source on `ubuntu-26.04` (asserts GCC >= 15; a per-run `cflags` define forces a cache miss) to guard `COMPAT_CFLAGS`, and `test-cache-other-image` then reruns the same reference+cflags on `ubuntu-24.04`, asserting a cache miss (guards the runner-environment part of the cache key)
- **build-and-pack.yml**: Auto-builds and commits dist/index.js on push to main/v* branches
- **release-new-action-version.yml**: Verifies the tagged dist/index.js matches a fresh build, then updates major version tags on release

## Development Workflow

1. Edit `index.js`
2. Run `npm run build` to regenerate `dist/index.js`
3. Commit both files (the bundled dist is checked into git)
