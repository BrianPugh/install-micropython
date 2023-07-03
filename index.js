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
  await exec.exec(`git clone --depth 1 ${repository} ${mpy_dir}`);

  if(reference){
    await exec.exec(`git checkout ${reference}`, [], {cwd: mpy_dir});
  }

  const logResult = await exec.getExecOutput('git', ['rev-parse', 'HEAD'], {cwd: mpy_dir});
  reference = logResult.stdout.trim();

  const cacheKey = `install-micropython-${reference}`;

  const cachePaths = [
    '/usr/local/bin/micropython',
    '/usr/local/bin/mpy-cross',
    mpy_dir
  ]
  core.info(`Checking cacheKey ${cacheKey}`);
  const cacheHit = await cache.restoreCache(cachePaths, cacheKey);

  if (cacheHit) {
    core.info('Cache hit');
    return;
  } else {
    core.info('Cache miss');
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
  core.info(`Saving cache to cacheKey ${cacheKey}`);
  await cache.saveCache(cachePaths, cacheKey);
}

run().catch(error => core.setFailed(error.message));
