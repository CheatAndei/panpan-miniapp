const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const workflow = fs.readFileSync(
  path.join(__dirname, '..', '.github', 'workflows', 'prod-exam-library-sync.yml'),
  'utf8'
);
const reimportWorkflow = fs.readFileSync(
  path.join(__dirname, '..', '.github', 'workflows', 'prod-exam-library-reimport.yml'),
  'utf8'
);

test('生产试卷同步暂停在线服务并在同一数据卷内导入，避免 sql.js 内存库覆盖', () => {
  assert.match(workflow, /docker compose stop panpan-api/);
  assert.match(workflow, /DATABASE_PATH=\/app\/data\/teach\.db/);
  assert.match(workflow, /-v "\$DATA_DIR:\/app\/data"/);
  assert.match(workflow, /docker compose up -d --no-build --pull never panpan-api/);
  assert.doesNotMatch(workflow, /docker exec panpan-api npm run exams:mock:import/);
});

test('生产试卷可复用服务器现有资源安全重建索引并校验 194/193', () => {
  assert.match(reimportWorkflow, /Type REIMPORT_EXAMS/);
  assert.match(reimportWorkflow, /docker compose stop panpan-api/);
  assert.match(reimportWorkflow, /DATABASE_PATH=\/app\/data\/teach\.db/);
  assert.match(reimportWorkflow, /-v "\$DATA_DIR:\/app\/data"/);
  assert.match(reimportWorkflow, /counts\.papers !== 194 \|\| counts\.answers !== 193/);
  assert.doesNotMatch(reimportWorkflow, /docker exec panpan-api npm run exams:mock:import/);
});

test('生产试卷同步支持经质检的七年级 PDF manifest，并逐卷核对答案资源', () => {
  assert.match(workflow, /import-manifest\.json/);
  assert.match(workflow, /--manifest \/app\/exam-library\/import-manifest\.json/);
  assert.match(workflow, /missingAnswers/);
  assert.match(workflow, /manifest\.expected\.papers/);
  assert.match(workflow, /manifest\.expected\.answers/);
});
