#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

if (!fs.existsSync(path.join(__dirname, 'build/index.js'))) {
  console.error('[ERROR] RepoSync has not been built from source. Please run `yarn build` first!');
  process.exit(1);
}

require('./build/index');
