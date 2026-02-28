#!/usr/bin/env node
'use strict';

/**
 * Generate buildcheck.gypi for cpu-features before electron-rebuild.
 * cpu-features (dependency of ssh2) expects this file from its install script;
 * electron-rebuild only runs node-gyp so the file is missing without this.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const cpuFeaturesDir = path.join(__dirname, '..', 'node_modules', 'cpu-features');
const buildcheckJs = path.join(cpuFeaturesDir, 'buildcheck.js');
const buildcheckGypi = path.join(cpuFeaturesDir, 'buildcheck.gypi');

if (fs.existsSync(buildcheckJs)) {
  try {
    const out = execSync('node buildcheck.js', { cwd: cpuFeaturesDir, encoding: 'utf8' });
    fs.writeFileSync(buildcheckGypi, out);
    console.log('Generated node_modules/cpu-features/buildcheck.gypi');
  } catch (e) {
    console.warn('pre-rebuild: could not generate cpu-features buildcheck.gypi', e.message);
  }
}
