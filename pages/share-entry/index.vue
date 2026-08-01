<template>
  <view class="share-entry">
    <BrandEntrance
      :brand="BRAND"
      :mode="entryMode"
      :phrase="entryPhrase"
      loading-text="正在打开分享内容"
    />
  </view>
</template>

<script setup>
import { onLoad } from '@dcloudio/uni-app';
import BrandEntrance from '@/components/home/BrandEntrance.vue';
import { getUser } from '@/utils/auth';
import { BRAND } from '@/utils/brand';
import { nextWelcomeCopy } from '@/utils/welcome-copy';
import { markWelcomePending, resolveShareTarget, setEntranceTarget } from '@/utils/welcome-entry';

const savedUser = uni.getStorageSync('token') ? getUser() || {} : {};
const entryMode = savedUser.role ? 'returning' : 'new';
const entryPhrase = savedUser.role === 'parent'
  ? nextWelcomeCopy()
  : savedUser.role ? '正在打开' : '初次见面';

onLoad((query) => {
  const target = resolveShareTarget(query);
  setEntranceTarget(target.url);
  markWelcomePending('share', { phrase: entryPhrase });
  setTimeout(() => uni.reLaunch({ url: '/pages/index/index?share_entry=1' }), 16);
});
</script>

<style scoped>
.share-entry { min-height: 100vh; background: #FFFFFF; }
</style>
