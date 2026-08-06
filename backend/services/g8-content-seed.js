const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const fontkit = require('fontkit');
const { EXAM_LIBRARY_DIR, ensureExamLibraryDir } = require('../utils/exam-files');
const { choices, terminals } = require('../resources/g8-content/bank');
const { topics } = require('../resources/g8-content/topics');
const { assertG8ContentBank } = require('./g8-content-audit');
const { replaceQuestionTopics } = require('./content-progress');
const { sanitizeChoiceExplanation } = require('../utils/choice-explanation');

const RENDER_VERSION = 'g8-card-v3';
const TOPIC_BY_KEY = new Map(topics.map((topic) => [topic.topic_key, topic]));
let fontCatalog;
const fontFileCache = new Map();
const glyphCache = new Map();

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function wrapText(value, width = 25) {
  const chars = Array.from(String(value || '').trim());
  const lines = [];
  let line = '';
  for (const char of chars) {
    line += char;
    if (line.length >= width || (line.length >= width - 5 && /[，。；：！？,.!?]/u.test(char))) {
      lines.push(line);
      line = '';
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

function parseUnicodeRanges(value) {
  return String(value || '').split(',').map((part) => {
    const [start, end] = part.trim().replace(/^U\+/i, '').split('-').map((hex) => parseInt(hex, 16));
    return [start, end || start];
  });
}

function loadFontCatalog() {
  if (fontCatalog) return fontCatalog;
  const packageDir = path.dirname(require.resolve('@fontsource/noto-sans-sc/package.json'));
  const unicode = JSON.parse(fs.readFileSync(path.join(packageDir, 'unicode.json'), 'utf8'));
  fontCatalog = Object.entries(unicode).map(([rawKey, unicodeRange]) => ({
    subset: rawKey.replace(/[\[\]]/g, ''),
    unicodeRange,
    ranges: parseUnicodeRanges(unicodeRange),
    packageDir,
  }));
  return fontCatalog;
}

function fontEntryForCode(code) {
  const catalog = loadFontCatalog();
  return catalog.find((entry) => entry.ranges.some(([start, end]) => code >= start && code <= end)) || null;
}

function glyphForCharacter(character) {
  const code = character.codePointAt(0);
  const entry = fontEntryForCode(code);
  if (!entry) return null;
  const cacheKey = `${entry.subset}:${code}`;
  if (glyphCache.has(cacheKey)) return glyphCache.get(cacheKey);
  if (!fontFileCache.has(entry.subset)) {
    const file = path.join(entry.packageDir, 'files', `noto-sans-sc-${entry.subset}-400-normal.woff`);
    fontFileCache.set(entry.subset, fontkit.openSync(file));
  }
  const font = fontFileCache.get(entry.subset);
  const glyph = font.glyphForCodePoint(code);
  const result = {
    path: glyph.path.toSVG(),
    advanceWidth: glyph.advanceWidth,
    unitsPerEm: font.unitsPerEm,
  };
  glyphCache.set(cacheKey, result);
  return result;
}

function pathText(value, x, y, fontSize, fill = '#24344D') {
  let cursor = 0;
  let paths = '';
  for (const character of Array.from(String(value || ''))) {
    if (character === ' ') {
      cursor += fontSize * 0.45;
      continue;
    }
    const glyph = glyphForCharacter(character);
    if (!glyph) {
      paths += `<text x="${x + cursor}" y="${y}" font-size="${fontSize}" fill="${fill}">${escapeXml(character)}</text>`;
      cursor += fontSize * 0.7;
      continue;
    }
    const scale = fontSize / glyph.unitsPerEm;
    paths += `<path d="${glyph.path}" transform="translate(${x + cursor} ${y}) scale(${scale} ${-scale})"/>`;
    cursor += glyph.advanceWidth * scale;
  }
  return {
    width: cursor,
    svg: `<g fill="${fill}">${paths}</g>`,
  };
}

function diagramSvg(type) {
  if (type === 'symmetry') {
    return `<g transform="translate(0,18)">
      <line x1="450" y1="720" x2="450" y2="1010" stroke="#527CC9" stroke-width="5" stroke-dasharray="12 10"/>
      <circle cx="310" cy="850" r="12" fill="#E98577"/><circle cx="590" cy="850" r="12" fill="#E98577"/>
      <line x1="310" y1="850" x2="590" y2="850" stroke="#90A4C4" stroke-width="4"/>
      <text x="285" y="825">A</text><text x="600" y="825">A&apos;</text><text x="466" y="745">l</text>
    </g>`;
  }
  if (type === 'parallel') {
    return `<g transform="translate(0,10)">
      <line x1="180" y1="780" x2="720" y2="780" stroke="#315EA8" stroke-width="6"/>
      <line x1="180" y1="970" x2="720" y2="970" stroke="#315EA8" stroke-width="6"/>
      <polyline points="270,720 430,880 640,1030" fill="none" stroke="#E98577" stroke-width="7"/>
      <path d="M410 861 A42 42 0 0 1 454 839" fill="none" stroke="#E98577" stroke-width="4"/>
      <text x="195" y="756">l₁</text><text x="195" y="946">l₂</text>
    </g>`;
  }
  if (type === 'one-line') {
    return `<g>
      <line x1="150" y1="950" x2="750" y2="950" stroke="#315EA8" stroke-width="6"/>
      <line x1="450" y1="950" x2="270" y2="720" stroke="#E98577" stroke-width="6"/>
      <line x1="450" y1="950" x2="610" y2="700" stroke="#E98577" stroke-width="6"/>
      <text x="130" y="985">A</text><text x="438" y="985">O</text><text x="760" y="985">B</text>
      <text x="245" y="705">C</text><text x="615" y="690">D</text>
    </g>`;
  }
  if (type === 'rotation') {
    return `<g>
      <line x1="450" y1="860" x2="280" y2="700" stroke="#315EA8" stroke-width="6"/>
      <line x1="450" y1="860" x2="620" y2="700" stroke="#315EA8" stroke-width="6"/>
      <line x1="450" y1="860" x2="650" y2="1010" stroke="#E98577" stroke-width="6"/>
      <line x1="450" y1="860" x2="250" y2="1010" stroke="#E98577" stroke-width="6"/>
      <line x1="280" y1="700" x2="650" y2="1010" stroke="#90A4C4" stroke-width="4"/>
      <line x1="620" y1="700" x2="250" y2="1010" stroke="#90A4C4" stroke-width="4"/>
      <text x="438" y="850">O</text><text x="250" y="680">A</text><text x="625" y="680">B</text>
      <text x="665" y="1030">C</text><text x="220" y="1030">D</text>
    </g>`;
  }
  if (type === 'algebra') {
    return `<g>
      <rect x="180" y="760" width="540" height="250" rx="24" fill="#F4F8FD" stroke="#BFD0EC" stroke-width="4"/>
      <line x1="230" y1="835" x2="670" y2="835" stroke="#D5E0F0" stroke-width="3"/>
      <line x1="230" y1="900" x2="610" y2="900" stroke="#D5E0F0" stroke-width="3"/>
      <line x1="230" y1="965" x2="640" y2="965" stroke="#D5E0F0" stroke-width="3"/>
      ${pathText('整式计算区', 230, 815, 25, '#315EA8').svg}
    </g>`;
  }
  return `<g>
    <polygon points="450,700 235,990 690,990" fill="#F4F8FD" stroke="#315EA8" stroke-width="6"/>
    <line x1="450" y1="700" x2="465" y2="990" stroke="#E98577" stroke-width="5" stroke-dasharray="12 10"/>
    <text x="435" y="675">A</text><text x="205" y="1025">B</text><text x="700" y="1025">C</text>
    <text x="472" y="1025">M</text>
  </g>`;
}

function renderQuestionCardSvg(item) {
  const topic = TOPIC_BY_KEY.get(item.topic_key);
  const lines = wrapText(item.prompt, 24).slice(0, 9);
  const textLines = lines.map((line, index) => pathText(line, 82, 285 + index * 55, 34).svg).join('');
  const typeLabel = item.question_type === 'fill' ? '压轴填空' : '压轴解答';
  const typeColor = item.question_type === 'fill' ? '#315EA8' : '#D66D62';
  const topicTitle = pathText(topic?.short_title || item.title, 82, 196, 34);
  const typeTitle = pathText(typeLabel, 106, 128, 22, typeColor);
  const footer = pathText('原创改编 · 示意图不按比例', 82, 1090, 22, '#6B7890');
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200" viewBox="0 0 900 1200">
    <style>
      text{font-family:'DejaVu Sans',sans-serif;fill:#24344D}
      .small{font-size:22px}
    </style>
    <rect width="900" height="1200" fill="#FFFFFF"/>
    <rect x="0" y="0" width="900" height="18" fill="#315EA8"/>
    <rect x="58" y="65" width="784" height="1070" rx="28" fill="#FFFFFF" stroke="#D5E0F0" stroke-width="4"/>
    <rect x="82" y="95" width="140" height="48" rx="24" fill="${item.question_type === 'fill' ? '#EAF2FF' : '#FFF0ED'}"/>
    ${typeTitle.svg}
    ${topicTitle.svg}
    <line x1="82" y1="226" x2="818" y2="226" stroke="#D5E0F0" stroke-width="3"/>
    ${textLines}
    ${diagramSvg(item.diagram)}
    ${footer.svg}
    <text x="818" y="1090" class="small" text-anchor="end" fill="#6B7890">${escapeXml(item.source_key)}</text>
  </svg>`);
}

function expectedStorageKey(item) {
  const sourceDigest = sha256(JSON.stringify({
    render_version: RENDER_VERSION,
    source_key: item.source_key,
    title: item.title,
    prompt: item.prompt,
    diagram: item.diagram,
  }));
  return `weekly/question/g8-original/${sourceDigest}.webp`;
}

async function renderMissingTerminalAssets(db) {
  const prepared = new Map();
  const missing = [];
  for (const item of terminals) {
    const storageKey = expectedStorageKey(item);
    const existing = db.get(`SELECT a.id,a.storage_key FROM weekly_challenge_questions q
      JOIN exam_assets a ON a.id=q.question_asset_id WHERE q.source_key=?`, [item.source_key]);
    const target = path.join(EXAM_LIBRARY_DIR, storageKey);
    if (existing?.storage_key === storageKey && fs.existsSync(target)) {
      prepared.set(item.source_key, { assetId: Number(existing.id), storageKey });
    } else {
      missing.push({ item, storageKey });
    }
  }
  const concurrency = 8;
  for (let start = 0; start < missing.length; start += concurrency) {
    const batch = missing.slice(start, start + concurrency);
    const rendered = await Promise.all(batch.map(async ({ item, storageKey }) => ({
      item,
      storageKey,
      buffer: await sharp(renderQuestionCardSvg(item))
        .webp({ quality: 90, effort: 4 })
        .toBuffer(),
    })));
    for (const value of rendered) prepared.set(value.item.source_key, value);
  }
  return { prepared, rendered: missing.length, reused: terminals.length - missing.length };
}

async function seedG8Content(db) {
  const audit = assertG8ContentBank();
  ensureExamLibraryDir();
  const assets = await renderMissingTerminalAssets(db);
  let seededChoices = 0;
  let seededTerminals = 0;
  let deactivated = 0;
  db.transaction(() => {
    const activeChoiceCodes = new Set();
    for (const item of choices) {
      db.run(`INSERT INTO choice_king_questions
        (stable_code,stem,options_json,correct_option,explanation,source_label,
          grade_code,subject_code,topic_key,difficulty,is_active)
        VALUES(?,?,?,?,?,?,'g8','math',?,?,1)
        ON CONFLICT(stable_code) DO UPDATE SET
          stem=excluded.stem,options_json=excluded.options_json,
          correct_option=excluded.correct_option,explanation=excluded.explanation,
          source_label=excluded.source_label,grade_code='g8',subject_code='math',
          topic_key=excluded.topic_key,difficulty=excluded.difficulty,
          is_active=1,updated_at=CURRENT_TIMESTAMP`, [
        item.stable_code, item.stem, JSON.stringify(item.options), item.correct_option,
        sanitizeChoiceExplanation(item.explanation), item.source_label, item.topic_key, item.difficulty,
      ]);
      const stored = db.get('SELECT id FROM choice_king_questions WHERE stable_code=?', [item.stable_code]);
      replaceQuestionTopics(db, {
        relationTable: 'choice_king_question_topics',
        questionId: stored.id,
        topicKeys: item.topic_keys,
        primaryTopicKey: item.topic_key,
      });
      activeChoiceCodes.add(item.stable_code);
      seededChoices += 1;
    }

    for (const item of terminals) {
      const prepared = assets.prepared.get(item.source_key);
      let assetId = prepared.assetId;
      if (!assetId) {
        const digest = sha256(prepared.buffer);
        const target = path.join(EXAM_LIBRARY_DIR, prepared.storageKey);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        if (!fs.existsSync(target)) fs.writeFileSync(target, prepared.buffer);
        const same = db.get('SELECT id FROM exam_assets WHERE sha256=?', [digest]);
        if (same) {
          assetId = Number(same.id);
        } else {
          const created = db.run(`INSERT INTO exam_assets
            (asset_kind,storage_key,original_name,mime_type,byte_size,sha256)
            VALUES('question',?,?,?,?,?)`, [
            prepared.storageKey, `${item.source_key}.webp`, 'image/webp', prepared.buffer.length, digest,
          ]);
          assetId = Number(created.lastInsertRowid);
        }
      }
      db.run(`INSERT INTO weekly_challenge_questions
        (source_key,question_type,title,question_asset_id,answer_text,source_label,
          grade_code,subject_code,topic_key,difficulty,is_active)
        VALUES(?,?,?,?,?,?,'g8','math',?,?,0)
        ON CONFLICT(source_key) DO UPDATE SET
          question_type=excluded.question_type,title=excluded.title,
          question_asset_id=excluded.question_asset_id,answer_text=excluded.answer_text,
          source_label=excluded.source_label,grade_code='g8',subject_code='math',
          topic_key=excluded.topic_key,difficulty=excluded.difficulty,is_active=0`, [
        item.source_key, item.question_type, item.title, assetId, item.answer_text,
        item.source_label, item.topic_key, item.difficulty,
      ]);
      const stored = db.get('SELECT id FROM weekly_challenge_questions WHERE source_key=?', [item.source_key]);
      replaceQuestionTopics(db, {
        relationTable: 'weekly_challenge_question_topics',
        questionId: stored.id,
        topicKeys: item.topic_keys,
        primaryTopicKey: item.topic_key,
      });
      seededTerminals += 1;
    }

    for (const row of db.all(`SELECT stable_code FROM choice_king_questions
      WHERE stable_code LIKE 'GZ8-ORIGINAL-%' AND is_active=1`)) {
      if (activeChoiceCodes.has(row.stable_code)) continue;
      deactivated += Number(db.run(`UPDATE choice_king_questions SET is_active=0,updated_at=CURRENT_TIMESTAMP
        WHERE stable_code=?`, [row.stable_code]).changes || 0);
    }
    deactivated += Number(db.run(`UPDATE weekly_challenge_questions SET is_active=0
      WHERE source_key LIKE 'g8-original-%' AND is_active=1`).changes || 0);
  });
  return {
    choice: seededChoices,
    terminal: seededTerminals,
    total: seededChoices + seededTerminals,
    rendered_assets: assets.rendered,
    reused_assets: assets.reused,
    deactivated,
    audit,
  };
}

module.exports = {
  RENDER_VERSION,
  renderQuestionCardSvg,
  expectedStorageKey,
  seedG8Content,
};
