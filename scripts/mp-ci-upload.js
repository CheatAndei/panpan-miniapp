const fs = require('fs');
const path = require('path');

const appid = process.env.MP_APPID || 'wx77f8ea684b6420ca';
const root = path.resolve(__dirname, '..');
const projectPath = path.join(root, 'dist', 'build', 'mp-weixin');
const defaultKeyPath = path.resolve(root, '..', 'teach-miniapp', `private.${appid}.key`);
const privateKeyPath = process.env.MP_PRIVATE_KEY_PATH
  ? path.resolve(process.env.MP_PRIVATE_KEY_PATH)
  : defaultKeyPath;
const robot = Number(process.env.MP_ROBOT || 1);
const expectedApiBase = process.env.MP_EXPECTED_API_BASE || 'https://panpan.xpytt.com/api';
const checkOnly = process.argv.includes('--check');

function arg(name, fallback) {
  const prefix = `--${name}=`;
  const found = process.argv.find((item) => item.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function defaultVersion() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `1.${p(d.getMonth() + 1)}.${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}`;
}

function listJavaScriptFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const filePath = path.join(dir, entry.name);
    if (entry.isDirectory()) return listJavaScriptFiles(filePath);
    return entry.isFile() && entry.name.endsWith('.js') ? [filePath] : [];
  });
}

function verifyBuildTarget() {
  const projectConfigPath = path.join(projectPath, 'project.config.json');
  const projectConfig = JSON.parse(fs.readFileSync(projectConfigPath, 'utf8'));
  if (projectConfig.appid !== appid) {
    throw new Error(`Build AppID mismatch: expected ${appid}, got ${projectConfig.appid || 'empty'}.`);
  }

  const files = listJavaScriptFiles(projectPath);
  const localApiPattern = /https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?/i;
  const localFiles = [];
  let expectedApiFound = false;
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    if (localApiPattern.test(source)) localFiles.push(path.relative(projectPath, file));
    if (source.includes(expectedApiBase)) expectedApiFound = true;
  }
  if (localFiles.length > 0) {
    throw new Error(`Refusing to upload a localhost build. Found local API URL in: ${localFiles.join(', ')}`);
  }
  if (!expectedApiFound) {
    throw new Error(`Production API URL not found in build output: ${expectedApiBase}`);
  }
}

async function main() {
  if (!fs.existsSync(projectPath)) {
    throw new Error(`Missing build output: ${projectPath}. Run npm run build:mp first.`);
  }
  if (!fs.existsSync(path.join(projectPath, 'project.config.json'))) {
    throw new Error(`Missing project.config.json in ${projectPath}.`);
  }
  verifyBuildTarget();
  if (checkOnly) {
    console.log(JSON.stringify({ ok: true, appid, apiBase: expectedApiBase, projectPath }, null, 2));
    return;
  }
  if (!fs.existsSync(privateKeyPath)) {
    throw new Error(`Missing private key: ${privateKeyPath}`);
  }

  const ci = require('miniprogram-ci');
  const version = arg('version', process.env.MP_VERSION || defaultVersion());
  const desc = arg('desc', process.env.MP_DESC || 'Codex auto upload');
  const project = new ci.Project({
    appid,
    type: 'miniProgram',
    projectPath,
    privateKeyPath,
    ignores: ['node_modules/**/*'],
  });

  const result = await ci.upload({
    project,
    version,
    desc,
    robot,
    setting: { useProjectConfig: true },
    onProgressUpdate: (event) => {
      if (event && event.message) console.log(event.message);
    },
  });

  console.log(JSON.stringify({ ok: true, appid, version, desc, robot, result }, null, 2));
}

main().catch((error) => {
  console.error(error && error.message ? error.message : error);
  process.exit(1);
});
