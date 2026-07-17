const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const AdmZip = require('adm-zip');
const sharp = require('sharp');

const args = process.argv.slice(2);
function arg(name, fallback = '') {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}

const sourceRoot = path.resolve(arg('--source', process.env.EXAM_SOURCE_DIR || ''));
const manifestPath = path.resolve(arg('--exam-manifest', path.join(__dirname, '..', 'resources', 'exam-library-manifest.json')));
const outputRoot = path.resolve(arg('--output', path.join(__dirname, '..', 'resources', 'weekly-challenges')));
const targetPerType = Math.max(1, Number.parseInt(arg('--count', '20'), 10) || 20);
const typeLabels = { choice: '选择题', fill: '填空题', subjective: '解答题' };

function decodeXml(text) {
  return String(text || '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&amp;/g, '&').replace(/[\u200b-\u200f\ufeff]/g, '');
}

function docxParagraphs(file) {
  const xml = new AdmZip(file).readAsText('word/document.xml');
  return xml.split('</w:p>').map((part) => {
    const texts = [
      ...part.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g),
      ...part.matchAll(/<m:t(?:\s[^>]*)?>([\s\S]*?)<\/m:t>/g),
    ].map((match) => decodeXml(match[1]));
    const unsupported = /<w:object|<w:drawing|<v:shape/i.test(part) ? ' ⟦EMBEDDED_OBJECT⟧ ' : '';
    const table = /<w:tc[ >]|<w:tbl[ >]/i.test(part) ? ' ⟦TABLE_CONTENT⟧ ' : '';
    return `${unsupported}${table}${texts.join('')}`.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  }).filter(Boolean);
}

function sectionType(text) {
  if (/选择题/.test(text) && /[一1][、.．]/.test(text)) return 'choice';
  if (/填空题/.test(text) && /[二2][、.．]/.test(text)) return 'fill';
  if (/(解答题|计算题|应用题)/.test(text) && /[三四五345][、.．]/.test(text)) return 'subjective';
  return '';
}

function questionStart(text) {
  return String(text).match(/^(\d{1,2})\s*[．.、]\s*(.+)$/);
}

function cleanQuestion(lines) {
  return lines.join('\n').replace(/【(?:答案|分析|详解|解答|考点|专题|点评)】[\s\S]*$/, '')
    .replace(/版权所有/g, '').replace(/\n{3,}/g, '\n\n').trim();
}

function answerFrom(lines) {
  const marker = lines.findIndex((line) => /^【答案】/.test(line));
  if (marker < 0) return '';
  let direct = lines[marker].replace(/^【答案】\s*/, '').trim();
  if (!direct && lines[marker + 1] && !/^【/.test(lines[marker + 1])) direct = lines[marker + 1];
  const detailAt = lines.findIndex((line) => /^【(?:详解|解答)】/.test(line));
  const detail = detailAt >= 0
    ? lines.slice(detailAt, detailAt + 6).join('\n').replace(/^【(?:详解|解答)】\s*/, '').trim()
    : '';
  return [direct, detail].filter(Boolean).join('\n').slice(0, 900);
}

function usable(candidate) {
  const text = candidate.question;
  if (text.length < 18 || text.length > 900 || candidate.answer.length < 1) return false;
  if (/<w:|eqId|ObjectID|EMBEDDED_OBJECT|TABLE_CONTENT|答案待|略$|如图|图中|由图|看图|下图|示意图|数轴上/.test(text + candidate.answer)) return false;
  const meaningful = (value) => (String(value).match(/[\p{Script=Han}A-Za-z0-9＋+－﹣−×÷＝=]/gu) || []).length;
  if (meaningful(candidate.answer) < 2) return false;
  if (candidate.question_type === 'choice') {
    const options = text.match(/A[．.、]\s*([\s\S]+?)\s*B[．.、]\s*([\s\S]+?)\s*C[．.、]\s*([\s\S]+?)\s*D[．.、]\s*([\s\S]+)$/);
    return Boolean(options && options.slice(1).every((value) => meaningful(value) >= 1));
  }
  if (candidate.question_type === 'fill') {
    return meaningful(text) >= 16 && /_{2,}|\s{2,}|　|（\s*）|多少|求/.test(text);
  }
  if (meaningful(text) < 28 || meaningful(candidate.answer) < 12) return false;
  if (/解方程\s*[：:]?\s*(?:（\d+）\s*[；;.]?\s*)+$/.test(text)) return false;
  return /求|计算|解|证明|说明|表示|方案|问题|为什么|写出/.test(text);
}

