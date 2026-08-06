const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const page = fs.readFileSync(path.join(__dirname, '..', 'pages', 'practice-teacher', 'index.vue'), 'utf8');

test('教师先确认不可逆锁定，再打开学生剩余日期 PDF', () => {
  assert.match(page, /生成并锁定剩余 PDF/u);
  assert.match(page, /打开已锁定 PDF/u);
  assert.match(page, /生成并锁定 PDF？/u);
  assert.match(page, /锁定后不再随成绩变化，且不能撤销/u);
  assert.match(page, /confirmPdfFreeze/u);
  assert.match(page, /students\/\$\{student\.student_id\}\/freeze-remaining/u);
  assert.match(page, /plans\/\$\{pdfPlan\.value\.id\}\/pdf\?student_id=/u);
});

test('PDF 弹窗完整展示加载、错误、空学生、能力与锁定状态', () => {
  assert.match(page, /v-if="pdfLoading"/u);
  assert.match(page, /v-else-if="pdfError"/u);
  assert.match(page, /v-else-if="!pdfStudents\.length"/u);
  assert.match(page, /latest_first_round_ability/u);
  assert.match(page, /freeze_ability/u);
  assert.match(page, /最近完整首轮错/u);
  assert.match(page, /6 道普通题 \+ 6 道加强题/u);
  assert.match(page, /frozen_assignment_count/u);
  assert.match(page, /loadPdfStudents\(student\.student_id,\{silent:true\}\)/u);
  assert.match(page, /\.pdf-modal \{[^}]*max-width: 760px;[^}]*overflow-y: auto;/u);
});
