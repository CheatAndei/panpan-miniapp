const PHOTO_ALBUM_SCOPE = 'scope.writePhotosAlbum';

function callUni(method, options = {}) {
  return new Promise((resolve, reject) => {
    const api = typeof uni !== 'undefined' ? uni[method] : null;
    if (typeof api !== 'function') {
      reject(new Error('请在微信小程序中保存图片'));
      return;
    }
    api({ ...options, success: resolve, fail: reject });
  });
}

export async function ensurePhotoAlbumPermission() {
  if (typeof uni === 'undefined') throw new Error('请在微信小程序中保存图片');
  if (typeof uni.getSetting === 'function') {
    const result = await callUni('getSetting');
    if (result?.authSetting?.[PHOTO_ALBUM_SCOPE] === true) return;
  }
  if (typeof uni.authorize === 'function') {
    await callUni('authorize', { scope: PHOTO_ALBUM_SCOPE });
  }
}

export async function saveImageToAlbum(filePath) {
  if (!String(filePath || '').trim()) throw new Error('图片尚未生成，请重试');
  await ensurePhotoAlbumPermission();
  return callUni('saveImageToPhotosAlbum', { filePath });
}

export function isAlbumPermissionError(error) {
  return /auth deny|authorize|permission|privacy|scope\.writePhotosAlbum|用户拒绝|权限/i.test(
    String(error?.errMsg || error?.message || error || ''),
  );
}
