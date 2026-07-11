// 统一的轻量 UI 反馈，避免各页面散落 uni.showToast 和静默吞错误。
export function toast(title, icon = 'none') {
  uni.showToast({ title: String(title || '').slice(0, 32), icon });
}

export function toastSuccess(title) {
  uni.showToast({ title: String(title || '').slice(0, 32), icon: 'success' });
}

// 操作类失败：记录日志并提示用户。优先用后端返回的 error 文案。
export function toastError(err, fallback = '操作失败') {
  console.error(fallback, err);
  const msg = (err && (err.error || err.message)) || fallback;
  uni.showToast({ title: String(msg).slice(0, 32), icon: 'none' });
}

// 加载类失败：记录日志，不打扰用户（页面自行决定是否展示错误态）。
export function logError(scene, err) {
  console.error('[' + scene + ']', err);
}

export function confirmAction({ title = '请确认', content, confirmText = '确认', danger = false }) {
  return new Promise((resolve) => {
    uni.showModal({
      title,
      content,
      confirmText,
      confirmColor: danger ? '#C75D54' : '#2F7D6B',
      success: (result) => resolve(Boolean(result.confirm)),
      fail: () => resolve(false)
    });
  });
}
