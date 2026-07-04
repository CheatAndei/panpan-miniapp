const fs = require('fs');
const path = require('path');
const ci = require('miniprogram-ci');

const appid = process.env.MP_APPID || 'wx77f8ea684b6420ca';
const root = path.resolve(__dirname, '..');
const projectPath = path.join(root, 'dist', 'build', 'mp-weixin');
const defaultKeyPath = path.resolve(root, '..', 'teach-miniapp', `private.${appid}.key`);
const privateKeyPath = process.env.MP_PRIVATE_KEY_PATH
  ? path.resolve(process.env.MP_PRIVATE_KEY_PATH)
  : defaultKeyPath;
const robot = Number(process.env.MP_ROBOT || 1);

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

async function main() {
  if (!fs.existsSync(projectPath)) {
    throw new Error(`Missing build output: ${projectPath}. Run npm run build:mp first.`);
  }
  if (!fs.existsSync(path.join(projectPath, 'project.config.json'))) {
    throw new Error(`Missing project.config.json in ${projectPath}.`);
  }
  if (!fs.existsSync(privateKeyPath)) {
    throw new Error(`Missing private key: ${privateKeyPath}`);
  }

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
