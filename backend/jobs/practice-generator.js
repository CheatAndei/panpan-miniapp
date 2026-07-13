const cron = require('node-cron');
const { getDB } = require('../db/init');
const { practiceDateAt, preGenerateDate } = require('../services/practice');

let task;

function start() {
  if (task) return task;
  task = cron.schedule('0 1 * * *', () => {
    try {
      const result = preGenerateDate(getDB(), practiceDateAt());
      console.log('Daily practice pre-generation complete', result);
    } catch (error) {
      console.error('Daily practice pre-generation failed', error.message);
    }
  }, { timezone: 'Asia/Shanghai' });
  return task;
}

module.exports = { start };
