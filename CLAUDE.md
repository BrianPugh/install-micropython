# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a GitHub Action that builds and installs the MicroPython Unix port for CI/CD workflows. It provides the `micropython` runtime and `mpy-cross` cross-compiler, with automatic caching for faster subsequent builds.

## Commands

```bash
npm ci           # Install dependencies
npm run build    # Bundle index.js with dependencies to dist/index.js using @vercel/ncc
npm test         # Placeholder (no tests implemented)
```

## Architecture

**Single-file action** with straightforward execution flow:

1. `index.js` (58 lines) - Core logic: clone repo → check cache → build if needed → install binaries → export env vars
2. `action.yml` - Action metadata defining inputs (repository, reference, cflags) and Node 20 runtime
3. `dist/index.js` - Bundled production file (auto-generated, committed to git)

**Key implementation details:**
- Binaries installed to `/usr/local/bin/` (micropython, mpy-cross)
- Repository cloned to `/home/runner/micropython`
- Cache key format: `install-micropython-2-${repository}-${reference}-${cflags}`
- Uses shallow clone for tags/branches, full clone for commit hashes (detected via regex)

**Dependencies:** `@actions/cache`, `@actions/core`, `@actions/exec`, `@actions/io`

## CI/CD Workflows

- **test.yaml**: Runs on push/PR to main, tests with MicroPython v1.22.1 and latest
- **build-and-pack.yml**: Auto-builds and commits dist/index.js on push to main/v* branches
- **release-new-action-version.yml**: Updates major version tags on release

## Development Workflow

1. Edit `index.js`
2. Run `npm run build` to regenerate `dist/index.js`
3. Commit both files (the bundled dist is checked into git)
