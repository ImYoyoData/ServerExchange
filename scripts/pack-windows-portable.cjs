/**
 * Windows production portable package based on `dist/`.
 *
 * Layout (same idea as Docker: run from built output):
 *   release/ServerExchange-portable/
 *     node.exe              # embedded Node runtime
 *     src/main.js           # from dist/
 *     config.production.json5
 *     package.json
 *     node_modules/
 *     data/app.db
 *     public/
 *     start.bat             # NODE_ENV=production && node.exe src/main.js
 *
 * Usage:
 *   pnpm run pack:win
 *   node scripts/pack-windows-portable.cjs
 *
 * Node runtime cache (skip re-download / re-extract):
 *   release/.cache/node-vXX.XX.X-win-x64.zip
 *   release/.cache/node-vXX.XX.X-win-x64/   # extracted; reused next time
 * Force re-extract: FORCE_NODE_EXTRACT=1 pnpm pack:win
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { execSync } = require('child_process');
const { createWriteStream } = require('fs');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'release', 'ServerExchange-portable');
const cacheDir = path.join(root, 'release', '.cache');
const NODE_VERSION = process.env.PORTABLE_NODE_VERSION || 'v22.17.0';
const nodeZipName = `node-${NODE_VERSION}-win-x64.zip`;
const nodeZipUrl = `https://nodejs.org/dist/${NODE_VERSION}/${nodeZipName}`;
const nodeZipPath = path.join(cacheDir, nodeZipName);

function log(msg) {
  console.log(`[pack] ${msg}`);
}

function rimraf(p) {
  fs.rmSync(p, { recursive: true, force: true });
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function copyRecursive(src, dest) {
  const st = fs.statSync(src);
  if (st.isDirectory()) {
    ensureDir(dest);
    for (const name of fs.readdirSync(src)) {
      if (name === 'tsconfig.build.tsbuildinfo') continue;
      copyRecursive(path.join(src, name), path.join(dest, name));
    }
  } else {
    ensureDir(path.dirname(dest));
    fs.copyFileSync(src, dest);
  }
}

function downloadOnce(url, dest) {
  return new Promise((resolve, reject) => {
    ensureDir(path.dirname(dest));
    if (fs.existsSync(dest)) fs.unlinkSync(dest);
    const file = createWriteStream(dest);
    const getter = url.startsWith('https') ? https : http;
    const req = getter.get(url, { timeout: 60000 }, (res) => {
      if (
        res.statusCode >= 300 &&
        res.statusCode < 400 &&
        res.headers.location
      ) {
        file.close();
        try {
          fs.unlinkSync(dest);
        } catch {
          // ignore
        }
        downloadOnce(res.headers.location, dest).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) {
        file.close();
        try {
          fs.unlinkSync(dest);
        } catch {
          // ignore
        }
        reject(new Error(`download failed ${res.statusCode} ${url}`));
        return;
      }
      res.pipe(file);
      file.on('finish', () => {
        file.close(() => {
          if (!fs.existsSync(dest) || fs.statSync(dest).size < 1000) {
            reject(new Error(`download incomplete: ${dest}`));
            return;
          }
          resolve();
        });
      });
    });
    req.on('timeout', () => {
      req.destroy(new Error('download timeout'));
    });
    req.on('error', (err) => {
      try {
        file.close();
        fs.unlinkSync(dest);
      } catch {
        // ignore
      }
      reject(err);
    });
  });
}

function downloadViaPowershell(url, dest) {
  ensureDir(path.dirname(dest));
  if (fs.existsSync(dest)) fs.unlinkSync(dest);
  // Uses Windows system proxy (often 127.0.0.1:7897), more reliable than bare https.get
  const ps = `
$ProgressPreference='SilentlyContinue'
Invoke-WebRequest -Uri '${url.replace(/'/g, "''")}' -OutFile '${dest.replace(/'/g, "''")}' -UseBasicParsing -TimeoutSec 120
`;
  execSync(`powershell -NoProfile -Command "${ps.replace(/\n/g, '; ')}"`, {
    stdio: 'inherit',
  });
  if (!fs.existsSync(dest) || fs.statSync(dest).size < 1000) {
    throw new Error(`powershell download incomplete: ${dest}`);
  }
}

async function download(url, dest, retries = 3) {
  let lastErr;
  for (let i = 1; i <= retries; i++) {
    try {
      log(`download try ${i}/${retries}: ${url}`);
      await downloadOnce(url, dest);
      return;
    } catch (e) {
      lastErr = e;
      log(`https.get failed: ${e.message || e}`);
    }
  }
  try {
    log('fallback: PowerShell Invoke-WebRequest (system proxy)');
    downloadViaPowershell(url, dest);
    return;
  } catch (e) {
    lastErr = e;
  }
  throw lastErr;
}

function findCachedPrebuild(ver, abi) {
  const patterns = [
    `better-sqlite3-v${ver}-node-v${abi}-win32-x64.tar.gz`,
    `better-sqlite3-${ver}-${abi}.tar.gz`,
    `better-sqlite3-${ver}-node-v${abi}-win32-x64.tar.gz`,
  ];
  if (!fs.existsSync(cacheDir)) return null;
  for (const name of patterns) {
    const p = path.join(cacheDir, name);
    if (fs.existsSync(p) && fs.statSync(p).size > 1000) return p;
  }
  // fuzzy: any file containing ver + abi and size ok
  for (const name of fs.readdirSync(cacheDir)) {
    if (
      name.includes(ver) &&
      name.includes(String(abi)) &&
      name.endsWith('.tar.gz')
    ) {
      const p = path.join(cacheDir, name);
      if (fs.statSync(p).size > 1000) return p;
    }
  }
  return null;
}

function betterSqliteWorks(nodeExe, cwd) {
  try {
    execSync(
      `"${nodeExe}" -e "require('better-sqlite3')(':memory:').prepare('select 1').get()"`,
      { cwd, stdio: 'ignore', shell: true },
    );
    return true;
  } catch {
    return false;
  }
}

function run(cmd, opts = {}) {
  log(cmd);
  execSync(cmd, {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, ...opts.env },
    shell: true,
  });
}

/** 确保 host 侧 better-sqlite3 原生模块可用（供 import-sys-sql 使用） */
function ensureBetterSqlite3Native() {
  try {
    // eslint-disable-next-line import/no-extraneous-dependencies
    require('better-sqlite3');
    log('better-sqlite3 (host) OK');
    return;
  } catch (err) {
    log(`better-sqlite3 (host) missing native binding: ${err.message}`);
  }

  log('rebuild better-sqlite3 for host Node');
  try {
    run('pnpm rebuild better-sqlite3');
  } catch {
    // 部分环境 rebuild 不够，再走包内 prebuild-install
    const pkgDir = path.join(
      root,
      'node_modules',
      'better-sqlite3',
    );
    if (fs.existsSync(pkgDir)) {
      run('npm run install --prefix node_modules/better-sqlite3', {
        env: { npm_config_build_from_source: 'false' },
      });
    } else {
      throw new Error(
        'better-sqlite3 package not found; run pnpm install first',
      );
    }
  }

  try {
    require('better-sqlite3');
    log('better-sqlite3 (host) OK after rebuild');
  } catch (err) {
    throw new Error(
      `better-sqlite3 still unusable after rebuild: ${err.message}`,
    );
  }
}

