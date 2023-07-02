# install-micropython

[![Basic validation](https://github.com/BrianPugh/install-micropython/actions/workflows/test.yaml/badge.svg?branch=main)](https://github.com/BrianPugh/install-micropython/actions/workflows/test.yaml)

This action provides the following functionality for GitHub Actions users:

* Builds an installs the following executables:
    * `micropython` - The micropython runtime. Can be used to run unit tests in conjunction with libraries such as micropython's [`unittest`](https://github.com/micropython/micropython-lib/tree/master/python-stdlib/unittest).
    * `mpy-cross` - The micropython cross-compiler. Used to cross-compile precompiled bytecode for specific microcontroller architectures.
* Provides a clone of the micropython repository and sets the environment variable `MPY_DIR` to it's path.
    * Can be used as for artifact building, like [using native machine code in mpy files](https://docs.micropython.org/en/latest/develop/natmod.html#natmod).
* Builds are automatically cached, speeding up subsequent runs.

## Basic Usage
Simply add the following step to your workflow:

```yaml
steps:
  - name: Install MicroPython
    uses: actions/install-micropython@v1
```

## Configuration
The `install-micropython` action can be configured by setting values under the `with:` key.
For example:

```yaml
steps:
  - uses: actions/install-micropython@v1
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

```yaml
with:
  reference: v1.20.0
```
