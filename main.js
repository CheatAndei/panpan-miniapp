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
    colors: {
      primary: '#0B789A',
      sky: '#99DEF4',
      accent: '#F79BC0',
      yellow: '#FFF48A',
      ink: '#050505',
    }
  });
  return { app };
}
