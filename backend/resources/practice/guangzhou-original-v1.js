const crypto = require('node:crypto');
const blueprint = require('./guangzhou-blueprint-v1.json');

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
  }
  return value;
}

function digest(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stableValue(value))).digest('hex');
}

function question(module, type, difficulty, template, stem, answer, seconds, signature) {
  return {
    grade_band: ['四则运算', '乘除法', '应用题'].includes(module) ? '小学' : '初中',
    subject: '数学',
    module,
    question_type: type,
    difficulty,
    template_key: `gz-${template}`,
    stem,
    answer: String(answer),
    estimated_seconds: seconds,
    signature: `gz-original-v1-${signature}`,
    provenance: 'self_authored',
  };
}

function buildQuestions() {
  const rows = [];
  const primaryPlaces = ['花城广场', '越秀公园', '海珠湖', '广州图书馆', '文化公园'];
  const foods = ['虾饺', '烧卖', '马蹄糕', '萝卜糕', '艇仔粥'];

  for (let i = 0; i < 10; i += 1) {
    const a = 36 + i * 7;
    const b = 18 + (i % 5) * 6;
    const place = primaryPlaces[i % primaryPlaces.length];
    if (i % 2 === 0) {
      rows.push(question('四则运算', '口算', 1 + Math.floor(i / 4), `landmark-add-${i % 5}`,
        `广州研学小组在${place}上午记录了 ${a} 片叶子，下午又记录了 ${b} 片，共记录多少片？`,
        a + b, 85, `primary-arithmetic-add-${i + 1}`));
    } else {
      rows.push(question('四则运算', '口算', 1 + Math.floor(i / 4), `landmark-sub-${i % 5}`,
        `广州研学小组为${place}活动准备了 ${a + b} 张任务卡，用去 ${b} 张，还剩多少张？`,
        a, 85, `primary-arithmetic-sub-${i + 1}`));
    }
  }

  for (let i = 0; i < 10; i += 1) {
    const groups = 3 + (i % 5);
    const each = 4 + ((i * 2) % 7);
    const food = foods[i % foods.length];
    if (i % 2 === 0) {
      rows.push(question('乘除法', '口算', 1 + Math.floor(i / 4), `dim-sum-mul-${i % 5}`,
        `一次广府饮食文化活动把${food}每份装 ${each} 个，共装 ${groups} 份，一共有多少个？`,
        groups * each, 90, `primary-multiply-${i + 1}`));
    } else {
      rows.push(question('乘除法', '口算', 1 + Math.floor(i / 4), `dim-sum-div-${i % 5}`,
        `一次广府饮食文化活动有 ${groups * each} 个${food}，平均装成 ${groups} 份，每份多少个？`,
        each, 90, `primary-divide-${i + 1}`));
    }
  }

  for (let i = 0; i < 10; i += 1) {
    const stations = 4 + (i % 6);
    const cards = 6 + ((i * 3) % 8);
    const place = primaryPlaces[(i + 2) % primaryPlaces.length];
    rows.push(question('应用题', '文字题', i < 4 ? 2 : 3, `city-project-${i % 5}`,
      `广州城市观察活动设置了 ${stations} 个任务点，每个任务点准备 ${cards} 张记录卡，另在${place}服务点准备 5 张备用卡。一共准备多少张记录卡？`,
      stations * cards + 5, 130, `primary-word-${i + 1}`));
  }

  for (let i = 0; i < 10; i += 1) {
    const start = -8 + i;
    const change = i % 2 === 0 ? 5 + (i % 4) : -(3 + (i % 4));
    rows.push(question('有理数', '计算', 1 + Math.floor(i / 4), `pearl-river-change-${i % 5}`,
      `把珠江水位监测的基准记为 0，某次模拟读数为 ${start} cm，随后变化 ${change >= 0 ? `+${change}` : change} cm，新的模拟读数是多少？`,
      start + change, 95, `middle-rational-${i + 1}`));
  }

  for (let i = 0; i < 10; i += 1) {
    const x = 6 + i * 2;
    const fixed = 8 + (i % 5) * 3;
    const multiplier = 2 + (i % 3);
    rows.push(question('一元一次方程', '方程', i < 4 ? 2 : 3, `metro-volunteer-${i % 5}`,
      `广州地铁志愿活动把物资平均装入 ${multiplier} 个箱子，每箱 x 份，另有 ${fixed} 份展示物资，共 ${multiplier * x + fixed} 份。列方程并求 x。`,
      `x=${x}`, 125, `middle-equation-${i + 1}`));
  }

  for (let i = 0; i < 10; i += 1) {
    const a = 2 + (i % 7);
    const b = 3 + ((i * 2) % 8);
    const c = 1 + (i % 4);
    rows.push(question('整式运算', '化简', i < 4 ? 2 : 3, `flower-city-like-terms-${i % 5}`,
      `花城广场的模拟绿化图中，三段花带长度分别记为 ${a}x 米、${b}x 米和 -${c}x 米。化简它们的总长度。`,
      `${a + b - c}x`, 115, `middle-algebra-${i + 1}`));
  }

  return rows.map((item) => ({ ...item, content_sha256: digest(item) }));
}

const questions = buildQuestions();
const sourceSnapshotSha256 = digest(blueprint);

module.exports = {
  metadata: {
    batch_key: blueprint.batch_key,
    source_title: blueprint.title,
    source_url: blueprint.sources[0].url,
    source_region: blueprint.region,
    source_license: blueprint.license,
    source_retrieved_at: blueprint.retrieved_at,
    source_snapshot_sha256: sourceSnapshotSha256,
    copy_allowed: blueprint.copy_allowed,
    provenance: blueprint.provenance,
  },
  questions,
};
