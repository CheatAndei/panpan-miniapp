const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const practice = require('../services/practice');
const schema = fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');

test('自适应 v2 暴露能力快照、未领取重建与剩余日期冻结服务', () => {
  assert.equal(typeof practice.resolvePracticeAbilitySnapshot, 'function');
  assert.equal(typeof practice.rebuildAdaptiveAssignment, 'function');
  assert.equal(typeof practice.freezeStudentPracticeAssignments, 'function');
});

test('题单保存永久冻结审计字段', () => {
  for (const field of ['is_frozen', 'frozen_at', 'freeze_source', 'frozen_by']) {
    assert.match(schema, new RegExp(`\\b${field}\\b`));
  }
});
