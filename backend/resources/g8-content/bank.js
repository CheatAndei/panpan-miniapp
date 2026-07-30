const { topics, topicKeys } = require('./topics');

const LETTERS = ['A', 'B', 'C', 'D'];
const VARIANT_LABELS = ['基础辨析', '课堂巩固', '单元复习', '易错辨析', '综合练习'];

function signedTerm(coefficient, variable) {
  if (!coefficient) return '';
  return `${coefficient > 0 ? '+' : '-'}${Math.abs(coefficient)}${variable}`;
}

function rotateOptions(correct, distractors, seed) {
  const values = [String(correct), ...distractors.map(String)]
    .filter((value, index, list) => value && list.indexOf(value) === index);
  while (values.length < 4) values.push(`其他结论 ${values.length}`);
  const selected = values.slice(0, 4);
  const shift = seed % 4;
  const rotated = [...selected.slice(shift), ...selected.slice(0, shift)];
  return {
    options: Object.fromEntries(LETTERS.map((letter, index) => [letter, rotated[index]])),
    correct_option: LETTERS[rotated.indexOf(String(correct))],
  };
}

function choice(topicIndex, serial, stem, correct, distractors, explanation, difficulty = 2, extraTopicKeys = []) {
  const topic = topics[topicIndex];
  return {
    stable_code: `GZ8-ORIGINAL-C${String(topicIndex + 1).padStart(2, '0')}-${String(serial + 1).padStart(3, '0')}`,
    grade_code: 'g8',
    subject_code: 'math',
    topic_key: topic.topic_key,
    topic_keys: [...new Set([topic.topic_key, ...extraTopicKeys])],
    stem: `【${VARIANT_LABELS[Math.floor(serial / 12)]}】${stem}`,
    ...rotateOptions(correct, distractors, serial + topicIndex),
    explanation,
    difficulty,
    source_label: `初二暑数学简易版本·第${topicIndex + 1}讲·原创改编`,
    provenance: 'self_authored',
  };
}

