const { spawn } = require('child_process');
const path = require('path');

const child = spawn('node', [
  path.join(__dirname, 'node_modules', 'serve', 'build', 'main.js'),
  '-s', 'dist',
  '-l', '5180'
], { stdio: 'inherit' });

child.on('exit', (code) => process.exit(code));