function extractZip(zipPath, dest) {
  ensureDir(dest);
  execSync(
    `powershell -NoProfile -Command "Expand-Archive -Path '${zipPath.replace(/'/g, "''")}' -DestinationPath '${dest.replace(/'/g, "''")}' -Force"`,
    { stdio: 'inherit' },
  );
}

async function main() {
  // 必须先编 admin-web：否则 public/admin 可能仍是旧包（曾写死 127.0.0.1:3000）
  // Windows 下 admin-web 的 "NODE_OPTIONS=..." 脚本语法会失败，故直接调 vite 并注入环境变量
  log('1) build admin-web -> public/admin');
  run('pnpm --dir admin-web exec vite build --mode production', {
    env: {
      NODE_ENV: 'production',
      NODE_OPTIONS: '--max-old-space-size=8192',
    },
  });
  log('1b) nest build -> dist/');
  run('pnpm run build', { env: { NODE_ENV: 'production' } });

  // import 脚本依赖本机 node_modules 里的 better-sqlite3 原生绑定
  // CI（pnpm 默认可能跳过 build scripts）下常见缺 .node，先确保可用
  ensureBetterSqlite3Native();

  if (!fs.existsSync(path.join(root, 'data', 'app.db'))) {
    log('2) import sys.sql -> data/app.db');
    run('node scripts/import-sys-sql-to-sqlite.cjs');
  } else {
    log('2) data/app.db exists, skip import');
  }

  log('3) prepare output = dist contents + node.exe');
  rimraf(outDir);
  ensureDir(outDir);
  ensureDir(cacheDir);

  // Copy entire dist into package root (start from here)
  copyRecursive(path.join(root, 'dist'), outDir);

  // Ensure production config / env at package root
  fs.copyFileSync(
    path.join(root, 'config.production.json5'),
    path.join(outDir, 'config.production.json5'),
  );
  if (fs.existsSync(path.join(root, '.env'))) {
    fs.copyFileSync(path.join(root, '.env'), path.join(outDir, '.env'));
  }

  ensureDir(path.join(outDir, 'data'));
  fs.copyFileSync(
    path.join(root, 'data', 'app.db'),
    path.join(outDir, 'data', 'app.db'),
  );
  ensureDir(path.join(outDir, '.cache'));

  // Slim package.json for prod install (overwrite dist copy)
  const pkg = JSON.parse(
    fs.readFileSync(path.join(root, 'package.json'), 'utf8'),
  );
  fs.writeFileSync(
    path.join(outDir, 'package.json'),
    JSON.stringify(
      {
        name: pkg.name,
        version: pkg.version,
        private: true,
        dependencies: pkg.dependencies,
      },
      null,
      2,
    ),
    'utf8',
  );

  if (!fs.existsSync(nodeZipPath)) {
    log(`4) download Node ${NODE_VERSION}`);
    await download(nodeZipUrl, nodeZipPath);
  } else {
    log(`4) reuse cached ${nodeZipName}`);
  }

  // 解压结果缓存在 release/.cache/node-vXX-win-x64/，下次打包直接复用
  const extractedNodeDir = path.join(
    cacheDir,
    `node-${NODE_VERSION}-win-x64`,
  );
  const legacyExtractDir = path.join(
    cacheDir,
    `node-extract-${NODE_VERSION}`,
    `node-${NODE_VERSION}-win-x64`,
  );
  // 兼容旧缓存目录：迁到稳定路径，避免再解压一次
  if (
    !fs.existsSync(extractedNodeDir) &&
    fs.existsSync(path.join(legacyExtractDir, 'node.exe'))
  ) {
    log(`4b) migrate legacy extract -> ${extractedNodeDir}`);
    fs.renameSync(legacyExtractDir, extractedNodeDir);
    rimraf(path.join(cacheDir, `node-extract-${NODE_VERSION}`));
  }
  const nodeSrc = path.join(extractedNodeDir, 'node.exe');
  const npmCli = path.join(
    extractedNodeDir,
    'node_modules',
    'npm',
    'bin',
    'npm-cli.js',
  );
  const forceExtract = process.env.FORCE_NODE_EXTRACT === '1';
  const nodeReady =
    !forceExtract && fs.existsSync(nodeSrc) && fs.existsSync(npmCli);

  if (nodeReady) {
    log(`4b) reuse extracted Node at ${extractedNodeDir}`);
  } else {
    if (forceExtract) log('4b) FORCE_NODE_EXTRACT=1, re-extract Node');
    else log(`4b) extract Node -> ${extractedNodeDir}`);
    // zip 根目录是 node-vXX-win-x64/，先解到临时目录再挪成稳定缓存路径
    const extractTmp = path.join(cacheDir, `node-extract-tmp-${NODE_VERSION}`);
    rimraf(extractTmp);
    rimraf(extractedNodeDir);
    extractZip(nodeZipPath, extractTmp);
    const unzipped = path.join(extractTmp, `node-${NODE_VERSION}-win-x64`);
    if (!fs.existsSync(path.join(unzipped, 'node.exe'))) {
      throw new Error(`node.exe not found under ${unzipped}`);
    }
    fs.renameSync(unzipped, extractedNodeDir);
    rimraf(extractTmp);
  }

  if (!fs.existsSync(nodeSrc)) {
    throw new Error(`node.exe not found under ${extractedNodeDir}`);
  }
  if (!fs.existsSync(npmCli)) {
    throw new Error('portable node missing npm-cli.js');
  }
  // Put node.exe at package root (alongside src/)
  fs.copyFileSync(nodeSrc, path.join(outDir, 'node.exe'));

  log('5) npm install --omit=dev inside package (using embedded node)');
  const nodeExe = path.join(outDir, 'node.exe');
  execSync(`"${nodeExe}" "${npmCli}" install --omit=dev --no-fund --no-audit`, {
    cwd: outDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      npm_config_ignore_scripts: 'false',
    },
    shell: true,
  });

  // Align better-sqlite3 to embedded Node ABI (skip if already works)
  const abi = execSync(`"${nodeExe}" -p "process.versions.modules"`, {
    encoding: 'utf8',
    shell: true,
  }).trim();
  const bsqlPkg = path.join(outDir, 'node_modules', 'better-sqlite3');
  if (!fs.existsSync(bsqlPkg)) {
    throw new Error('better-sqlite3 not installed in package');
  }
  const ver = JSON.parse(
    fs.readFileSync(path.join(bsqlPkg, 'package.json'), 'utf8'),
  ).version;

  if (betterSqliteWorks(nodeExe, outDir)) {
    log(`better-sqlite3 already OK for ABI ${abi}`);
  } else {
    const prebuildUrl = `https://github.com/WiseLibs/better-sqlite3/releases/download/v${ver}/better-sqlite3-v${ver}-node-v${abi}-win32-x64.tar.gz`;
    let tarPath = findCachedPrebuild(ver, abi);
    const preferred = path.join(
      cacheDir,
      `better-sqlite3-v${ver}-node-v${abi}-win32-x64.tar.gz`,
    );
    if (tarPath) {
      log(`reuse cached prebuild: ${path.basename(tarPath)}`);
    } else {
      // remove broken 0-byte placeholder
      if (fs.existsSync(preferred) && fs.statSync(preferred).size < 1000) {
        fs.unlinkSync(preferred);
      }
      tarPath = preferred;
      log(`fetch better-sqlite3 prebuild ABI ${abi}`);
      await download(prebuildUrl, tarPath);
    }
    execSync(`tar -xzf "${tarPath}" -C "${bsqlPkg}"`, {
      stdio: 'inherit',
      shell: true,
    });
    if (!betterSqliteWorks(nodeExe, outDir)) {
      throw new Error(
        `better-sqlite3 still broken after prebuild (ABI ${abi}). Check network/proxy and retry.`,
      );
    }
    log('better-sqlite3 ok');
  }

  log('6) write start.bat / start.ps1');
  const startBat = `@echo off
chcp 65001 >nul
cd /d "%~dp0"
set NODE_ENV=production
echo Starting ServerExchange (production / dist)...
echo Open http://localhost:8080 after startup
"%~dp0node.exe" "src\\main.js"
if errorlevel 1 pause
`;
  fs.writeFileSync(path.join(outDir, 'start.bat'), startBat, 'utf8');

  const startPs1 = `$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$env:NODE_ENV = 'production'
& "$PSScriptRoot\\node.exe" "$PSScriptRoot\\src\\main.js"
`;
  fs.writeFileSync(path.join(outDir, 'start.ps1'), startPs1, 'utf8');

  const readme =
    'ServerExchange Windows Portable (production)\r\n' +
    '\r\n' +
    'Layout = dist/ + node.exe\r\n' +
    '1. Double-click start.bat\r\n' +
    '2. Open http://localhost:8080\r\n' +
    '3. Default admin: admin / admin123\r\n' +
    '\r\n' +
    'Start command equivalent:\r\n' +
    '  set NODE_ENV=production\r\n' +
    '  node.exe src\\main.js\r\n';
  fs.writeFileSync(path.join(outDir, 'README.txt'), readme, 'utf8');

  if (!fs.existsSync(path.join(outDir, 'src', 'main.js'))) {
    throw new Error('pack incomplete: src/main.js missing (dist build?)');
  }

  log(`done: ${outDir}`);
  log('start with: start.bat  (uses .\\node.exe src\\main.js)');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
