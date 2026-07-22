const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root=path.join(__dirname,'..');
const reader=fs.readFileSync(path.join(root,'components','pp-question-reader','pp-question-reader.vue'),'utf8');
const choice=fs.readFileSync(path.join(root,'pages','choice-king','index.vue'),'utf8');
const challenge=fs.readFileSync(path.join(root,'pages','weekly-challenge','index.vue'),'utf8');

test('题图阅读器支持适应、放大、横滑、原生预览与记忆模式',()=>{
  assert.match(reader,/适应屏幕/);
  assert.match(reader,/放大阅读/);
  assert.match(reader,/<scroll-view[^>]+scroll-x/);
  assert.match(reader,/width:165%/);
  assert.match(reader,/uni\.previewImage/);
  assert.match(reader,/uni\.setStorageSync\(props\.storageKey,next\)/);
  assert.match(reader,/题图暂时无法显示/);
});

test('选择刷题王和压轴挑战复用公共题图阅读器',()=>{
  assert.match(choice,/<pp-question-reader/);
  assert.match(challenge,/<pp-question-reader/);
});
