const cache = require('@actions/cache');
const core = require('@actions/core');
const exec = require('@actions/exec');
const io = require('@actions/io');

async function run() {
  // Get the repository URL and reference
  const repository = core.getInput('repository');
  let reference = core.getInput('reference');

  const mpy_dir = '/home/runner/micropython'
  core.exportVariable('MPY_DIR', mpy_dir);

  // Shallow clone the repository to get the latest commit hash or checkout the provided reference
  if (reference) {
    // Clone the repository without depth restriction and checkout the provided reference
    await exec.exec(`git clone ${repository} ${mpy_dir}`);
    await exec.exec(`git checkout ${reference}`, [], { cwd: mpy_dir });
  } else {
    // Shallow clone the repository to get the latest commit hash
    await exec.exec(`git clone --depth 1 ${repository} ${mpy_dir}`);
  }

  const logResult = await exec.getExecOutput('git', ['rev-parse', 'HEAD'], {cwd: mpy_dir});
  reference = logResult.stdout.trim();

  const cacheKey = `install-micropython-2-${reference}`;

  const cachePaths = [
    `${mpy_dir}/mpy-cross/build/mpy-cross`,
    '/usr/local/bin/micropython',
    '/usr/local/bin/mpy-cross',
  ]
  const cacheHit = await cache.restoreCache(cachePaths.slice(), cacheKey);

  if (cacheHit) {
    return;
  }

  // Build mpy-cross
  await exec.exec('bash', ['-c', 'make -j$(nproc)'], {cwd: `${mpy_dir}/mpy-cross`});

  // Build Unix Port
  await exec.exec('make submodules', [], {cwd: `${mpy_dir}/ports/unix`});
  await exec.exec('bash', ['-c', 'make -j$(nproc)'], {cwd: `${mpy_dir}/ports/unix`});

  // Add the built binaries to the PATH
  await io.cp(`${mpy_dir}/mpy-cross/build/mpy-cross`, '/usr/local/bin/mpy-cross');
  await io.cp(`${mpy_dir}/ports/unix/build-standard/micropython`, '/usr/local/bin/micropython');

  // Save the cache
  await cache.saveCache(cachePaths.slice(), cacheKey);
}

run().catch(error => core.setFailed(error.message));
