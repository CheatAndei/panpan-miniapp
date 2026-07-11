import { createSSRApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { BRAND } from './utils/brand';

export function createApp() {
  const app = createSSRApp(App);
  app.use(createPinia());
  // 注入品牌配置
  app.provide('brand', {
    name: BRAND,
    colors: { primary: '#183A36', accent: '#2F7D6B' }
  });
  return { app };
}