function topicChoice(topicIndex, serial) {
  const family = serial % 12;
  const variant = Math.floor(serial / 12);
  const a = 3 + variant;
  const b = 6 + variant;
  const c = 2 + variant;

  if (topicIndex === 0) {
    if (family === 0) return choice(0, serial, `三角形两边长为 ${a} 和 ${b}，第三边为整数，其最大值是`, a + b - 1, [a + b, b - a, a + b - 2], '第三边小于两边之和，故最大整数为两边和减 1。');
    if (family === 1) return choice(0, serial, `三角形两边长为 ${a} 和 ${b}，第三边为整数，其最小值是`, b - a + 1, [b - a, b - a + 2, 1], '第三边大于两边之差，故最小整数为两边之差加 1。');
    if (family === 2) return choice(0, serial, `三角形两边长为 ${a} 和 ${b}，整数第三边共有多少种取值？`, 2 * a - 1, [2 * a, 2 * a - 2, a + b - 1], '整数第三边满足 b-a<c<a+b，共有 2a-1 个。');
    if (family === 3) return choice(0, serial, '在 △ABC 中，M 是 BC 的中点，则线段 AM 是', 'BC 边上的中线', ['BC 边上的高', '∠A 的角平分线', 'AB 边上的中线'], '连接顶点与对边中点的线段叫三角形的中线。');
    if (family === 4) return choice(0, serial, '在 △ABC 中，AH⊥BC，垂足为 H，则 AH 是', 'BC 边上的高', ['BC 边上的中线', '∠B 的角平分线', 'AB 边上的高'], '从顶点向对边所在直线作垂线，顶点到垂足的线段是高。');
    if (family === 5) return choice(0, serial, '若射线 AD 把 ∠BAC 分成两个相等的角，则 AD 是', '∠BAC 的角平分线', ['BC 边上的中线', 'BC 边上的高', 'AB 的垂直平分线'], '角平分线把一个角分成两个相等的角。');
    if (family === 6) return choice(0, serial, `AM 是 △ABC 的中线，BM=${b}，则 BC=`, 2 * b, [b, b + 2, 3 * b], '中线经过对边中点，所以 BM=CM，BC=2BM。');
    if (family === 7) return choice(0, serial, `△ABC 的三边长分别为 ${a + 1}、${b + 1}、${a + b - 1}，周长为`, 2 * a + 2 * b + 1, [2 * a + 2 * b, a + b + 1, 2 * a + b], '周长等于三边长之和。');
    if (family === 8) return choice(0, serial, '下列三组长度中，能组成三角形的是', `${a}，${b}，${a + b - 1}`, [`${a}，${b}，${a + b}`, `${a}，${b}，${b - a}`, `${a}，${a}，${2 * a}`], '任意两边之和必须大于第三边；只有第一组满足。');
    if (family === 9) return choice(0, serial, '一个三角形共有多少条中线？', 3, [1, 2, 4], '每个顶点都可向其对边作一条中线，共 3 条。');
    if (family === 10) return choice(0, serial, '三角形三条中线的交点叫做', '重心', ['垂心', '内心', '外心'], '三条中线交于一点，这一点叫三角形的重心。');
    return choice(0, serial, `若 ${b - a}<x<${a + b} 且 x 为整数，则可作为边长 x 的取值个数为`, 2 * a - 1, [2 * a, 2 * a - 2, a + b], '逐个整数计数，开区间内共有 2a-1 个整数。', 3);
  }

  if (topicIndex === 1) {
    const angle1 = 35 + variant * 3;
    const angle2 = 65 - variant * 2;
    const third = 180 - angle1 - angle2;
    if (family === 0) return choice(1, serial, `三角形两个内角为 ${angle1}°、${angle2}°，第三个内角为`, `${third}°`, [`${180 - angle1}°`, `${angle1 + angle2}°`, `${third + 10}°`], '三角形内角和为 180°。');
    if (family === 1) return choice(1, serial, `△ABC 中，∠A=${angle1}°，∠B=${angle2}°，∠C 的外角为`, `${angle1 + angle2}°`, [`${third}°`, `${180 - angle1}°`, `${180 - angle2}°`], '三角形的一个外角等于与它不相邻的两个内角之和。');
    if (family === 2) return choice(1, serial, '三角形的一个外角一定', '大于任何一个与它不相邻的内角', ['小于任何内角', '等于相邻内角', '等于 90°'], '外角等于两个不相邻内角之和，所以大于其中任意一个。');
    if (family === 3) return choice(1, serial, `直角三角形一个锐角为 ${angle1}°，另一个锐角为`, `${90 - angle1}°`, [`${180 - angle1}°`, `${angle1}°`, `${90 + angle1}°`], '直角三角形两个锐角互余。');
    if (family === 4) return choice(1, serial, '下列角度能作为同一个三角形三个内角的是', '50°，60°，70°', ['40°，60°，90°', '30°，70°，90°', '20°，80°，90°'], '三角形三个内角之和必须是 180°。');
    if (family === 5) return choice(1, serial, `三角形三个内角之比为 2∶3∶4，其中最大角为`, '80°', ['40°', '60°', '90°'], '每份为 180°÷9=20°，最大角为 4×20°=80°。');
    if (family === 6) return choice(1, serial, '三角形至少有', '两个锐角', ['一个锐角', '一个直角', '两个钝角'], '三个内角和为 180°，至多一个角不小于 90°。');
    if (family === 7) return choice(1, serial, `一个三角形的两个外角分别为 ${110 + variant}°、${120 - variant}°，第三个外角为`, '130°', ['120°', '140°', '150°'], '三个外角各取一个时，其和为 360°。');
    if (family === 8) return choice(1, serial, '若三角形一个内角等于另外两个内角之和，则该三角形是', '直角三角形', ['锐角三角形', '钝角三角形', '等边三角形'], '设最大角为 A，A=B+C，结合 A+B+C=180° 得 A=90°。');
    if (family === 9) return choice(1, serial, `∠A 的外角为 ${120 + variant * 2}°，则 ∠A=`, `${60 - variant * 2}°`, [`${120 + variant * 2}°`, `${30 + variant}°`, `${90 - variant}°`], '内角与相邻外角互为补角。');
    if (family === 10) return choice(1, serial, '关于三角形外角，下列说法正确的是', '每个顶点有两个互为对顶角的外角', ['每个三角形只有三个外角', '外角和为 180°', '外角都大于 90°'], '延长顶点两侧的边可得到两个互为对顶角的外角。');
    return choice(1, serial, `△ABC 中，∠A=${angle1}°，∠B 比 ∠C 小 ${10 + variant}°，则 ∠C 为`, `${(180 - angle1 + 10 + variant) / 2}°`, [`${(180 - angle1 - 10 - variant) / 2}°`, `${90 - angle1}°`, `${angle2}°`], '设 ∠C=x，则 ∠B=x-(10+v)，利用内角和求解。', 3);
  }

  if (topicIndex === 2) {
    const length = 5 + variant;
    if (family === 0) return choice(2, serial, '三边分别相等的两个三角形可用哪种方法判定全等？', 'SSS', ['SAS', 'ASA', 'AAA'], '三组对应边分别相等，使用 SSS。');
    if (family === 1) return choice(2, serial, '两边及其夹角分别相等的两个三角形可用', 'SAS', ['SSA', 'AAS', 'AAA'], '两边及夹角对应 SAS。');
    if (family === 2) return choice(2, serial, '两角及其夹边分别相等的两个三角形可用', 'ASA', ['SSS', 'SSA', 'HL'], '两角及夹边对应 ASA。');
    if (family === 3) return choice(2, serial, '两角及其中一角的对边分别相等的两个三角形可用', 'AAS', ['SAS', 'SSA', 'AAA'], '两角和一组对应边相等，对应 AAS。');
    if (family === 4) return choice(2, serial, '直角三角形的斜边和一条直角边分别相等，可用', 'HL', ['AAA', 'SSA', 'ASA'], 'HL 是直角三角形特有的全等判定。');
    if (family === 5) return choice(2, serial, '不能单独判定两个三角形全等的是', 'AAA', ['SSS', 'SAS', 'ASA'], 'AAA 只能确定形状，不能确定大小。');
    if (family === 6) return choice(2, serial, '若 △ABC≌△DEF，A、B、C 分别对应 D、E、F，则对应边是', 'BC=EF', ['AB=EF', 'AC=DE', 'BC=DF'], '按全等符号顺序，B↔E、C↔F。');
    if (family === 7) return choice(2, serial, `若 △ABC≌△DEF，AB=${length}，则 DE=`, length, [length - 1, length + 1, 2 * length], '全等三角形对应边相等。');
    if (family === 8) return choice(2, serial, `若 △ABC≌△DEF，∠A=${40 + variant * 5}°，则 ∠D=`, `${40 + variant * 5}°`, [`${50 + variant * 5}°`, '90°', `${140 - variant * 5}°`], '全等三角形对应角相等。');
    if (family === 9) return choice(2, serial, '证明两条线段相等，常见思路是', '把它们放进两个三角形并证全等', ['只比较图上长度', '只证明一个角相等', '延长所有线段'], '全等三角形的对应边相等。');
    if (family === 10) return choice(2, serial, '已知公共边 AC，在证明 △ABC 与 △ADC 全等时，AC=AC 的依据是', '公共边', ['对顶角', '平行线', '中点定义'], '同一条线段等于自身，称为公共边条件。');
    return choice(2, serial, '“两边及其中一边的对角分别相等”通常不能判定全等，这种条件是', 'SSA', ['SAS', 'ASA', 'SSS'], '非夹角条件 SSA 存在多解，通常不能判定全等。', 3);
  }

  if (topicIndex === 3) {
    const extra = [topicKeys[2]];
    if (family === 0) return choice(3, serial, '角平分线上的点到角两边的距离', '相等', ['互余', '互补', '不确定'], '角平分线性质：角平分线上的点到角两边距离相等。', 2, extra);
    if (family === 1) return choice(3, serial, '在角的内部，到角两边距离相等的点位于', '角平分线上', ['垂直平分线上', '中线上', '任意直线上'], '这是角平分线性质的逆定理。', 2, extra);
    if (family === 2) return choice(3, serial, '从角平分线上的点向角两边作垂线，构造出的两个直角三角形常用', 'HL 判定全等', ['AAA 判定全等', 'SSA 判定全等', '无法比较'], '两个直角三角形有公共斜边，且两条垂线段相等，可用 HL。', 2, extra);
    if (family === 3) return choice(3, serial, `OP 平分 ∠AOB，点 P 到 OA 的距离为 ${a}，则 P 到 OB 的距离为`, a, [a + 1, a - 1, 2 * a], '角平分线上的点到角两边距离相等。', 2, extra);
    if (family === 4) return choice(3, serial, '证明角平分线上的两条垂线段相等，需要先说明它们是', '点到两边的距离', ['两条中线', '两条角平分线', '两条斜边'], '距离的定义要求垂直。', 2, extra);
    if (family === 5) return choice(3, serial, '若 AD 平分 ∠BAC，要证明 △ABD≌△ACD，还常需要', 'AB=AC', ['∠B=∠C 即可', 'BD≠CD', '只需公共边'], 'AB=AC、AD 公共、∠BAD=∠CAD 可用 SAS。', 2, extra);
    if (family === 6) return choice(3, serial, '全等三角形对应边相等可用来证明', '点到两边的距离相等', ['两个三角形面积必为 0', '所有角都是直角', '两直线一定平行'], '将距离作为直角三角形的对应边即可。', 2, extra);
    if (family === 7) return choice(3, serial, '角平分线问题中“作垂线”的主要目的为', '构造直角三角形并使用距离性质', ['改变原题角度', '测量图形', '得到平行四边形'], '向两边作垂线可把距离条件转化为线段条件。', 2, extra);
    if (family === 8) return choice(3, serial, `∠AOB= ${60 + variant * 4}°，OP 为角平分线，则 ∠AOP=`, `${30 + variant * 2}°`, [`${60 + variant * 4}°`, `${120 + variant * 8}°`, `${20 + variant}°`], '角平分线把原角平均分成两部分。', 2, extra);
    if (family === 9) return choice(3, serial, '在证明一条射线是角平分线时，可利用', '射线上一点到角两边距离相等', ['射线长度有限', '两个邻角互补', '两边长度相等'], '角平分线逆定理可由距离相等推出点在角平分线上。', 3, extra);
    if (family === 10) return choice(3, serial, '两个直角三角形有一条直角边和斜边分别相等，则', '两个三角形全等', ['只能相似', '一定不全等', '还必须知道三个角'], '直角三角形可用 HL 判定全等。', 2, extra);
    return choice(3, serial, '角平分线综合题中，公共斜边、两组直角和一组距离相等共同指向', 'HL 全等模型', ['AAA 模型', '平移模型', '统计模型'], '这些是 HL 判定的典型条件。', 3, extra);
  }

  if (topicIndex === 4) {
    const x = 2 + variant;
    const y = 3 + variant;
    if (family === 0) return choice(4, serial, `点 P(${x},${y}) 关于 x 轴的对称点是`, `(${x},${-y})`, [`(${-x},${y})`, `(${-x},${-y})`, `(${y},${x})`], '关于 x 轴对称：横坐标不变，纵坐标变号。');
    if (family === 1) return choice(4, serial, `点 P(${-x},${y}) 关于 y 轴的对称点是`, `(${x},${y})`, [`(${-x},${-y})`, `(${x},${-y})`, `(${y},${x})`], '关于 y 轴对称：纵坐标不变，横坐标变号。');
    if (family === 2) return choice(4, serial, '轴对称图形沿对称轴折叠后', '两部分能够完全重合', ['面积变为一半', '周长变为两倍', '所有点都不动'], '轴对称的定义就是沿某条直线折叠后两部分重合。');
    if (family === 3) return choice(4, serial, '线段垂直平分线上的点到线段两端点的距离', '相等', ['互余', '一大一小', '和为线段长'], '垂直平分线性质。');
    if (family === 4) return choice(4, serial, '到线段两端点距离相等的点位于', '线段的垂直平分线上', ['线段所在直线上', '任意圆上', '角平分线上'], '这是垂直平分线性质的逆定理。');
    if (family === 5) return choice(4, serial, '等边三角形有多少条对称轴？', 3, [1, 2, 4], '三条中线所在直线都是对称轴。');
    if (family === 6) return choice(4, serial, '一般等腰三角形有多少条对称轴？', 1, [0, 2, 3], '顶角平分线所在直线是唯一对称轴。');
    if (family === 7) return choice(4, serial, `A、B 关于直线 l 对称，AB=${2 * x}，l 与 AB 交于 M，则 AM=`, x, [2 * x, x + 1, 4 * x], '对称轴是对应点连线的垂直平分线。');
    if (family === 8) return choice(4, serial, '关于某直线成轴对称的两个图形', '全等', ['一定不全等', '面积不同', '周长不同'], '轴对称不改变图形的形状和大小。');
    if (family === 9) return choice(4, serial, '对称轴上的点在轴对称变换下', '位置不变', ['横坐标变号', '纵坐标变号', '移动到原点'], '对称轴上的点是对应点与自身。');
    if (family === 10) return choice(4, serial, `点 A(${x},${-y}) 关于原点对称的点是`, `(${-x},${y})`, [`(${x},${y})`, `(${-x},${-y})`, `(${y},${x})`], '关于原点对称时，横纵坐标都变号。');
    return choice(4, serial, '作已知点关于直线的对称点，关键是使这条直线成为', '对应点连线的垂直平分线', ['对应点连线本身', '任意角平分线', '圆的切线'], '轴对称的对应点连线被对称轴垂直平分。', 3);
  }

  if (topicIndex === 5) {
    const angle = 40 + variant * 4;
    if (family === 0) return choice(5, serial, `等腰三角形一个底角为 ${angle}°，顶角为`, `${180 - 2 * angle}°`, [`${90 - angle}°`, `${2 * angle}°`, `${180 - angle}°`], '等腰三角形两底角相等，三个内角和为 180°。');
    if (family === 1) return choice(5, serial, `等腰三角形顶角为 ${40 + variant * 6}°，一个底角为`, `${70 - variant * 3}°`, [`${40 + variant * 6}°`, `${140 - variant * 6}°`, `${50 - variant}°`], '两个底角相等，各为 (180°-顶角)÷2。');
    if (family === 2) return choice(5, serial, '等腰三角形的性质是', '两底角相等', ['三边相等', '三个角都是 60°', '只有一条高'], '等边三角形才三边相等；一般等腰三角形两底角相等。');
    if (family === 3) return choice(5, serial, '若三角形有两个角相等，则', '这两个角所对的边相等', ['第三个角一定为 90°', '三边都相等', '面积为 0'], '等角对等边。');
    if (family === 4) return choice(5, serial, '等腰三角形顶角平分线同时也是', '底边上的中线和高', ['一条腰', '外角平分线', '底边'], '等腰三角形“三线合一”。');
    if (family === 5) return choice(5, serial, '等边三角形每个内角为', '60°', ['30°', '45°', '90°'], '三个角相等且和为 180°。');
    if (family === 6) return choice(5, serial, '有一个角是 60° 的等腰三角形', '一定是等边三角形', ['一定是直角三角形', '可能没有相等边', '一定有 120° 角'], '无论 60° 是顶角还是底角，三个角最终都为 60°。');
    if (family === 7) return choice(5, serial, `等腰三角形周长为 ${3 * (a + 2)}，底边为 ${a + 2}，则腰长为`, a + 2, [a + 1, 2 * a + 4, 3 * a + 6], '两腰和=周长-底边，再除以 2。');
    if (family === 8) return choice(5, serial, '下列能判定三角形为等腰三角形的是', '有两个内角相等', ['有一个角为 60°', '有一条中线', '有一个外角'], '等角对等边，可判定为等腰三角形。');
    if (family === 9) return choice(5, serial, '等边三角形的三条高', '也是中线、角平分线和对称轴', ['长度互不相等', '只有一条经过顶点', '互相平行'], '等边三角形在每个顶点都满足三线合一。');
    if (family === 10) return choice(5, serial, `等腰三角形一个外角为 ${100 + variant * 4}°，且它与一个底角相邻，则底角为`, `${80 - variant * 4}°`, [`${100 + variant * 4}°`, `${40 + variant * 2}°`, '90°'], '相邻内外角互补。');
    return choice(5, serial, '证明等腰三角形两底角相等，常作的辅助线是', '顶角平分线', ['任意外角线', '腰的平行线', '底边延长线'], '顶角平分线结合 SAS 可证两个小三角形全等。', 3);
  }

  if (topicIndex === 6) {
    const m = 2 + variant;
    const n = 3 + variant;
    if (family === 0) return choice(6, serial, `x^${m}·x^${n}=`, `x^${m + n}`, [`x^${m * n}`, `2x^${m + n}`, `x^${n - m}`], '同底数幂相乘，底数不变，指数相加。');
    if (family === 1) return choice(6, serial, `a^${m + n}÷a^${n}=（a≠0）`, `a^${m}`, [`a^${m + 2 * n}`, `a^${n}`, `${m}`], '同底数幂相除，底数不变，指数相减。');
    if (family === 2) return choice(6, serial, `(y^${m})^${n}=`, `y^${m * n}`, [`y^${m + n}`, `y^${m}`, `${n}y^${m}`], '幂的乘方，底数不变，指数相乘。');
    if (family === 3) return choice(6, serial, `(ab)^${m}=`, `a^${m}b^${m}`, [`ab^${m}`, `a^${m}+b^${m}`, `a^${2 * m}`], '积的乘方等于各因式分别乘方。');
    if (family === 4) return choice(6, serial, `(${m}x^2)(${n}x^3)=`, `${m * n}x^5`, [`${m * n}x^6`, `${m + n}x^5`, `${m * n}x`], '系数相乘，同底数幂指数相加。');
    if (family === 5) return choice(6, serial, `${m}x(x+${n})=`, `${m}x²+${m * n}x`, [`${m}x²+${n}`, `${m + n}x²`, `${m}x²+${n}x`], '单项式乘多项式要逐项相乘。');
    if (family === 6) return choice(6, serial, `(x+${m})(x+${n})=`, `x²+${m + n}x+${m * n}`, [`x²+${m * n}`, `x²+${m * n}x+${m + n}`, `x²+${m + n}`], '多项式乘多项式，逐项相乘并合并同类项。');
    if (family === 7) return choice(6, serial, `(${m}a^3b²)²=`, `${m * m}a^6b^4`, [`${2 * m}a^5b^4`, `${m * m}a^5b^4`, `${m}a^6b²`], '系数、各字母分别平方。');
    if (family === 8) return choice(6, serial, `x^${m}·x^${n}÷x²=（x≠0）`, `x^${m + n - 2}`, [`x^${m + n + 2}`, `x^${m * n - 2}`, `x^${m + n}`], '指数按乘法相加、除法相减。');
    if (family === 9) return choice(6, serial, `${m}x²·(-${n}x)=`, `-${m * n}x³`, [`${m * n}x³`, `-${m + n}x³`, `-${m * n}x²`], '正负号先确定，系数相乘，指数相加。');
    if (family === 10) return choice(6, serial, `(2x+${m})(x-${n})=`, `2x²${signedTerm(m - 2 * n, 'x')}-${m * n}`, [`2x²-${m * n}`, `2x²+${m + 2 * n}x-${m * n}`, `2x²${signedTerm(2 * n - m, 'x')}+${m * n}`], '逐项相乘：2x²-2nx+mx-mn。', 3);
    return choice(6, serial, `若 2^x·2^${m}=2^${m + n}，则 x=`, n, [m, m + n, n - 1], '同底数幂相乘指数相加，所以 x+m=m+n。', 3);
  }

  if (topicIndex === 7) {
    const m = 2 + variant;
    const n = 3 + variant;
    if (family === 0) return choice(7, serial, `(x+${m})²=`, `x²+${2 * m}x+${m * m}`, [`x²+${m * m}`, `x²+${m}x+${m * m}`, `x²-${2 * m}x+${m * m}`], '使用完全平方公式。');
    if (family === 1) return choice(7, serial, `(x-${m})²=`, `x²-${2 * m}x+${m * m}`, [`x²-${m * m}`, `x²+${2 * m}x+${m * m}`, `x²-${m}x+${m * m}`], '使用差的完全平方公式。');
    if (family === 2) return choice(7, serial, `(x+${m})(x-${m})=`, `x²-${m * m}`, [`x²+${m * m}`, `x²-${2 * m}x+${m * m}`, `x²-${m}`], '使用平方差公式。');
    if (family === 3) return choice(7, serial, `因式分解：x²-${m * m}`, `(x+${m})(x-${m})`, [`(x-${m})²`, `x(x-${m})`, `(x+${m})²`], '逆用平方差公式。');
    if (family === 4) return choice(7, serial, `因式分解：x²+${2 * m}x+${m * m}`, `(x+${m})²`, [`(x-${m})²`, `(x+${m})(x-${m})`, `x(x+${2 * m})`], '三项符合完全平方公式。');
    if (family === 5) return choice(7, serial, `因式分解：${n}x²+${n * m}x`, `${n}x(x+${m})`, [`${n}(x²+${m}x)`, `x(${n}x+${m})`, `${n}x(x-${m})`], '先提取公因式 nx。');
    if (family === 6) return choice(7, serial, `(x+${m})²-(x-${m})²=`, `${4 * m}x`, [`2x²+${2 * m * m}`, `${2 * m}x`, `${m * m}`], '两式展开后相减，或用平方差。');
    if (family === 7) return choice(7, serial, `用公式计算：${100 - m}×${100 + m}=`, 10000 - m * m, [10000 + m * m, (100 - m) ** 2, 10000 - m], '使用 (100-m)(100+m)=10000-m²。');
    if (family === 8) return choice(7, serial, `因式分解：${n}x²-${n * m * m}`, `${n}(x+${m})(x-${m})`, [`${n}(x-${m})²`, `(${n}x+${m})(${n}x-${m})`, `${n}x(x-${m})`], '先提 n，再用平方差公式。');
    if (family === 9) return choice(7, serial, '下列从左到右的变形属于因式分解的是', 'x²-1=(x+1)(x-1)', ['x(x+1)=x²+x', '(x+1)²=x²+2x+1', 'x+x=2x'], '因式分解是把多项式写成几个整式的积。');
    if (family === 10) return choice(7, serial, `若 x+y=${m + n}，xy=${m * n}，则 x²+y²=`, m * m + n * n, [(m + n) ** 2, m * n, 2 * m * n], 'x²+y²=(x+y)²-2xy。', 3);
    return choice(7, serial, `因式分解：${m * m}x²-${n * n}`, `(${m}x+${n})(${m}x-${n})`, [`(${m}x-${n})²`, `(${m}x+${n})²`, `${m}(x+${n})(x-${n})`], '把两项分别看成 (mx)² 与 n²。', 3);
  }

  if (topicIndex === 8) {
    const angle = 25 + variant * 5;
    if (family === 0) return choice(8, serial, `两直线平行，同位角一个为 ${angle}°，另一个为`, `${angle}°`, [`${180 - angle}°`, `${90 - angle}°`, `${2 * angle}°`], '两直线平行，同位角相等。');
    if (family === 1) return choice(8, serial, `两直线平行，内错角一个为 ${angle + 10}°，另一个为`, `${angle + 10}°`, [`${170 - angle}°`, `${80 - angle}°`, `${angle}°`], '两直线平行，内错角相等。');
    if (family === 2) return choice(8, serial, `两直线平行，同旁内角一个为 ${70 + variant * 4}°，另一个为`, `${110 - variant * 4}°`, [`${70 + variant * 4}°`, `${20 + variant * 2}°`, `${90 - variant * 4}°`], '两直线平行，同旁内角互补。');
    if (family === 3) return choice(8, serial, `“8 字形”中一组对顶角为 ${40 + variant * 3}°，其对顶角为`, `${40 + variant * 3}°`, [`${140 - variant * 3}°`, `${80 + variant * 6}°`, '90°'], '对顶角相等。');
    if (family === 4) return choice(8, serial, '角度模型中添加平行线的主要作用是', '转移角并构造相等或互补关系', ['改变已知角大小', '增加边长条件', '直接得到全等'], '平行线提供同位角、内错角和同旁内角关系。');
    if (family === 5) return choice(8, serial, `一条折线夹在两条平行线之间，两个转角为 ${angle}°、${angle + 15}°，同向转角和为`, `${2 * angle + 15}°`, [`${angle + 15}°`, `${180 - 2 * angle - 15}°`, `${2 * angle}°`], '按平行线转移角后，同向转角相加。');
    if (family === 6) return choice(8, serial, '证明两角相等时，若它们都与同一个角互余，则', '两角相等', ['两角互补', '两角都是 45°', '无法判断'], '同角的余角相等。');
    if (family === 7) return choice(8, serial, '若两个角分别与同一个角互补，则这两个角', '相等', ['互余', '互补', '不一定相等'], '同角的补角相等。');
    if (family === 8) return choice(8, serial, `∠1+∠2=90°，∠2=${angle}°，则 ∠1=`, `${90 - angle}°`, [`${180 - angle}°`, `${angle}°`, `${90 + angle}°`], '互余两角之和为 90°。');
    if (family === 9) return choice(8, serial, `∠1+∠2=180°，∠2=${70 + variant * 5}°，则 ∠1=`, `${110 - variant * 5}°`, [`${70 + variant * 5}°`, `${20 + variant}°`, `${90 - variant * 5}°`], '互补两角之和为 180°。');
    if (family === 10) return choice(8, serial, '角度追踪时，图形不按比例意味着', '结论必须由已知和定理推出', ['可直接用量角器读数', '看起来相等就相等', '所有锐角相等'], '示意图只辅助理解，不能替代推理。');
    return choice(8, serial, `两条平行线被折线所截，三个同向小角为 ${angle}°、${angle + 5}°、${angle + 10}°，总转角为`, `${3 * angle + 15}°`, [`${2 * angle + 15}°`, `${180 - 3 * angle - 15}°`, `${3 * angle + 5}°`], '逐段作平行线转移三个角，再相加。', 3);
  }

  if (topicIndex === 9) {
    const extra = [topicKeys[2], topicKeys[3]];
    if (family === 0) return choice(9, serial, '角平分线综合中，从内部点向两边作垂线后，优先考虑', 'HL 证明两个直角三角形全等', ['AAA', 'SSA', '只比较面积'], '公共斜边与两条距离相等构成 HL。', 3, extra);
    if (family === 1) return choice(9, serial, '截长补短法的核心作用是', '把线段和差转化为全等三角形的对应边', ['改变原题长度', '把角都变成直角', '直接计算面积'], '线段和差常通过搬移线段进入全等结构。', 3, extra);
    if (family === 2) return choice(9, serial, '倍长中线后常出现的关键条件是', '中点两侧线段相等和一组对顶角相等', ['三角形三个角相等', '两条线平行', '两条高相等'], '中点条件与对顶角可配合 SAS。', 3, extra);
    if (family === 3) return choice(9, serial, '证明角平分线两侧复杂线段相等，常把目标线段放进', '一对全等三角形', ['同一个圆', '一元一次方程', '统计表'], '全等的对应边是证明线段相等的直接工具。', 3, extra);
    if (family === 4) return choice(9, serial, `点 P 在 ∠AOB 平分线上，到 OA 的距离为 ${a + 2}，到 OB 的距离为`, a + 2, [a + 1, a + 3, 2 * a + 4], '角平分线上的点到角两边距离相等。', 3, extra);
    if (family === 5) return choice(9, serial, '在一对全等三角形中，若目标是证明两个角相等，应使用', '对应角相等', ['对应边相等', '内角和定理即可', '三角形外角和'], '全等三角形的对应角相等。', 3, extra);
    if (family === 6) return choice(9, serial, '综合题中发现两条垂线段都从同一点引出，通常暗示', '角平分线距离模型', ['中位线模型', '勾股模型', '概率模型'], '同一点到角两边的垂线段是距离模型的标志。', 3, extra);
    if (family === 7) return choice(9, serial, '构造全等后，证明一条射线平分一个角，应对应得到', '射线两侧两个角相等', ['两条射线互补', '三边相等', '面积相等即可'], '角平分线定义要求两个分角相等。', 3, extra);
    if (family === 8) return choice(9, serial, '若两个直角三角形只有两个锐角对应相等，则', '不能据此判定全等', ['可用 AAA 判定全等', '可用 HL 判定全等', '必为等腰三角形'], '角相等只能确定形状，不能确定大小。', 3, extra);
    if (family === 9) return choice(9, serial, '“先证全等，再得对应边相等，最后利用线段和差”属于', '全等综合证明链', ['一次函数图象', '因式分解', '轴对称坐标法'], '这是全等综合题的典型推理顺序。', 3, extra);
    if (family === 10) return choice(9, serial, '证明点在角平分线上，除了证两个分角相等，还可证', '点到角两边距离相等', ['点到顶点距离为 0', '两边互相平行', '一个角为 60°'], '利用角平分线逆定理。', 3, extra);
    return choice(9, serial, '高级全等题中，辅助线添加后最重要的是', '逐条说明新得到条件的依据', ['只看图猜对应关系', '忽略构造说明', '把未知当已知'], '辅助线不能引入无依据的条件。', 4, extra);
  }

  if (topicIndex === 10) {
    const extra = [topicKeys[2], topicKeys[8]];
    const angle = 50 + variant * 4;
    if (family === 0) return choice(10, serial, '“一线三等角”模型中，三个位于同一直线附近的等角主要用于', '构造两组三角形角对应关系', ['直接得到三边相等', '计算圆周率', '证明所有点共线'], '等角条件用于建立全等或旋转对应。', 3, extra);
    if (family === 1) return choice(10, serial, `三个等角均为 ${angle}°，其中任意两个角的差为`, '0°', [`${angle}°`, `${180 - angle}°`, '90°'], '三个角相等，任意两角之差为 0°。', 2, extra);
    if (family === 2) return choice(10, serial, '一线三等角模型常见的辅助思路是', '利用平角拆角与等角代换', ['只比较边长数字', '作随机圆', '使用统计平均数'], '同一直线提供 180°，配合三等角进行角度代换。', 3, extra);
    if (family === 3) return choice(10, serial, '若要用 SAS 证明模型中的两个三角形全等，三等角可提供', '一组夹角相等', ['三组边相等', '两个直角', '一组面积相等'], 'SAS 中的 A 是两边之间的夹角。', 3, extra);
    if (family === 4) return choice(10, serial, '模型中若两条对应线段已知相等，再找到公共边和夹角相等，可用', 'SAS', ['AAA', 'SSA', 'AAS'], '两边及夹角相等使用 SAS。', 3, extra);
    if (family === 5) return choice(10, serial, '一线三等角证明完成后，目标线段相等通常来自', '全等三角形对应边相等', ['平角为 180°', '外角和为 360°', '同旁内角互补'], '全等提供线段等量结论。', 3, extra);
    if (family === 6) return choice(10, serial, '在一直线上，相邻两个角的和为', '180°', ['90°', '270°', '360°'], '平角为 180°。', 2, extra);
    if (family === 7) return choice(10, serial, `若平角被分成 ${angle}°、${angle}° 和 ∠x，则 ∠x=`, `${180 - 2 * angle}°`, [`${180 - angle}°`, `${2 * angle}°`, `${90 - angle}°`], '平角内各角之和为 180°。', 2, extra);
    if (family === 8) return choice(10, serial, '三等角条件在推理中可以进行', '等量代换', ['改变角的位置而不说明', '把角换成边', '忽略方向'], '相等的量可以互相替换，但需保持角的对应方向。', 3, extra);
    if (family === 9) return choice(10, serial, '模型题图不按比例时，判断两个三角形是否全等应依据', '已知条件和判定定理', ['视觉大小', '线条颜色', '测量截图'], '几何证明必须依据已知与定理。', 3, extra);
    if (family === 10) return choice(10, serial, '一线三等角与旋转结构结合时，等角通常表示', '相同的转角', ['相同的面积', '相同的周长', '相同的坐标'], '旋转保持角度，相等角可表示同一旋转量。', 3, extra);
    return choice(10, serial, '若模型中角的方向相反，使用等角条件前应先', '明确有向位置并拆角验证', ['直接认定相等', '删除一条边', '把角度乘 2'], '防止把外观相似但位置不对应的角混用。', 4, extra);
  }

  const extra = [topicKeys[2], topicKeys[5]];
  const angle = 40 + variant * 5;
  if (family === 0) return choice(11, serial, '“手拉手”模型通常由两个什么图形共享一个顶点构成？', '等腰或等边三角形', ['任意四边形', '两个圆', '两个梯形'], '两个等腰/等边结构绕公共顶点形成典型手拉手模型。', 3, extra);
  if (family === 1) return choice(11, serial, '手拉手模型中连接两个“外端点”的主要目的为', '构造可证明全等的两个三角形', ['增加周长', '得到平行四边形必然成立', '测量角度'], '连接外端点后常出现 SAS 全等结构。', 3, extra);
  if (family === 2) return choice(11, serial, '两个等腰三角形共顶点，顶角相等时，常见关键角关系为', '旋转后的夹角相等', ['所有角都相等', '两个底角互补', '外角均为 90°'], '相同顶角对应同一旋转量。', 3, extra);
  if (family === 3) return choice(11, serial, '手拉手模型常用的全等判定是', 'SAS', ['AAA', 'SSA', '只有 HL'], '两组腰相等，加上由顶角得到的夹角相等，符合 SAS。', 3, extra);
  if (family === 4) return choice(11, serial, '全等得到两条“外连线”相等后，还可得到', '对应角相等', ['所有点共线', '两个三角形面积为 0', '两直线一定垂直'], '全等三角形的对应角也相等。', 3, extra);
  if (family === 5) return choice(11, serial, `两个等腰三角形的公共顶角均为 ${angle}°，对应旋转角为`, `${angle}°`, [`${180 - angle}°`, `${2 * angle}°`, '90°'], '公共顶角就是一条腰转到另一条腰的旋转角。', 3, extra);
  if (family === 6) return choice(11, serial, '等边三角形手拉手模型中的固定转角是', '60°', ['30°', '90°', '120°'], '等边三角形每个内角都是 60°。', 2, extra);
  if (family === 7) return choice(11, serial, '在手拉手模型中，若两组三角形的腰分别相等，夹角也相等，则', '可用 SAS 证全等', ['只能证相似', '无法判断', '可用 AAA 证全等'], '两边及夹角相等正是 SAS。', 3, extra);
  if (family === 8) return choice(11, serial, '模型中“旋转前后的线段长度不变”可提供', '对应边相等', ['对应边互补', '面积变为两倍', '角度变为 0'], '旋转是全等变换，保持距离。', 3, extra);
  if (family === 9) return choice(11, serial, '手拉手题中若图形交叉，应先', '按顶点对应顺序重新标出两个待证三角形', ['按视觉左右随意对应', '忽略交点', '只计算周长'], '交叉图形最易错在对应顺序，需先明确顶点。', 4, extra);
  if (family === 10) return choice(11, serial, '手拉手模型的结论不依赖示意图比例，原因是', '由全等判定和已知等量推出', ['图形画得对称', '可以量出长度', '默认所有腰相等'], '严格结论来自条件与定理。', 3, extra);
  return choice(11, serial, '把手拉手模型看作绕公共顶点的变换，最合适的是', '旋转', ['平移', '轴向拉伸', '随机移动'], '一组腰绕共同顶点转到另一组腰，长度和夹角保持。', 4, extra);
}

