const cache = require('@actions/cache');
const core = require('@actions/core');
const exec = require('@actions/exec');
const io = require('@actions/io');

async function run() {
  // Get the repository URL and reference
  const repository = core.getInput('repository');
  const reference = core.getInput('reference');

  // Shallow clone the repository to get the latest commit hash or checkout the provided reference
  await exec.exec(`git clone --depth 1 ${repository} micropython`);

  // Export the micropython directory
  const mpy_path = `${process.env.GITHUB_WORKSPACE}/micropython`
  core.exportVariable('MPY_DIR', mpy_path);

  let ref = reference;

  if (!ref) {
    const logResult = await exec.getExecOutput('git', ['rev-parse', 'HEAD'], {cwd: 'micropython'});
    ref = logResult.stdout.trim();
  } else {
    await exec.exec(`git checkout ${ref}`, [], {cwd: 'micropython'});
  }

  const cacheKey = `micropython-unix-port-${repository}-${ref}`;

  const cacheHit = await cache.restoreCache(['/usr/local/bin/micropython'], cacheKey);

  if (cacheHit) {
    return;
  }

  // Build mpy-cross
  await exec.exec('bash', ['-c', 'make -j$(nproc)'], {cwd: 'micropython/mpy-cross'});

  // Build Unix Port
  await exec.exec('make submodules', [], {cwd: 'micropython/ports/unix'});
  await exec.exec('bash', ['-c', 'make -j$(nproc)'], {cwd: 'micropython/ports/unix'});

  // Add the built binaries to the PATH
  await io.cp('micropython/mpy-cross/build/mpy-cross', '/usr/local/bin/mpy-cross');
  await io.cp('micropython/ports/unix/build-standard/micropython', '/usr/local/bin/micropython');

  // Save the cache
  await cache.saveCache(['/usr/local/bin/micropython', '/usr/local/bin/mpy-cross', mpy_path], cacheKey);
}

run().catch(error => core.setFailed(error.message));
