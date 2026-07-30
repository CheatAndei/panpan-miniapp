const GRADE_CODE = 'g8';
const SUBJECT_CODE = 'math';

const topics = Object.freeze([
  {
    topic_key: 'g8-summer-01-triangle-lines',
    title: '第1讲 三角形的边与重要三线',
    short_title: '三角形的边与重要三线',
    sort_order: 1,
  },
  {
    topic_key: 'g8-summer-02-triangle-angles',
    title: '第2讲 三角形的内外角性质',
    short_title: '三角形的内外角性质',
    sort_order: 2,
  },
  {
    topic_key: 'g8-summer-03-congruence',
    title: '第3讲 全等三角形的性质与判定',
    short_title: '全等三角形的性质与判定',
    sort_order: 3,
  },
  {
    topic_key: 'g8-summer-04-congruence-bisector-basic',
    title: '第4讲 全等综合及角平分线',
    short_title: '全等与角平分线（基础）',
    sort_order: 4,
  },
  {
    topic_key: 'g8-summer-05-axis-symmetry',
    title: '第5讲 轴对称',
    short_title: '轴对称',
    sort_order: 5,
  },
  {
    topic_key: 'g8-summer-06-isosceles-equilateral',
    title: '第6讲 等腰及等边三角形',
    short_title: '等腰及等边三角形',
    sort_order: 6,
  },
  {
    topic_key: 'g8-summer-07-powers-polynomials',
    title: '第7讲 幂的运算与整式的乘法',
    short_title: '幂与整式乘法',
    sort_order: 7,
  },
  {
    topic_key: 'g8-summer-08-formulas-factorization',
    title: '第8讲 乘法公式与因式分解',
    short_title: '乘法公式与因式分解',
    sort_order: 8,
  },
  {
    topic_key: 'g8-summer-09-angle-models',
    title: '第9讲 角度模型',
    short_title: '角度模型',
    sort_order: 9,
  },
  {
    topic_key: 'g8-summer-10-congruence-bisector-advanced',
    title: '第10讲 全等综合及角平分线',
    short_title: '全等与角平分线（综合）',
    sort_order: 10,
  },
  {
    topic_key: 'g8-summer-11-one-line-three-angles',
    title: '第11讲 一线三等角模型',
    short_title: '一线三等角模型',
    sort_order: 11,
  },
  {
    topic_key: 'g8-summer-12-hand-in-hand',
    title: '第12讲 手拉手模型',
    short_title: '手拉手模型',
    sort_order: 12,
  },
]);

const topicKeys = Object.freeze(topics.map((item) => item.topic_key));
const topicKeySet = new Set(topicKeys);

module.exports = {
  GRADE_CODE,
  SUBJECT_CODE,
  SOURCE_LABEL: '初二暑数学简易版本·12讲固定范围',
  topics,
  topicKeys,
  topicKeySet,
};
