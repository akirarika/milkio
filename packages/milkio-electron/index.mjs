#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import fse from 'fs-extra';
import deepmerge from 'deepmerge';
import { execFileSync } from 'node:child_process';
import { argv, exit } from 'node:process';

const startTime = Date.now();
const cwd = process.cwd();
let targetDir;
let mostRecentDir = null;
let oldDirs = [];
let currentDirCleanupNeeded = false;

async function handleError(error) {
  console.error('❌ Process failed:', error.message);

  try {
    if (currentDirCleanupNeeded) {
      if (mostRecentDir && targetDir) {
        const packageLockPath = path.join(targetDir, 'package-lock.json');
        if (fs.existsSync(packageLockPath)) {
          try {
            const content = fs.readFileSync(packageLockPath, 'utf8');
            const destPath = path.join(mostRecentDir, 'package-lock.json');
            fs.writeFileSync(destPath, content);
            console.log(`♻️ Restored package-lock.json to old version directory: ${mostRecentDir}`);
          } catch (err) {
            console.warn('⚠️ Could not restore package-lock.json to old version directory:', err.message);
          }
        }
      }

      try {
        if (fs.existsSync(targetDir)) {
          fse.removeSync(targetDir);
          console.log(`🗑️ Deleted current version directory due to error: ${targetDir}`);
        }
      } catch (err) {
        console.warn(`⚠️ Could not delete current version directory ${targetDir}:`, err.message);
      }
    }
  } finally {
    process.exit(1);
  }
}

await (async () => {
  try {
    const pkgPath = path.join(cwd, 'package.json');
    if (!fs.existsSync(pkgPath)) {
      throw new Error('package.json not found in current directory');
    }

    let pkg;
    try {
      pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    } catch (error) {
      throw new Error(`Error reading package.json: ${error.message}`);
    }

    const allDependencies = {
      ...(pkg.dependencies || {}),
      ...(pkg.devDependencies || {})
    };

    if (!Object.keys(allDependencies).includes('electron')) {
      throw new Error('electron dependency not found in package.json');
    }
  } catch (error) {
    await handleError(error);
  }
})();

let baseDir;
await (async () => {
  try {
    const homeDir = os.homedir();
    baseDir = path.join(homeDir, '.milkio-electron');
    fse.ensureDirSync(baseDir);
  } catch (error) {
    await handleError(new Error(`Error creating directory ${baseDir}: ${error.message}`));
  }
})();

let hash;
await (async () => {
  try {
    const hashGenerator = crypto.createHash('sha256');
    hashGenerator.update(cwd);
    hash = hashGenerator.digest('hex').slice(0, 16);
  } catch (error) {
    console.warn('⚠️ Error generating directory hash, using timestamp instead:', error.message);
    hash = Date.now().toString();
  }
})();

const hashDir = path.join(baseDir, hash);
targetDir = path.join(hashDir, startTime.toString());
await (async () => {
  try {
    fse.ensureDirSync(hashDir);
  } catch (error) {
    await handleError(new Error(`Error creating directory ${hashDir}: ${error.message}`));
  }
})();

