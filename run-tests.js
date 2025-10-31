const { spawn } = require('child_process');

const vitest = spawn('npx', ['vitest', 'run', '--reporter=verbose'], {
  stdio: 'inherit',
  shell: true
});

vitest.on('close', (code) => {
  process.exit(code);
});
