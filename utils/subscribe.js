export function requestSubscribeBatch(tmplIds) {
  return new Promise((resolve, reject) => {
    uni.requestSubscribeMessage({ tmplIds, success: resolve, fail: reject });
  });
}

export async function requestSubscribeBatches(templateIds) {
  const ids = [...new Set((templateIds || []).filter(Boolean))];
  const raw = {};
  let accepted = 0;
  for (let index = 0; index < ids.length; index += 3) {
    const batch = ids.slice(index, index + 3);
    const result = await requestSubscribeBatch(batch);
    Object.assign(raw, result);
    accepted += batch.filter((id) => result[id] === 'accept').length;
  }
  return { accepted, total: ids.length, raw };
}

export function subscribeResultTitle(result) {
  if (!result?.total || !result.accepted) return '未开启提醒';
  return result.accepted === result.total
    ? `已开启 ${result.total} 类提醒`
    : `已开启 ${result.accepted}/${result.total} 类`;
}