function extractCandidates(file, paper) {
  let paragraphs;
  try { paragraphs = docxParagraphs(file); } catch { return []; }
  const candidates = [];
  let activeType = '';
  for (let index = 0; index < paragraphs.length; index += 1) {
    const heading = sectionType(paragraphs[index]);
    if (heading) { activeType = heading; continue; }
    const start = questionStart(paragraphs[index]);
    if (!start || !activeType) continue;
    const lines = [paragraphs[index]];
    let cursor = index + 1;
    while (cursor < paragraphs.length && !questionStart(paragraphs[cursor]) && !sectionType(paragraphs[cursor])) {
      lines.push(paragraphs[cursor]);
      cursor += 1;
      if (lines.length >= 28) break;
    }
    const candidate = {
      question_type: activeType,
      source_no: Number(start[1]),
      question: cleanQuestion(lines),
      answer: answerFrom(lines),
      source_label: paper.display_title,
      exam_stable_code: paper.stable_code,
    };
    if (usable(candidate)) candidates.push(candidate);
    index = Math.max(index, cursor - 1);
  }
  return candidates;
}

function answerDocx(paper) {
  const paperPath = path.join(sourceRoot, paper.source_relative_path);
  const dir = path.dirname(paperPath);
  const named = paper.answer?.name ? path.join(dir, paper.answer.name) : '';
  if (named && /\.docx$/i.test(named) && fs.existsSync(named)) return named;
  try {
    return fs.readdirSync(dir).filter((name) => /\.docx$/i.test(name) && /解析|答案|全解/i.test(name))
      .map((name) => path.join(dir, name))[0] || '';
  } catch { return ''; }
}

function charWidth(char) {
  return /[\x00-\xff]/.test(char) ? 0.56 : 1;
}

function wrapText(text, width = 31) {
  const output = [];
  for (const paragraph of String(text || '').split(/\n/)) {
    let line = '';
    let used = 0;
    for (const char of paragraph) {
      const next = charWidth(char);
      if (used + next > width && line) { output.push(line); line = ''; used = 0; }
      line += char;
      used += next;
    }
    if (line) output.push(line);
    if (!paragraph) output.push('');
  }
  return output;
}

