const test = require('node:test');
const assert = require('node:assert/strict');
const { createFailureLimiter } = require('../utils/failure-limiter');

test('失败限速器有全局键上限且不会驱逐仍在窗口内的用户', () => {
  let time = 1000;
  const limiter = createFailureLimiter({ limit: 5, windowMs: 60000, maxKeys: 3, now: () => time });
  limiter.fail('user-a');
  limiter.fail('user-b');
  limiter.fail('user-c');
  const overflow = limiter.check('user-d');
  assert.equal(overflow.limited, true);
  assert.equal(overflow.saturated, true);
  assert.equal(limiter.size(), 3);
  assert.equal(limiter.check('user-a').limited, false);

  time += 60001;
  assert.equal(limiter.check('user-d').limited, false);
  limiter.fail('user-d');
  assert.equal(limiter.size(), 1);
});