await (async () => {
  currentDirCleanupNeeded = true;
  try {
    const projectConfigDir = path.join(cwd, '.milkio-electron');
    fse.ensureDirSync(projectConfigDir);
    const projectConfigPath = path.join(projectConfigDir, 'config.json');
    if (!fs.existsSync(projectConfigPath)) {
      fs.writeFileSync(projectConfigPath, JSON.stringify({
        entry: "./foo.js",
        bundlerOutDir: "./dist",
        packageJson: {
          version: "1.0.0",
          repository: {
            "type": "git",
            "url": "https://github.com/akirarika/milkio-electron.git"
          },
          author: "my",
          name: "my-electron-project",
          description: "This is My Electron Project, a simple application built with Electron.",
          scripts: {
            "build:mac": "electron-builder --mac",
            "build:win": "electron-builder --win",
            "build:linux": "electron-builder --linux",
          },
          build: {
            "appId": "com.example.electron",
            "copyright": "Your Copyright",
            "artifactName": "setup_${version}_${arch}.${ext}",
            "directories": {
              "output": "release"
            },
            "files": [
              "dist"
            ],
            "win": {
              "target": [
                {
                  "target": "nsis",
                  "arch": [
                    "x64"
                  ]
                }
              ],
              "icon": "icon.ico"
            },
            "nsis": {
              "oneClick": false,
              "perMachine": false,
              "allowToChangeInstallationDirectory": true,
              "deleteAppDataOnUninstall": false,
              "createDesktopShortcut": "always",
              "createStartMenuShortcut": true
            },
            "mac": {
              "target": [
                {
                  "target": "dmg",
                  "arch": [
                    "arm64"
                  ]
                },
                {
                  "target": "zip",
                  "arch": [
                    "arm64"
                  ]
                }
              ],
              "icon": "public/icon.png",
              "identity": "Your Identity",
              "gatekeeperAssess": false,
              "hardenedRuntime": false,
              "entitlements": null,
              "entitlementsInherit": null,
              "type": "development",
              "strictVerify": false,
              "sign": null,
              "forceCodeSigning": false
            },
            "dmg": {
              "sign": false,
              "contents": [
                {
                  "x": 140,
                  "y": 150,
                  "type": "file"
                },
                {
                  "x": 400,
                  "y": 150,
                  "type": "link",
                  "path": "/Applications"
                }
              ]
            },
            "linux": {
              "target": "AppImage",
              "icon": "icon.png"
            }
          },
          dependencies: {
          },
          devDependencies: {
            "electron": "37.2.3",
            "electron-builder": "26.0.12",
          }
        }
      }, null, 2));
      console.log('📝 Created project-level config file');

      const projectWorkflowsDir = path.join(projectConfigDir, '.github', 'workflows');
      fse.ensureDirSync(projectWorkflowsDir);
      const projectBuildYmlPath = path.join(projectWorkflowsDir, 'build.yml');

      const buildYmlContent = `
name: Build/release Electron app

on:
  push:
    branches:
      - main

jobs:
  release:
    runs-on: \${{ matrix.os }}

    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]

    steps:
      - name: Check out Git repository
        uses: actions/checkout@v3

      - name: Install Node.js
        uses: actions/setup-node@v3
        with:
          node-version: 16

      - name: Install Dependencies
        run: npm install

      - name: build-linux
        if: matrix.os == 'ubuntu-latest'
        run: npm run build:linux

      - name: build-mac
        if: matrix.os == 'macos-latest'
        run: npm run build:mac

      - name: build-win
        if: matrix.os == 'windows-latest'
        run: npm run build:win

      - name: release
        uses: softprops/action-gh-release@v1
        with:
          draft: true
          files: |
            release/*.exe
            release/*.zip
            release/*.dmg
            release/*.AppImage
            release/*.snap
            release/*.deb
            release/*.rpm
            release/*.tar.gz
            release/*.yml
            release/*.blockmap
        env:
          GITHUB_TOKEN: \${{ secrets.GH_TOKEN }}
      `.trim();
      fs.writeFileSync(projectBuildYmlPath, buildYmlContent, 'utf8');
      console.log('📝 Created default build.yml in project config directory');


      console.log('✅ The project initialization is complete. Please modify .milkio-electron/config.json and then run it again.');

      exit(0);
    } else {
      const items = fs.readdirSync(projectConfigDir);
      for (const item of items) {
        if (item === 'config.json') continue;

        const source = path.join(projectConfigDir, item);
        const dest = path.join(targetDir, item);

        if (fs.statSync(source).isDirectory()) {
          fse.copySync(source, dest, { recursive: true });
        } else {
          fse.copySync(source, dest);
        }

        console.log(`📝 Copied configuration: ${item}`);
      }
    }
  } catch (error) {
    await handleError(new Error(`Error copying files: ${error.message}`));
  }
})();