function fillProblem(topicIndex, serial) {
  const topic = topics[topicIndex];
  const family = serial % 4;
  const variant = Math.floor(serial / 4);
  const n = 3 + variant;
  let prompt;
  let answer;
  let explanation;
  let diagram = 'triangle';
  const extra = [];

  if (topicIndex === 0) {
    if (family === 0) { prompt = `三角形两边长为 ${n + 2}、${n + 5}，第三边为整数。第三边共有____种取值。`; answer = String(2 * (n + 2) - 1); explanation = '由两边之差<第三边<两边之和，逐个整数计数。'; }
    if (family === 1) { prompt = `AM 是 △ABC 的中线，BM=${n + 2} cm，则 BC=____cm。`; answer = String(2 * (n + 2)); explanation = '中线经过对边中点，BM=CM。'; }
    if (family === 2) { prompt = `△ABC 三边为 ${n + 1}、${n + 3}、${2 * n + 1}，其周长为____。`; answer = String(4 * n + 5); explanation = '三边相加。'; }
    if (family === 3) { prompt = `三角形两边长为 ${n + 1} 和 ${n + 6}，整数第三边的最小值为____。`; answer = '6'; explanation = '第三边大于两边之差 5，最小整数为 6。'; }
  } else if (topicIndex === 1) {
    const a = 35 + variant * 5;
    if (family === 0) { prompt = `△ABC 中，∠A=${a}°，∠B=${65 - variant * 3}°，则 ∠C=____°。`; answer = String(80 - variant * 2); explanation = '三角形内角和为 180°。'; }
    if (family === 1) { prompt = `三角形一个外角为 ${120 + variant * 5}°，与它相邻的内角为____°。`; answer = String(60 - variant * 5); explanation = '相邻内外角互补。'; }
    if (family === 2) { prompt = `直角三角形一个锐角为 ${a}°，另一个锐角为____°。`; answer = String(90 - a); explanation = '两个锐角互余。'; }
    if (family === 3) { prompt = `三角形三个内角之比为 2∶3∶4，最大角为____°。`; answer = '80'; explanation = '每份 20°，最大角 80°。'; }
  } else if (topicIndex === 2) {
    if (family === 0) { prompt = `△ABC≌△DEF，A、B、C 分别对应 D、E、F。若 BC=${n + 4}，则 EF=____。`; answer = String(n + 4); explanation = '全等三角形对应边相等。'; }
    if (family === 1) { prompt = `△ABC≌△DEF，若 ∠A=${40 + variant * 8}°，则 ∠D=____°。`; answer = String(40 + variant * 8); explanation = '全等三角形对应角相等。'; }
    if (family === 2) { prompt = `两个直角三角形斜边和一条直角边分别相等，可用____判定全等。`; answer = 'HL'; explanation = '直角三角形的斜边、直角边判定。'; }
    if (family === 3) { prompt = `三边分别相等的两个三角形可用____判定全等。`; answer = 'SSS'; explanation = '三边对应相等。'; }
  } else if (topicIndex === 3) {
    extra.push(topicKeys[2]);
    if (family === 0) { prompt = `点 P 在 ∠AOB 的平分线上，P 到 OA 的距离为 ${n + 2}，则 P 到 OB 的距离为____。`; answer = String(n + 2); explanation = '角平分线上的点到角两边距离相等。'; }
    if (family === 1) { prompt = `OP 平分 ${70 + variant * 10}° 的角，则其中一个分角为____°。`; answer = String(35 + variant * 5); explanation = '角平分线把角平均分。'; }
    if (family === 2) { prompt = `两个直角三角形有公共斜边，且一条直角边分别相等，可用____判定全等。`; answer = 'HL'; explanation = '符合 HL 条件。'; }
    if (family === 3) { prompt = `在角内部，若一点到角两边距离相等，则该点在角的____上。`; answer = '角平分线'; explanation = '角平分线性质的逆定理。'; }
  } else if (topicIndex === 4) {
    diagram = 'symmetry';
    if (family === 0) { prompt = `点 P(${n},${n + 2}) 关于 x 轴对称的点坐标为____。`; answer = `(${n},-${n + 2})`; explanation = '横坐标不变，纵坐标变号。'; }
    if (family === 1) { prompt = `点 A(-${n},${n + 1}) 关于 y 轴对称的点坐标为____。`; answer = `(${n},${n + 1})`; explanation = '纵坐标不变，横坐标变号。'; }
    if (family === 2) { prompt = `A、B 关于直线 l 对称，AB=${2 * n + 4}，l 交 AB 于 M，则 AM=____。`; answer = String(n + 2); explanation = '对称轴垂直平分对应点连线。'; }
    if (family === 3) { prompt = `等边三角形有____条对称轴。`; answer = '3'; explanation = '三条中线所在直线都是对称轴。'; }
  } else if (topicIndex === 5) {
    if (family === 0) { prompt = `等腰三角形一个底角为 ${40 + variant * 5}°，顶角为____°。`; answer = String(100 - variant * 10); explanation = '顶角=180°-2×底角。'; }
    if (family === 1) { prompt = `等腰三角形顶角为 ${40 + variant * 10}°，一个底角为____°。`; answer = String(70 - variant * 5); explanation = '两底角相等。'; }
    if (family === 2) { prompt = `等边三角形每个内角为____°。`; answer = '60'; explanation = '三个角相等且和为 180°。'; }
    if (family === 3) { prompt = `等腰三角形周长为 ${3 * (n + 2)}，底边为 ${n + 2}，腰长为____。`; answer = String(n + 2); explanation = '两腰相等，腰长=(周长-底边)÷2。'; }
  } else if (topicIndex === 6) {
    diagram = 'algebra';
    if (family === 0) { prompt = `计算：x^${n}·x^${n + 2}=____。`; answer = `x^${2 * n + 2}`; explanation = '同底数幂相乘，指数相加。'; }
    if (family === 1) { prompt = `计算：(a^${n})³=____。`; answer = `a^${3 * n}`; explanation = '幂的乘方，指数相乘。'; }
    if (family === 2) { prompt = `计算：${n}x(x+${n + 1})=____。`; answer = `${n}x²+${n * (n + 1)}x`; explanation = '单项式逐项乘多项式。'; }
    if (family === 3) { prompt = `计算：(x+${n})(x+${n + 2})=____。`; answer = `x²+${2 * n + 2}x+${n * (n + 2)}`; explanation = '逐项相乘并合并同类项。'; }
  } else if (topicIndex === 7) {
    diagram = 'algebra';
    if (family === 0) { prompt = `展开：(x+${n})²=____。`; answer = `x²+${2 * n}x+${n * n}`; explanation = '使用完全平方公式。'; }
    if (family === 1) { prompt = `因式分解：x²-${n * n}=____。`; answer = `(x+${n})(x-${n})`; explanation = '使用平方差公式。'; }
    if (family === 2) { prompt = `因式分解：${n}x²+${n * (n + 1)}x=____。`; answer = `${n}x(x+${n + 1})`; explanation = '提取公因式 nx。'; }
    if (family === 3) { prompt = `用公式计算：${100 - n}×${100 + n}=____。`; answer = String(10000 - n * n); explanation = '平方差公式。'; }
  } else if (topicIndex === 8) {
    diagram = 'parallel';
    if (family === 0) { prompt = `两直线平行，一个同位角为 ${40 + variant * 8}°，对应同位角为____°。`; answer = String(40 + variant * 8); explanation = '同位角相等。'; }
    if (family === 1) { prompt = `两直线平行，一个同旁内角为 ${70 + variant * 5}°，另一个为____°。`; answer = String(110 - variant * 5); explanation = '同旁内角互补。'; }
    if (family === 2) { prompt = `∠1 与 ∠2 互余，∠1=${30 + variant * 5}°，则 ∠2=____°。`; answer = String(60 - variant * 5); explanation = '互余两角和为 90°。'; }
    if (family === 3) { prompt = `平角被分成 ${40 + variant * 5}°、${50 + variant * 5}° 和 ∠x，则 ∠x=____°。`; answer = String(90 - variant * 10); explanation = '平角为 180°。'; }
  } else if (topicIndex === 9) {
    extra.push(topicKeys[2], topicKeys[3]);
    if (family === 0) { prompt = `角平分线上的点到一边距离为 ${n + 4}，到另一边距离为____。`; answer = String(n + 4); explanation = '角平分线距离性质。'; }
    if (family === 1) { prompt = `直角三角形综合中，斜边和一条直角边分别相等，判定方法为____。`; answer = 'HL'; explanation = '使用 HL 判定。'; }
    if (family === 2) { prompt = `AM 是中线，且 AM=BM=${n + 3}。延长 AM 到点 N，使 MN=AM，则 AN=____。`; answer = String(2 * (n + 3)); explanation = 'AN=AM+MN=2AM。'; }
    if (family === 3) { prompt = `证明一点在角平分线上，可证明它到角两边的____相等。`; answer = '距离'; explanation = '角平分线逆定理。'; }
  } else if (topicIndex === 10) {
    extra.push(topicKeys[2], topicKeys[8]);
    diagram = 'one-line';
    if (family === 0) { prompt = `一条直线上的平角被两个相等角 ${45 + variant * 5}°、${45 + variant * 5}° 分割，余角为____°。`; answer = String(90 - variant * 10); explanation = '平角减去两个相等角。'; }
    if (family === 1) { prompt = `一线三等角均为 ${40 + variant * 5}°，任意两角之差为____°。`; answer = '0'; explanation = '相等角之差为 0°。'; }
    if (family === 2) { prompt = `用 SAS 证明全等时，三等角可提供一组相等的____。`; answer = '夹角'; explanation = 'SAS 需要两边及其夹角。'; }
    if (family === 3) { prompt = `一线模型中相邻角组成平角，它们的和为____°。`; answer = '180'; explanation = '平角为 180°。'; }
  } else {
    extra.push(topicKeys[2], topicKeys[5]);
    diagram = 'rotation';
    if (family === 0) { prompt = `等边三角形手拉手模型的固定旋转角为____°。`; answer = '60'; explanation = '等边三角形内角为 60°。'; }
    if (family === 1) { prompt = `两组腰及夹角分别相等，常用____判定两个三角形全等。`; answer = 'SAS'; explanation = '两边及夹角判定。'; }
    if (family === 2) { prompt = `旋转变换前后，对应线段长度____。（填“相等”或“不等”）`; answer = '相等'; explanation = '旋转保持距离。'; }
    if (family === 3) { prompt = `两个共顶点等腰三角形的顶角都为 ${40 + variant * 10}°，对应旋转角为____°。`; answer = String(40 + variant * 10); explanation = '公共顶角就是旋转角。'; }
  }

  return {
    source_key: `g8-original-fill-${String(topicIndex + 1).padStart(2, '0')}-${String(serial + 1).padStart(2, '0')}`,
    question_type: 'fill',
    title: `${topic.short_title}·填空 ${serial + 1}`,
    prompt: `【填空变式 ${variant + 1}】${prompt}`,
    answer_text: `${answer}\n解析：${explanation}`,
    answer,
    explanation,
    grade_code: 'g8',
    subject_code: 'math',
    topic_key: topic.topic_key,
    topic_keys: [...new Set([topic.topic_key, ...extra])],
    difficulty: serial < 4 ? 2 : serial < 9 ? 3 : 4,
    source_label: `初二暑数学简易版本·第${topicIndex + 1}讲·原创改编`,
    provenance: 'self_authored',
    diagram,
  };
}

