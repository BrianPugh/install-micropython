# install-micropython

[![Basic validation](https://github.com/BrianPugh/install-micropython/actions/workflows/test.yaml/badge.svg?branch=main)](https://github.com/BrianPugh/install-micropython/actions/workflows/test.yaml)

This action provides the following functionality for GitHub Actions users:

* Builds and installs the following executables:
    * `micropython` - The micropython runtime. Can be used to run unit tests in conjunction with libraries such as micropython's [`unittest`](https://github.com/micropython/micropython-lib/tree/master/python-stdlib/unittest).
    * `mpy-cross` - The micropython cross-compiler. Used to cross-compile precompiled bytecode for specific microcontroller architectures.
* Provides a clone of the micropython repository (with submodules initialized) and sets the environment variable `MPY_DIR` to its path.
    * Can be used for artifact building, like [using native machine code in mpy files](https://docs.micropython.org/en/latest/develop/natmod.html#natmod).
    * Note: on a cache hit, `MPY_DIR` contains the source tree, submodules, and the cached `mpy-cross` binary, but not the Unix port build artifacts.
* Builds are automatically cached, speeding up subsequent runs.

This action only supports Linux runners.

## Basic Usage
Simply add the following step to your workflow:

```yaml
steps:
  - name: Install MicroPython
    uses: BrianPugh/install-micropython@v2
```

## Configuration
The `install-micropython` action can be configured by setting values under the `with:` key.
For example:

```yaml
steps:
  - uses: BrianPugh/install-micropython@v2
    with:
      reference: v1.20.0
```

Input configuration arguments are described as follows.

#### repository
The micropython git url to clone from. Defaults to the official micropython repository.

```yaml
with:
  repository: https://github.com/micropython/micropython
```

#### reference
A git reference (tag, commit, or branch) of the micropython repository to use.
Tags are fetched with a fast shallow clone; branches and commit SHAs use a full clone so the built interpreter still reports an accurate `git describe`-based version string.

```yaml
with:
  reference: v1.20.0
```

#### cflags
When compiling the `micropython` Unix port binary, this value gets passed along to environment variable `CFLAGS_EXTRA`.
This can be used to enable/disable certain micropython features.
It is intentionally not applied to the `mpy-cross` build, whose fixed feature configuration is incompatible with many otherwise-valid feature flags.
Note that `CFLAGS_EXTRA` remains exported for all subsequent steps of the job.

```yaml
with:
  cflags: '-DMICROPY_PY_RE_MATCH_GROUPS=1'
```

#### submodules
Whether to initialize MicroPython's submodules so that `MPY_DIR` is fully usable (e.g. for natmod builds), even when the binaries were restored from cache.
Defaults to `true`.
Set to `false` to shave ~30 seconds off cached runs if you only need the `micropython`/`mpy-cross` binaries.
Submodules are always initialized when building from source, regardless of this setting.

```yaml
with:
  submodules: false
```

## Outputs

#### cache-hit
`'true'` if the binaries were restored from cache, `'false'` if they were built from source.

#### sha
The resolved MicroPython commit SHA that was installed.

```yaml
steps:
  - uses: BrianPugh/install-micropython@v2
    id: install
  - run: echo "Installed micropython ${{ steps.install.outputs.sha }} (cache-hit=${{ steps.install.outputs.cache-hit }})"
```