const publisherConfigJson = JSON.parse(fs.readFileSync(path.join(cwd, '.milkio-electron', 'config.json'), 'utf8'));
const distTarget = path.join(targetDir, 'dist');
fse.ensureDirSync(distTarget);
fse.copySync(path.join(cwd, publisherConfigJson.bundlerOutDir ?? "dist"), distTarget);
console.log(`📂 Copied dist files to: ${distTarget}`);

await (async () => {
  try {
    const packageJsonPath = path.join(targetDir, 'package.json');
    const erunPath = path.join(distTarget, '__ERUN__.mjs');
    const gitignorePath = path.join(targetDir, '.gitignore');

    baseDir = path.join(targetDir, '.github', 'workflows');
    fse.ensureDirSync(baseDir);

    if (fs.existsSync(packageJsonPath) || fs.existsSync(erunPath)) {
      throw new Error('The dist directory should not contain package.json or __ERUN__.mjs files. Please remove them from your dist directory.');
    }

    const packageJsonContent = {
      "type": "module",
      "main": "dist/__ERUN__.mjs",
    };
    fs.writeFileSync(packageJsonPath, JSON.stringify(deepmerge(publisherConfigJson.packageJson || {}, packageJsonContent)), 'utf8');

    const erunContent = `
import electron from 'electron';
globalThis.electron = electron;
await import('${publisherConfigJson.entry}');
`.trim();
    fs.writeFileSync(erunPath, erunContent, 'utf8');

    if (!fs.existsSync(gitignorePath)) {
      fs.writeFileSync(gitignorePath, 'node_modules\nout\ndist\n');
    }

    console.log('✅ Created package.json and dist/__ERUN__.mjs');
  } catch (error) {
    await handleError(error);
  }
})();

await (async () => {
  try {
    oldDirs = fs.readdirSync(hashDir)
      .map(dir => path.join(hashDir, dir))
      .filter(dir => {
        const isDir = fs.lstatSync(dir).isDirectory();
        return isDir && path.basename(dir) !== startTime.toString();
      });

    if (oldDirs.length >= 1) {
      const sortedDirs = oldDirs
        .map(dir => ({ path: dir, time: parseInt(path.basename(dir)) }))
        .sort((a, b) => b.time - a.time);

      if (sortedDirs.length > 0) {
        mostRecentDir = sortedDirs[0].path;

        ['node_modules', 'package-lock.json'].forEach(item => {
          const source = path.join(mostRecentDir, item);
          const dest = path.join(targetDir, item);

          if (fs.existsSync(source)) {
            try {
              fse.moveSync(source, dest, { overwrite: true });
              console.log(`♻️ Moved ${item} from previous version`);
            } catch (error) {
              console.warn(`⚠️ Could not move ${item}: ${error.message}`);
            }
          }
        });
      }
    }
  } catch (error) {
    await handleError(error);
  }
})();

await (async () => {
  try {
    console.log('⏳ Running npm install...');
    execFileSync('npm', ['install'], { cwd: targetDir, stdio: 'inherit' });
    console.log('✅ npm install completed successfully');
  } catch (error) {
    await handleError(new Error(`npm install failed: ${error.message}`));
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`✨ All tasks completed in ${totalTime} seconds`);

  execFileSync('npm', ['run', ...argv.slice(2)], { cwd: targetDir, stdio: 'inherit' });
})();

await (async () => {
  if (oldDirs.length > 0) {
    try {
      oldDirs.forEach(dir => {
        try {
          fse.removeSync(dir);
          console.log(`🗑️ Deleted old directory: ${dir}`);
        } catch (error) {
          console.warn(`⚠️ Could not delete old directory ${dir}:`, error.message);
        }
      });
    } catch (error) {
      console.warn('⚠️ Error during old version cleanup:', error.message);
    }
  }
})();

currentDirCleanupNeeded = false;