function escapeXml(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function renderCard(item, kind, target) {
  const isAnswer = kind === 'answer';
  const body = isAnswer ? item.answer : item.question;
  const lines = wrapText(body, isAnswer ? 32 : 30).slice(0, isAnswer ? 24 : 28);
  const lineHeight = isAnswer ? 54 : 58;
  const height = Math.max(720, Math.min(1900, 390 + lines.length * lineHeight));
  const lineSvg = lines.map((line, index) => `<text x="70" y="${270 + index * lineHeight}" class="body">${escapeXml(line)}</text>`).join('');
  const svg = `<svg width="1080" height="${height}" viewBox="0 0 1080 ${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="1080" height="${height}" fill="#F6FAF8"/>
    <rect x="34" y="34" width="1012" height="${height - 68}" rx="32" fill="#FFFFFF" stroke="#DCE9E4" stroke-width="3"/>
    <rect x="70" y="68" width="180" height="54" rx="27" fill="${isAnswer ? '#FFF0D0' : '#DFF1EB'}"/>
    <text x="160" y="104" text-anchor="middle" class="tag" fill="${isAnswer ? '#7B570B' : '#246958'}">${isAnswer ? '教师答案' : typeLabels[item.question_type]}</text>
    <text x="70" y="172" class="title">${isAnswer ? '标准答案与要点' : '本周精选挑战'}</text>
    <line x1="70" y1="210" x2="1010" y2="210" stroke="#E5EEEB" stroke-width="2"/>
    ${lineSvg}
    <text x="70" y="${height - 74}" class="source">来源：${escapeXml(item.source_label.slice(0, 48))}</text>
    <style>.tag{font:700 27px 'Noto Sans SC','Microsoft YaHei',sans-serif}.title{font:800 40px 'Noto Sans SC','Microsoft YaHei',sans-serif;fill:#183A36}.body{font:500 ${isAnswer ? 31 : 33}px 'Noto Sans SC','Microsoft YaHei',sans-serif;fill:#233C37}.source{font:400 22px 'Noto Sans SC','Microsoft YaHei',sans-serif;fill:#7C8C87}</style>
  </svg>`;
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(target);
}

async function main() {
  if (!sourceRoot || !fs.existsSync(sourceRoot)) throw new Error(`试卷源目录不存在：${sourceRoot}`);
  const examManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const selected = { choice: [], fill: [], subjective: [] };
  const seen = new Set();
  for (const paper of examManifest.papers || []) {
    if (Object.values(selected).every((items) => items.length >= targetPerType)) break;
    const answerFile = answerDocx(paper);
    if (!answerFile) continue;
    const usedInPaper = new Set();
    for (const candidate of extractCandidates(answerFile, paper)) {
      if (selected[candidate.question_type].length >= targetPerType || usedInPaper.has(candidate.question_type)) continue;
      const signature = crypto.createHash('sha256').update(candidate.question.replace(/\s/g, '')).digest('hex');
      if (seen.has(signature)) continue;
      seen.add(signature);
      usedInPaper.add(candidate.question_type);
      selected[candidate.question_type].push({ ...candidate, signature });
    }
  }
  const counts = Object.fromEntries(Object.entries(selected).map(([key, rows]) => [key, rows.length]));
  if (Object.values(counts).some((count) => count < targetPerType)) throw new Error(`可用题目不足：${JSON.stringify(counts)}`);
  fs.mkdirSync(outputRoot, { recursive: true });
  const questions = [];
  for (const [type, rows] of Object.entries(selected)) {
    const typeDir = path.join(outputRoot, type);
    fs.mkdirSync(typeDir, { recursive: true });
    for (let index = 0; index < rows.length; index += 1) {
      const item = rows[index];
      const serial = String(index + 1).padStart(2, '0');
      const questionRelative = `${type}/${serial}-question.png`;
      const answerRelative = `${type}/${serial}-answer.png`;
      await renderCard(item, 'question', path.join(outputRoot, questionRelative));
      await renderCard(item, 'answer', path.join(outputRoot, answerRelative));
      questions.push({
        source_key: `gz7-weekly-${type}-${serial}-${item.signature.slice(0, 10)}`,
        question_type: type,
        title: `${typeLabels[type]} · 广州真题精选 ${serial}`,
        question_image: questionRelative.replace(/\\/g, '/'),
        answer_image: answerRelative.replace(/\\/g, '/'),
        answer_text: item.answer.slice(0, 500),
        source_label: item.source_label,
        exam_stable_code: item.exam_stable_code,
        source_question_no: item.source_no,
        signature: item.signature,
      });
    }
  }
  const manifest = { generated_at: new Date().toISOString(), source: 'teacher_provided_guangzhou_exam_library', counts, questions };
  fs.writeFileSync(path.join(outputRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(JSON.stringify({ ok: true, output: outputRoot, counts, images: questions.length * 2 }));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
