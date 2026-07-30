const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const workflow = fs.readFileSync(
  path.join(__dirname, '..', '..', '.github', 'workflows', 'prod-practice-requeue.yml'),
  'utf8',
);

test('生产历史修复工作流要求精确确认、独立备份、失败回滚和后置校验', () => {
  assert.match(workflow, /repair-inspect/);
  assert.match(workflow, /REPAIR_7_PRACTICE_HISTORIES/);
  assert.match(workflow, /actions\/checkout@v4/);
  assert.match(workflow, /practice-history-repair-\$REPAIR_ID/);
  assert.match(workflow, /cp -a "\$DATA_DIR\/teach\.db" "\$BACKUP_DIR\/teach\.db"/);
  assert.match(workflow, /trap rollback EXIT/);
  assert.match(workflow, /Practice history repair failed; restoring database backup/);
  assert.match(workflow, /--backup-sha256 "\$BACKUP_SHA256"/);
  assert.match(workflow, /--mode verify/);
  assert.match(workflow, /sqlite_integrity: 'ok'/);
  assert.ok(
    workflow.indexOf('cp -a "$DATA_DIR/teach.db" "$BACKUP_DIR/teach.db"')
      < workflow.indexOf('--mode apply'),
    '生产库必须先备份再执行事务修复',
  );
});