function subjectiveProblem(topicIndex, serial) {
  const topic = topics[topicIndex];
  const family = serial % 4;
  const variant = Math.floor(serial / 4);
  const n = 3 + variant;
  const extra = [];
  let prompt;
  let answer;
  let diagram = 'triangle';

  if (topicIndex === 0) {
    if (family === 0) { prompt = `△ABC 中，AB=${n + 2}，AC=${n + 5}，第三边 BC 为整数。求 BC 的所有可能值，并说明理由。`; answer = `由三角形两边之差小于第三边、第三边小于两边之和，得 3<BC<${2 * n + 7}。因此 BC 可取 4 到 ${2 * n + 6} 的所有整数。`; }
    if (family === 1) { prompt = `△ABC 周长为 ${4 * n + 14}，AM 是 BC 边上的中线，BM=${n + 2}，AB=${n + 3}。求 AC。`; answer = `AM 是中线，所以 BC=2BM=${2 * n + 4}。AC=周长-AB-BC=${n + 7}。`; }
    if (family === 2) { prompt = `判断长度 ${n + 1}、${n + 3}、${2 * n + 4} 能否组成三角形，并写出判断过程。`; answer = `不能。最短两边之和为 ${2 * n + 4}，等于第三边，不满足“两边之和大于第三边”。`; }
    if (family === 3) { prompt = '分别写出三角形中线、高、角平分线的定义，并说明它们的共同点与区别。'; answer = '中线连接顶点与对边中点；高是顶点到对边所在直线的垂线段；角平分线是顶点出发平分该内角的射线在三角形内的部分。三者都从顶点出发，但对应条件分别是中点、垂直、角相等。'; }
  } else if (topicIndex === 1) {
    const a = 35 + variant * 5;
    if (family === 0) { prompt = `△ABC 中，∠A=${a}°，∠B 比 ∠C 小 ${10 + variant * 2}°。求 ∠B、∠C。`; answer = `设 ∠C=x°，则 ∠B=(x-${10 + variant * 2})°。由内角和得 ${a}+x+x-${10 + variant * 2}=180，解得 ∠C=${(190 - a + variant * 2) / 2}°，∠B=${(170 - a - variant * 2) / 2}°。`; }
    if (family === 1) { prompt = `△ABC 的 ∠C 外角为 ${120 + variant * 5}°，∠A=${45 + variant * 3}°。求 ∠B。`; answer = `外角等于两个不相邻内角之和，所以 ∠B=${120 + variant * 5}-${45 + variant * 3}=${75 + variant * 2}°。`; }
    if (family === 2) { prompt = '证明：三角形的一个外角大于任何一个与它不相邻的内角。'; answer = '设 ∠ACD 是 △ABC 的外角。由外角性质，∠ACD=∠A+∠B。因为三角形内角均大于 0°，所以 ∠ACD>∠A 且 ∠ACD>∠B。'; }
    if (family === 3) { prompt = `三角形三个外角（每个顶点各取一个）之比为 3∶4∶5。求三个内角。`; answer = '外角和为 360°，每份 30°，三个外角为 90°、120°、150°；相邻内角分别为 90°、60°、30°。'; }
  } else if (topicIndex === 2) {
    if (family === 0) { prompt = '已知 AB=DE，AC=DF，∠A=∠D。证明 △ABC≌△DEF，并写出所有对应关系。'; answer = 'AB=DE、AC=DF、∠A=∠D，且该角为两边夹角，由 SAS 得 △ABC≌△DEF。对应顶点 A↔D、B↔E、C↔F，对应边 BC=EF，对应角 ∠B=∠E、∠C=∠F。'; }
    if (family === 1) { prompt = '在 △ABC 与 △DCB 中，AB=DC，AC=DB。证明两三角形全等，并说明 ∠ABC 与 ∠DCB 的关系。'; answer = 'BC=CB 为公共边，结合 AB=DC、AC=DB，由 SSS 得 △ABC≌△DCB，所以对应角 ∠ABC=∠DCB。'; }
    if (family === 2) { prompt = '说明为什么 AAA 不能判定两个三角形全等，并给出一个反例思路。'; answer = 'AAA 只能确定三个角，从而确定形状，不能确定大小。例如边长为 3、4、5 的直角三角形与边长为 6、8、10 的直角三角形三个角分别相等，但边长不同，不全等。'; }
    if (family === 3) { prompt = `两个直角三角形斜边均为 ${n + 7}，一条直角边均为 ${n + 2}。说明它们为什么全等，并写出判定方法。`; answer = '两三角形都是直角三角形，斜边和一条直角边分别相等，依据 HL 判定两直角三角形全等。'; }
  } else if (topicIndex === 3) {
    extra.push(topicKeys[2]);
    if (family === 0) { prompt = '点 P 在 ∠AOB 的平分线上，PM⊥OA，PN⊥OB。证明 PM=PN。'; answer = '在 Rt△OPM 与 Rt△OPN 中，OP 为公共斜边；∠MOP=∠PON；也可由 AAS，或直接用角平分线性质，得 PM=PN。若按全等证明：∠OMP=∠ONP=90°，∠MOP=∠PON，OP=OP，由 AAS 得两三角形全等，所以 PM=PN。'; }
    if (family === 1) { prompt = '点 P 在 ∠AOB 内部，PM⊥OA，PN⊥OB，且 PM=PN。证明 OP 平分 ∠AOB。'; answer = '在 Rt△OPM 与 Rt△OPN 中，OP 为公共斜边，PM=PN，由 HL 得两三角形全等，所以 ∠MOP=∠PON，即 OP 平分 ∠AOB。'; }
    if (family === 2) { prompt = '在 △ABC 中，AB=AC，AD 平分 ∠BAC。证明 BD=CD 且 AD⊥BC。'; answer = '在 △ABD 与 △ACD 中，AB=AC，AD=AD，∠BAD=∠CAD，由 SAS 得全等，所以 BD=CD、∠ADB=∠ADC。两角又组成平角，故均为 90°，AD⊥BC。'; }
    if (family === 3) { prompt = `OP 平分 ∠AOB，点 P 到 OA、OB 的垂足为 M、N，PM=${n + 3}。求 PN，并说明依据。`; answer = `PN=${n + 3}。依据：角平分线上的点到角两边的距离相等。`; }
  } else if (topicIndex === 4) {
    diagram = 'symmetry';
    if (family === 0) { prompt = `在平面直角坐标系中，写出 △ABC 三个顶点 A(${n},2)、B(-${n + 1},4)、C(1,-${n}) 关于 y 轴对称后的坐标，并说明规律。`; answer = `A'(-${n},2)、B'(${n + 1},4)、C'(-1,-${n})。关于 y 轴对称时纵坐标不变，横坐标变号。`; }
    if (family === 1) { prompt = '已知点 P 在线段 AB 的垂直平分线上。证明 PA=PB。'; answer = '设垂直平分线交 AB 于 M，则 AM=BM、PM=PM，且 ∠PMA=∠PMB=90°。由 SAS（或直角三角形两直角边）得 △PMA≌△PMB，所以 PA=PB。'; }
    if (family === 2) { prompt = '已知 PA=PB。证明点 P 在线段 AB 的垂直平分线上。'; answer = '取 AB 中点 M，连接 PM。在 △PMA 与 △PMB 中，PA=PB，AM=BM，PM=PM，由 SSS 得全等，所以 ∠PMA=∠PMB。两角组成平角，故均为 90°，PM 垂直且平分 AB，P 在垂直平分线上。'; }
    if (family === 3) { prompt = '说明轴对称变换为什么保持图形的周长和面积。'; answer = '轴对称是全等变换，对应线段长度、对应角均保持不变，图形被映成与原图全等的图形。因此各边长度总和不变，面积也不变。'; }
  } else if (topicIndex === 5) {
    if (family === 0) { prompt = `等腰 △ABC 中，AB=AC，∠A=${40 + variant * 10}°。求 ∠B、∠C。`; answer = `∠B=∠C=(180°-${40 + variant * 10}°)÷2=${70 - variant * 5}°。`; }
    if (family === 1) { prompt = '在等腰 △ABC 中，AB=AC，AD 是 BC 边上的中线。证明 AD 平分 ∠A 且 AD⊥BC。'; answer = 'BD=CD，AB=AC，AD=AD，由 SSS 得 △ABD≌△ACD，所以 ∠BAD=∠CAD，AD 平分 ∠A；∠ADB=∠ADC 且二者组成平角，故均为 90°，AD⊥BC。'; }
    if (family === 2) { prompt = '证明：有一个角为 60° 的等腰三角形是等边三角形。'; answer = '若 60° 为顶角，则两底角各为 (180°-60°)÷2=60°；若 60° 为底角，则另一个底角也为 60°，顶角为 60°。三角均为 60°，由等角对等边得三边相等。'; }
    if (family === 3) { prompt = `等腰三角形周长为 ${4 * n + 18}，一边长为 ${2 * n + 8}。分类讨论三边长，并判断是否都能组成三角形。`; answer = `若已知边为底边，两腰各为 ${(2 * n + 10) / 2}=n+5，需检验 2(n+5)>2n+8，即 2>0，成立。若已知边为腰，底边为 ${4 * n + 18}-2(${2 * n + 8})=2，需检验 2+${2 * n + 8}>${2 * n + 8}，成立。因此两种均可。`; }
  } else if (topicIndex === 6) {
    diagram = 'algebra';
    if (family === 0) { prompt = `计算并化简：(${n}x²y)·(-${n + 1}xy²)÷(x²y)，写出步骤。`; answer = `先乘得 -${n * (n + 1)}x³y³，再除以 x²y，结果为 -${n * (n + 1)}xy²。`; }
    if (family === 1) { prompt = `化简：(x+${n})(x+${n + 2})-${n}x，并按降幂排列。`; answer = `展开得 x²+${2 * n + 2}x+${n * (n + 2)}-${n}x=x²+${n + 2}x+${n * (n + 2)}。`; }
    if (family === 2) { prompt = `已知 2^a=8，2^b=${2 ** (n + 1)}，求 2^(a+b) 并说明依据。`; answer = `a=3，b=${n + 1}。2^(a+b)=2^a·2^b=8×${2 ** (n + 1)}=${2 ** (n + 4)}。`; }
    if (family === 3) { prompt = `先化简再求值：${n}x(x+2)-(x+1)(x-1)，其中 x=2。`; answer = `原式=${n}x²+${2 * n}x-(x²-1)=${n - 1}x²+${2 * n}x+1。代入 x=2，得 ${4 * (n - 1) + 4 * n + 1}。`; }
  } else if (topicIndex === 7) {
    diagram = 'algebra';
    if (family === 0) { prompt = `用乘法公式计算 ${98 - variant}²，并写出过程。`; answer = `${98 - variant}²=(100-${2 + variant})²=10000-${200 * (2 + variant)}+${(2 + variant) ** 2}=${(98 - variant) ** 2}。`; }
    if (family === 1) { prompt = `因式分解：${n}x³-${n * n * n}x。`; answer = `先提公因式 ${n}x，得 ${n}x(x²-${n * n})=${n}x(x+${n})(x-${n})。`; }
    if (family === 2) { prompt = `已知 x+y=${2 * n + 1}，xy=${n * (n + 1)}。求 (x-y)²。`; answer = `(x-y)²=(x+y)²-4xy=${(2 * n + 1) ** 2}-${4 * n * (n + 1)}=1。`; }
    if (family === 3) { prompt = `因式分解并检验：x²+${2 * n}x+${n * n}-${n + 1}²。`; answer = `前 3 项为 (x+${n})²，所以原式=(x+${n})²-${(n + 1) ** 2}=(x-1)(x+${2 * n + 1})。展开可还原原式。`; }
  } else if (topicIndex === 8) {
    diagram = 'parallel';
    if (family === 0) { prompt = `两条平行线被一条折线所截，两个同向转角分别为 ${30 + variant * 5}°、${45 + variant * 5}°。作过折点的平行线，求总转角。`; answer = `利用内错角相等把两角转移到折点，总转角为 ${75 + variant * 10}°。`; }
    if (family === 1) { prompt = '证明：若两个角分别与同一个角互补，则这两个角相等。'; answer = '设 ∠1+∠3=180°，∠2+∠3=180°。两式相减得 ∠1=∠2。'; }
    if (family === 2) { prompt = `平角 AOB 内有射线 OC、OD，∠AOC=${40 + variant * 5}°，∠BOD=${50 + variant * 5}°，且 OC、OD 位于平角内部。求 ∠COD。`; answer = `∠AOC+∠COD+∠DOB=180°，所以 ∠COD=${90 - variant * 10}°。`; }
    if (family === 3) { prompt = '说明“过折点作已知平行线的平行线”在角度模型中的作用，并写出可使用的角关系。'; answer = '新平行线把分散在两端的角转移到同一顶点。可使用同位角相等、内错角相等、同旁内角互补，再通过角的和差得到目标角。'; }
  } else if (topicIndex === 9) {
    extra.push(topicKeys[2], topicKeys[3]);
    if (family === 0) { prompt = '在 ∠AOB 内有点 P，PM⊥OA、PN⊥OB，且 PM=PN。连接 OP。证明 OP 平分 ∠AOB，并写出完整全等链。'; answer = 'Rt△OPM 与 Rt△OPN 中，OP=OP，PM=PN，由 HL 得两三角形全等，所以 ∠MOP=∠PON，即 OP 平分 ∠AOB。'; }
    if (family === 1) { prompt = '△ABC 中，M 是 BC 中点。延长 AM 到 N，使 MN=AM。证明 AB=CN 且 AB∥CN。'; answer = '在 △AMB 与 △NMC 中，AM=MN，BM=CM，∠AMB=∠NMC（对顶角），由 SAS 得全等。所以 AB=CN，∠ABM=∠NCM；这是一组内错角相等，故 AB∥CN。'; }
    if (family === 2) { prompt = '已知 AD 平分 ∠BAC，点 D 到 AB、AC 的垂足为 E、F。证明 AE=AF。'; answer = 'Rt△ADE 与 Rt△ADF 中，AD 为公共斜边，∠EAD=∠DAF，由 AAS（或结合直角与公共斜边）得全等，所以 AE=AF。'; }
    if (family === 3) { prompt = '线段和差问题中，说明“截长补短 + 全等”的标准证明结构。'; answer = '先在较长线段上截取与某已知线段相等的部分，或延长较短线段补出等长部分；再利用角、公共边等条件证明构造出的两个三角形全等；由对应边相等把目标线段和差转化，最后用线段加减得到结论。'; }
  } else if (topicIndex === 10) {
    extra.push(topicKeys[2], topicKeys[8]);
    diagram = 'one-line';
    if (family === 0) { prompt = '在一直线上依次有 A、O、B，射线 OC、OD 位于同侧，且 ∠AOC=∠COD=∠DOB。求每个角，并说明。'; answer = '三个角组成平角，设每个为 x，则 3x=180°，所以 x=60°。'; }
    if (family === 1) { prompt = '一线三等角模型中，已知两组三角形有两组对应边相等。说明如何利用三等角找到 SAS 所需的夹角。'; answer = '利用平角拆分，把包含共线反向射线的角写成 180° 减去已知等角；再用三个等角的等量代换，得到两组相等边之间的夹角相等，从而满足 SAS。'; }
    if (family === 2) { prompt = '已知 A、O、B 共线，∠AOC=∠BOD，且 OC=OD、OA=OB。证明 △AOC≌△BOD。'; answer = 'OA=OB，OC=OD，∠AOC=∠BOD，且该角是两边夹角，由 SAS 得 △AOC≌△BOD。'; }
    if (family === 3) { prompt = '一线三等角图形发生交叉时，怎样避免写错全等对应顺序？请给出操作步骤。'; answer = '先按已知相等边分别标出端点；再确认等角是两组相等边的夹角；按“第一组边端点—夹角顶点—第二组边端点”的顺序写两个三角形；最后逐项核对对应边和对应角，不能按图形左右位置猜测。'; }
  } else {
    extra.push(topicKeys[2], topicKeys[5]);
    diagram = 'rotation';
    if (family === 0) { prompt = '等边 △AOB 与等边 △COD 共用顶点 O，连接 AC、BD。说明在标准手拉手位置下，如何证明 △AOC≌△BOD。'; answer = 'OA=OB、OC=OD；∠AOC 与 ∠BOD 都由公共转角加（或减）60°得到，因此相等。由 SAS 得 △AOC≌△BOD，进而 AC=BD。'; }
    if (family === 1) { prompt = '两个等腰三角形 AOB、COD 共顶点 O，OA=OB、OC=OD，且 ∠AOB=∠COD。证明在同向旋转位置下 ∠AOC=∠BOD。'; answer = '按同向位置拆角：∠AOC=∠AOB+∠BOC，∠BOD=∠BOC+∠COD。由 ∠AOB=∠COD，等量相加得 ∠AOC=∠BOD。'; }
    if (family === 2) { prompt = '在手拉手模型中已证 △AOC≌△BOD。写出至少两条可继续使用的结论，并说明对应关系。'; answer = '由对应顶点 A↔B、O↔O、C↔D，可得 AC=BD，∠CAO=∠DBO，∠ACO=∠BDO。实际使用时必须按全等式顺序确认对应。'; }
    if (family === 3) { prompt = '把一个等边三角形绕公共顶点旋转，说明为什么手拉手模型中的对应线段相等、对应角相等。'; answer = '旋转保持点到旋转中心的距离、任意两点间距离和角的大小，是全等变换。等边三角形旋转 60° 后，一组腰与另一组腰对应，进而形成 SAS 全等结构，所以对应线段、对应角相等。'; }
  }

  return {
    source_key: `g8-original-subjective-${String(topicIndex + 1).padStart(2, '0')}-${String(serial + 1).padStart(2, '0')}`,
    question_type: 'subjective',
    title: `${topic.short_title}·解答 ${serial + 1}`,
    prompt: `【解答变式 ${variant + 1}】${prompt}`,
    answer_text: answer,
    answer,
    explanation: answer,
    grade_code: 'g8',
    subject_code: 'math',
    topic_key: topic.topic_key,
    topic_keys: [...new Set([topic.topic_key, ...extra])],
    difficulty: serial < 4 ? 3 : serial < 9 ? 4 : 5,
    source_label: `初二暑数学简易版本·第${topicIndex + 1}讲·原创改编`,
    provenance: 'self_authored',
    diagram,
  };
}

const choices = topics.flatMap((_, topicIndex) => Array.from({ length: 60 }, (_, serial) => topicChoice(topicIndex, serial)));
const fills = topics.flatMap((_, topicIndex) => Array.from({ length: 12 }, (_, serial) => fillProblem(topicIndex, serial)));
const subjectives = topics.flatMap((_, topicIndex) => Array.from({ length: 12 }, (_, serial) => subjectiveProblem(topicIndex, serial)));
const terminals = [...fills, ...subjectives];
const sample = topics.flatMap((topic) => [
  ...choices.filter((item) => item.topic_key === topic.topic_key).slice(0, 2),
  fills.find((item) => item.topic_key === topic.topic_key),
  subjectives.find((item) => item.topic_key === topic.topic_key),
]);

module.exports = {
  choices,
  fills,
  subjectives,
  terminals,
  sample,
};
