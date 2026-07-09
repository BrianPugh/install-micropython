import * as cache from '@actions/cache';
import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as io from '@actions/io';
import os from 'os';
import path from 'path';

async function run() {
  // Get the repository URL and reference
  const repository = core.getInput('repository');
  const reference = core.getInput('reference');
  const cflags = core.getInput('cflags');
  const submodules = core.getBooleanInput('submodules');

  const mpy_dir = path.join(os.homedir(), 'micropython');
  core.exportVariable('MPY_DIR', mpy_dir);
  core.exportVariable('CFLAGS_EXTRA', cflags);

  if (reference) {
    let isTag = false;
    try {
      const lsRemote = await exec.getExecOutput('git', ['ls-remote', '--tags', '--', repository, reference]);
      isTag = lsRemote.stdout.trim() !== '';
    } catch {
      // Probing failed (e.g. transient network error); fall through to the full-clone path
    }

    if (isTag) {
      // Tags can be cloned shallowly; the tag ref comes along, so the build's
      // `git describe` version string is still exact
      await exec.exec('git', ['clone', '--depth', '1', '--branch', reference, '--', repository, mpy_dir]);
    } else {
      // Branches and bare commit SHAs get a full clone so `git describe` has
      // the tag history it needs for a correct version string
      await exec.exec('git', ['clone', '--', repository, mpy_dir]);
      await exec.exec('git', ['-c', 'advice.detachedHead=false', 'checkout', reference], { cwd: mpy_dir });
    }
  } else {
    // Shallow clone the default branch
    await exec.exec('git', ['clone', '--depth', '1', '--', repository, mpy_dir]);
  }

  const logResult = await exec.getExecOutput('git', ['rev-parse', 'HEAD'], { cwd: mpy_dir });
  const sha = logResult.stdout.trim();
  core.setOutput('sha', sha);

  const cacheKey = `install-micropython-2-${repository}-${sha}-${cflags}`;

  const cachePaths = [
    `${mpy_dir}/mpy-cross/build/mpy-cross`,
    '/usr/local/bin/micropython',
    '/usr/local/bin/mpy-cross',
  ]
  const cacheHit = Boolean(await cache.restoreCache(cachePaths.slice(), cacheKey));
  core.setOutput('cache-hit', cacheHit);

  if (cacheHit) {
    if (submodules) {
      // Initialize submodules even on a cache hit so MPY_DIR is usable (e.g. natmod builds)
      await exec.exec('make', ['submodules'], { cwd: `${mpy_dir}/ports/unix` });
    }
    return;
  }

  // Building the Unix port requires submodules regardless of the `submodules` input
  await exec.exec('make', ['submodules'], { cwd: `${mpy_dir}/ports/unix` });

  const jobs = os.cpus().length;

  // Build mpy-cross. It has a fixed feature configuration, so user cflags are
  // withheld here and only applied to the Unix port build below
  await exec.exec('make', [`-j${jobs}`], {
    cwd: `${mpy_dir}/mpy-cross`,
    env: { ...process.env, CFLAGS_EXTRA: '' },
  });

  // Build Unix Port
  await exec.exec('make', [`-j${jobs}`], { cwd: `${mpy_dir}/ports/unix` });

  // Add the built binaries to the PATH
  await io.cp(`${mpy_dir}/mpy-cross/build/mpy-cross`, '/usr/local/bin/mpy-cross');
  await io.cp(`${mpy_dir}/ports/unix/build-standard/micropython`, '/usr/local/bin/micropython');

  // Save the cache; another concurrent job may have already reserved this key,
  // which must not fail the build
  try {
    await cache.saveCache(cachePaths.slice(), cacheKey);
  } catch (error) {
    core.warning(`Failed to save cache: ${error.message}`);
  }
}

run().catch(error => core.setFailed(error.message));
