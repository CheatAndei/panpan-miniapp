const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  validateStudentCurriculumManifest,
} = require('../services/student-practice-curriculum');

const manifestPath = path.join(
  __dirname,
  '..',
  'resources',
  'practice',
  'curricula',
  'feng-haoyuan-2026-07-28-v1.json',
);

function visibleText(render) {
  return (render?.blocks || []).map((block) => {
    if (block.type === 'fraction') return `${block.numerator}—${block.denominator}`;
    if (block.type === 'line_break') return '\n';
    return String(block.value || '');
  }).join('');
}

test('冯浩源 7 月 28 日起 22 天题单严格对应 PDF 第 4-25 页', () => {
  const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const validated = validateStudentCurriculumManifest(raw);
  assert.equal(validated.ok, true, validated.errors.join('；'));

  assert.equal(raw.student_match.external_id, 'stu_0a8c984b2ea3ccb0ee926c7ec1a32b2b');
  assert.equal(raw.metadata.start_date, '2026-07-28');
  assert.equal(raw.metadata.end_date, '2026-08-18');
  assert.equal(
    raw.metadata.source_document.sha256,
    '7fd4bd44f04056d72e42c40f0e6c600552778c508803d0d7ca6df9081b691d47',
  );
  assert.deepEqual(raw.metadata.retirement_guard.expected_plans, [{
    plan_id: 10,
    title: '浩源计算打卡',
    teacher_nickname: '潘潘',
    class_name: '浩源加油站',
    start_date: '2026-07-27',
    end_date: '2026-07-29',
    retire_to: '2026-07-27',
    active_student_external_ids: ['stu_0a8c984b2ea3ccb0ee926c7ec1a32b2b'],
  }]);

  assert.equal(raw.days.length, 22);
  assert.deepEqual(raw.days.map((day) => day.source_page), Array.from({ length: 22 }, (_, i) => i + 4));
  assert.ok(raw.days.every((day) => day.questions.length === 10));
  assert.ok(raw.days.every((day) => (
    day.questions.every((question) => question.template_key === day.question_type_key)
  )));

  const questions = raw.days.flatMap((day) => day.questions);
  assert.equal(new Set(questions.map((question) => question.signature)).size, 220);
  assert.ok(questions.every((question) => question.provenance === 'self_authored'));
  assert.ok(questions.every((question) => !question.stem.includes('/')));
  assert.ok(questions.every((question) => !visibleText(question.render).includes('/')));
  assert.ok(questions.every((question) => !visibleText(question.answer_render).includes('/')));
  assert.ok(questions.filter((question) => question.answer.includes('/')).every((question) => (
    question.answer_render?.blocks?.some((block) => block.type === 'fraction')
  )));

  const page15Stems = raw.days.find((day) => day.source_page === 15).questions.map((question) => question.stem);
  assert.ok(page15Stems.some((stem) => stem.includes('对称')));
  assert.ok(page15Stems.some((stem) => !stem.includes('对称')));

  const page16Stems = raw.days.find((day) => day.source_page === 16).questions.map((question) => question.stem);
  assert.ok(page16Stems.some((stem) => stem.includes('位于数')));
  assert.ok(page16Stems.some((stem) => stem.includes('a＜b＜0＜c')));

  const page20Stems = raw.days.find((day) => day.source_page === 20).questions.map((question) => question.stem);
  assert.ok(page20Stems.some((stem) => stem.includes('给定的x、y值')));
  assert.ok(page20Stems.some((stem) => stem.includes('非负性')));
});
