const fs = require('node:fs');
const path = require('node:path');

const moduleRoot = process.env.CODEX_NODE_MODULES;
if (!moduleRoot) {
  throw new Error('请设置 CODEX_NODE_MODULES 为工作区依赖的 node_modules 路径');
}

const { marked } = require(path.join(moduleRoot, 'marked'));
const { chromium } = require(path.join(moduleRoot, 'playwright'));

const root = path.resolve(__dirname, '..');
const manualsDir = path.join(root, 'docs', 'manuals');
const manuals = ['教师使用说明书', '家长使用说明书'];

function inlineImages(html) {
  return html.replace(/src="([^"]+)"/g, (whole, src) => {
    if (/^(data:|https?:)/.test(src)) return whole;
    const file = path.resolve(manualsDir, decodeURIComponent(src));
    if (!fs.existsSync(file)) return whole;
    const ext = path.extname(file).slice(1).toLowerCase();
    const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';
    return `src="data:${mime};base64,${fs.readFileSync(file).toString('base64')}"`;
  });
}

function documentHtml(markdown) {
  const body = inlineImages(marked.parse(markdown));
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><style>
    @page { size: A4; margin: 15mm 16mm 17mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #17332f; font-family: "Microsoft YaHei", "PingFang SC", sans-serif; font-size: 10.5pt; line-height: 1.72; }
    h1 { margin: 0 0 6mm; color: #173f39; font-size: 24pt; line-height: 1.25; letter-spacing: .5pt; }
    h2 { margin: 8mm 0 3mm; padding: 2.5mm 4mm; color: #fff; background: #173f39; border-radius: 3mm; font-size: 15pt; line-height: 1.35; break-after: avoid; }
    h3 { margin: 6mm 0 2mm; color: #2f7d6b; font-size: 12pt; break-after: avoid; }
    p { margin: 0 0 3mm; }
    ul, ol { margin: 0 0 3mm; padding-left: 7mm; }
    li { margin: 1.2mm 0; }
    blockquote { margin: 4mm 0; padding: 3mm 4mm; color: #365b54; background: #e9f4f0; border-left: 1.5mm solid #2f7d6b; border-radius: 2mm; }
    blockquote p { margin: 0; }
    code { padding: .4mm 1.2mm; color: #b33d34; background: #fff0ec; border-radius: 1mm; font-family: Consolas, monospace; }
    img { display: block; width: 72mm; max-width: 100%; height: auto; margin: 4mm auto 6mm; border: .35mm solid #dce8e4; border-radius: 3mm; box-shadow: 0 2mm 6mm rgba(23,63,57,.10); break-inside: avoid; }
    strong { color: #173f39; }
    hr { border: 0; border-top: .3mm solid #dce8e4; }
  </style></head><body>${body}</body></html>`;
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.MANUAL_BROWSER_PATH || undefined,
  });
  try {
    for (const name of manuals) {
      const markdownPath = path.join(manualsDir, `${name}.md`);
      const pdfPath = path.join(manualsDir, `${name}.pdf`);
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      await page.setContent(documentHtml(fs.readFileSync(markdownPath, 'utf8')), { waitUntil: 'load' });
      await page.pdf({ path: pdfPath, format: 'A4', printBackground: true, preferCSSPageSize: true });
      await page.close();
      process.stdout.write(`${path.relative(root, pdfPath)}\n`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
