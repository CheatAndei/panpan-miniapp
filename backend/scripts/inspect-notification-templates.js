require('dotenv').config();
const axios = require('axios');

const templates = {
  checkin: process.env.TPL_CHECKIN || '',
  checkout: process.env.TPL_CHECKOUT || '',
  reminder: process.env.TPL_REMINDER || '',
  feedback: process.env.TPL_FEEDBACK || '',
  homework: process.env.TPL_HOMEWORK || '',
};

const configuredFields = {
  checkin: [process.env.TPL_FIELD_CHECKIN_STUDENT || 'thing1', process.env.TPL_FIELD_CHECKIN_TIME || 'time2', process.env.TPL_FIELD_CHECKIN_STATUS || 'phrase3'],
  checkout: [process.env.TPL_FIELD_CHECKOUT_STUDENT || 'thing1', process.env.TPL_FIELD_CHECKOUT_TIME || 'time2', process.env.TPL_FIELD_CHECKOUT_STATUS || 'phrase3', process.env.TPL_FIELD_CHECKOUT_NOTE || 'thing3'],
  reminder: [process.env.TPL_FIELD_REMINDER_CLASS || 'thing1', process.env.TPL_FIELD_REMINDER_TIME || 'time2', process.env.TPL_FIELD_REMINDER_NOTE || 'thing3'],
  feedback: [process.env.TPL_FIELD_FEEDBACK_TITLE || 'thing1', process.env.TPL_FIELD_FEEDBACK_TIME || 'time2', process.env.TPL_FIELD_FEEDBACK_NOTE || 'thing3'],
  homework: [process.env.TPL_FIELD_HOMEWORK_TITLE || 'thing1', process.env.TPL_FIELD_HOMEWORK_TIME || 'time2', process.env.TPL_FIELD_HOMEWORK_NOTE || 'thing3'],
};

function fields(content) {
  return [...String(content || '').matchAll(/\{\{([a-z]+\d+)\.DATA\}\}/g)].map((match) => match[1]);
}

async function main() {
  if (!process.env.APP_ID || !process.env.APP_SECRET) throw new Error('APP_ID / APP_SECRET 未配置');
  const tokenResponse = await axios.get('https://api.weixin.qq.com/cgi-bin/token', {
    params: { grant_type: 'client_credential', appid: process.env.APP_ID, secret: process.env.APP_SECRET },
  });
  if (!tokenResponse.data?.access_token) {
    throw new Error(`微信访问令牌获取失败：${tokenResponse.data?.errcode || ''} ${tokenResponse.data?.errmsg || ''}`);
  }
  const response = await axios.get('https://api.weixin.qq.com/wxaapi/newtmpl/gettemplate', {
    params: { access_token: tokenResponse.data.access_token },
  });
  if (response.data?.errcode) throw new Error(`微信模板读取失败：${response.data.errcode} ${response.data.errmsg}`);
  const remote = Array.isArray(response.data?.data) ? response.data.data : [];
  const report = Object.entries(templates).map(([name, id]) => {
    const item = remote.find((row) => row.priTmplId === id);
    const actual = fields(item?.content);
    return {
      name,
      configured: !!id,
      template_suffix: id ? id.slice(-8) : '',
      found: !!item,
      title: item?.title || '',
      content: item?.content || '',
      configured_fields: configuredFields[name],
      actual_fields: actual,
      fields_match: !!item && configuredFields[name].every((field) => actual.includes(field)),
    };
  });
  console.log(JSON.stringify({ ok: report.every((item) => !item.configured || (item.found && item.fields_match)), templates: report }, null, 2));
  if (report.some((item) => item.configured && (!item.found || !item.fields_match))) process.exitCode = 2;
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error.message }));
  process.exitCode = 1;
});
