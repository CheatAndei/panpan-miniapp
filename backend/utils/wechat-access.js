let accessToken = null;
let tokenExpire = 0;

async function getAccessToken() {
  if (accessToken && Date.now() < tokenExpire) return accessToken;
  const appId = String(process.env.APP_ID || '').trim();
  const secret = String(process.env.APP_SECRET || '').trim();
  if (!appId || !secret) return null;
  const axios = require('axios');
  const { data } = await axios.get('https://api.weixin.qq.com/cgi-bin/token', {
    params:{ grant_type:'client_credential', appid:appId, secret }, timeout:8000,
  });
  if (!data?.access_token) {
    console.warn('[wechat] get access token failed', { errcode:data?.errcode, errmsg:data?.errmsg });
    return null;
  }
  accessToken = data.access_token;
  tokenExpire = Date.now() + Math.max(60, Number(data.expires_in || 7200) - 300) * 1000;
  return accessToken;
}

function resetAccessTokenForTest() {
  accessToken = null;
  tokenExpire = 0;
}

module.exports = { getAccessToken, resetAccessTokenForTest };
