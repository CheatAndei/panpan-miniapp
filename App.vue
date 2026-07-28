<script>
import { BRAND, DEFAULT_TEACHER_NAME } from './utils/brand';
import { api } from './utils/api';

export default {
  onLaunch() {
    console.log(BRAND + '启动');
  },
  onShow() {
    this.checkMaintenanceStatus();
  },
  methods: {
    async checkMaintenanceStatus() {
      if (this._maintenanceChecking) return;
      this._maintenanceChecking = true;
      try {
        const status = await api.get('/system/status', null, { handleUnauthorized: false, timeout: 5000 });
        uni.setStorageSync('systemMaintenance', status);
        const user = uni.getStorageSync('user') || {};
        if (status.maintenance && user.role !== 'teacher') {
          uni.reLaunch({ url: '/pages/maintenance/index' });
        }
      } catch (error) {
        console.warn('维护状态读取失败，继续使用当前版本', error);
      } finally {
        this._maintenanceChecking = false;
      }
    },
  },
  globalData: {
    brand: {
      name: BRAND,
      teacher: DEFAULT_TEACHER_NAME,
      colors: {
        primary: '#527CC9',
        accent: '#65BFA8',
        text: '#24324A',
        bg: '#F6FAFF',
        success: '#4FA98F',
        warning: '#C48A20'
      }
    }
  }
};
</script>

<style>
page {
  --primary: #527CC9;
  --primary-strong: #315EA8;
  --primary-light: #7398D8;
  --primary-soft: #EAF2FF;
  --navy: #315EA8;
  --navy-2: #527CC9;
  --navy-deep: #243E70;
  --accent: #65BFA8;
  --accent-strong: #358E7D;
  --accent-soft: #E9F8F3;
  --gold: #F4C75B;
  --gold-soft: #FFF0B5;
  --coral: #E98577;
  --coral-soft: #FFF0ED;

  --text: #24324A;
  --ink: #24324A;
  --text-secondary: #5C6C84;
  --text-muted: #6E7D91;
  --muted: #6E7D91;
  --faint: #9AA8B8;

  --border: #DDE7F2;
  --hairline: #E9F0F8;
  --bg: #F6FAFF;
  --page-bg: var(--bg);
  --card: #FFFFFF;
  --surface: #FFFFFF;
  --surface-muted: #F9FBFF;
  --tint: #F9FBFF;

  --success: #4FA98F;
  --success-soft: #E9F8F3;
  --warning: #C48A20;
  --warning-soft: #FFF5D7;
  --danger: #D66D62;
  --danger-soft: #FFF0ED;
  --info: #527CC9;
  --info-soft: #EAF2FF;

  --r-xs: 10rpx;
  --r-sm: 14rpx;
  --r: 22rpx;
  --r-lg: 30rpx;
  --space-1: 8rpx;
  --space-2: 12rpx;
  --space-3: 16rpx;
  --space-4: 24rpx;
  --space-5: 32rpx;
  --space-6: 40rpx;
  --shadow-sm: 0 5rpx 16rpx rgba(49, 94, 168, .055);
  --shadow: 0 14rpx 38rpx rgba(49, 94, 168, .09);
  --shadow-lg: 0 26rpx 68rpx rgba(36, 62, 112, .16);
  --ease-out: cubic-bezier(.16, 1, .3, 1);
  --tap-scale: .975;
  --motion-fast: 120ms;
  --motion-base: 180ms;
  --motion-slow: 240ms;

  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'HarmonyOS Sans SC', 'Segoe UI', sans-serif;
  font-size: 28rpx;
  color: var(--ink);
  background: var(--bg);
  line-height: 1.6;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
}

button {
  margin: 0;
  box-sizing: border-box;
  touch-action: manipulation;
}

button::after { border: none; }

button[disabled],
.is-disabled {
  opacity: .46;
  pointer-events: none;
}

.btn-primary[disabled],
.btn-accent[disabled],
.btn-publish[disabled] {
  background: #CDD7E5 !important;
  color: #FFFFFF !important;
  box-shadow: none !important;
  opacity: .72;
}

.page,
.page-shell {
  min-height: 100vh;
  box-sizing: border-box;
  background:
    radial-gradient(circle at 92% 0%, rgba(244, 199, 91, .17), transparent 23%),
    radial-gradient(circle at 0% 18%, rgba(101, 191, 168, .12), transparent 24%),
    linear-gradient(180deg, #F7FBFF 0%, var(--page-bg) 36%, var(--page-bg) 100%);
}

.page-bottom-safe {
  padding-bottom: calc(48rpx + env(safe-area-inset-bottom));
}

.card {
  background: var(--card);
  border-radius: var(--r);
  padding: 30rpx;
  margin: 18rpx 24rpx;
  box-shadow: var(--shadow-sm);
  border: 1rpx solid rgba(221, 231, 242, .92);
  box-sizing: border-box;
}

.hero-navy,
.page-hero {
  position: relative;
  overflow: hidden;
  background:
    linear-gradient(rgba(82, 124, 201, .05) 1rpx, transparent 1rpx),
    linear-gradient(90deg, rgba(82, 124, 201, .05) 1rpx, transparent 1rpx),
    linear-gradient(150deg, #FFFFFF 0%, #EAF2FF 100%);
  background-size: 40rpx 40rpx, 40rpx 40rpx, auto;
  color: var(--ink);
  padding: 48rpx 34rpx 38rpx;
  border-bottom: 1rpx solid var(--hairline);
}

page .page > .hero,
page .page-shell > .hero,
uni-page-body .page > .hero,
uni-page-body .page-shell > .hero {
  position: relative;
  overflow: hidden;
  border-bottom: 1rpx solid #CADBF1;
  background:
    linear-gradient(rgba(82, 124, 201, .05) 1rpx, transparent 1rpx),
    linear-gradient(90deg, rgba(82, 124, 201, .05) 1rpx, transparent 1rpx),
    linear-gradient(145deg, #FFFFFF 0%, #EAF2FF 100%) !important;
  background-size: 40rpx 40rpx, 40rpx 40rpx, auto !important;
  color: var(--ink) !important;
}

page .page > .hero .eyebrow,
page .page-shell > .hero .eyebrow,
uni-page-body .page > .hero .eyebrow,
uni-page-body .page-shell > .hero .eyebrow {
  color: var(--primary-strong) !important;
}

page .page > .hero .hero-title,
page .page > .hero .hero-sub,
page .page-shell > .hero .hero-title,
page .page-shell > .hero .hero-sub,
uni-page-body .page > .hero .hero-title,
uni-page-body .page > .hero .hero-sub,
uni-page-body .page-shell > .hero .hero-title,
uni-page-body .page-shell > .hero .hero-sub {
  color: var(--ink) !important;
}

page .page > .hero .hero-sub,
page .page-shell > .hero .hero-sub,
uni-page-body .page > .hero .hero-sub,
uni-page-body .page-shell > .hero .hero-sub {
  color: var(--text-secondary) !important;
}

.hero-navy::after,
.page-hero::after {
  content: '';
  position: absolute;
  width: 210rpx;
  height: 210rpx;
  right: -82rpx;
  top: -100rpx;
  border-radius: 50%;
  background: rgba(244, 199, 91, .25);
  pointer-events: none;
}

.hero-navy .eyebrow,
.page-hero .eyebrow { color: var(--accent-strong); }

.gold-rule {
  width: 46rpx;
  height: 4rpx;
  background: var(--gold);
  border-radius: 4rpx;
}

.eyebrow {
  font-size: 21rpx;
  font-weight: 650;
  letter-spacing: 2rpx;
  color: var(--muted);
}

.section-title,
.s-title {
  color: var(--ink);
  font-weight: 700;
  letter-spacing: -.3rpx;
}

.num { font-variant-numeric: tabular-nums; }

.btn-primary,
.btn-accent,
.btn-publish {
  min-height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--primary-strong);
  color: #FFFFFF;
  border-radius: var(--r-sm);
  padding: 20rpx 28rpx;
  font-size: 29rpx;
  border: none;
  font-weight: 650;
  letter-spacing: .2rpx;
  box-shadow: 0 10rpx 24rpx rgba(49, 94, 168, .2);
  transition: transform var(--motion-fast) var(--ease-out), opacity var(--motion-fast) var(--ease-out), background-color var(--motion-fast) var(--ease-out);
}

.btn-accent,
.btn-publish { background: var(--primary); }

.btn-primary:active,
.btn-accent:active,
.btn-publish:active {
  transform: scale(var(--tap-scale));
  opacity: .92;
}

.btn-secondary,
.btn-outline {
  min-height: 84rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface);
  color: var(--primary-strong);
  border: 1rpx solid #BFD0EC;
  border-radius: var(--r-sm);
  padding: 18rpx 26rpx;
  font-size: 28rpx;
  font-weight: 650;
  transition: transform var(--motion-fast) var(--ease-out), opacity var(--motion-fast) var(--ease-out), background-color var(--motion-fast) var(--ease-out);
}

.btn-secondary:active,
.btn-outline:active {
  transform: scale(var(--tap-scale));
  background: var(--primary-soft);
  opacity: .9;
}

.btn-cancel,
.btn-ghost {
  min-height: 80rpx;
  background: transparent;
  color: var(--text-muted);
  border: none;
  border-radius: var(--r-sm);
  font-size: 27rpx;
}

.pressable,
.action-item,
.action-row,
.class-item,
.sc-line,
.fb-box {
  transition: transform var(--motion-fast) var(--ease-out), opacity var(--motion-fast) var(--ease-out), background-color var(--motion-fast) var(--ease-out);
}

.pressable:active,
.action-item:active,
.action-row:active,
.class-item:active,
.sc-line:active,
.fb-box:active {
  transform: scale(var(--tap-scale));
  opacity: .88;
}

.input,
.textarea,
.result-area {
  width: 100%;
  border: 1rpx solid #D6E2F1;
  border-radius: var(--r-sm);
  background: #FBFDFF;
  color: var(--ink);
  box-sizing: border-box;
  min-height: 88rpx;
  line-height: 88rpx;
  padding: 0 22rpx;
  font-size: 29rpx;
  transition: border-color var(--motion-base) var(--ease-out), background-color var(--motion-base) var(--ease-out), box-shadow var(--motion-base) var(--ease-out);
}

.textarea,
.result-area {
  line-height: 1.65;
  padding-top: 20rpx;
  padding-bottom: 20rpx;
}

.input:focus,
.textarea:focus,
.result-area:focus {
  border-color: var(--primary);
  background: #FFFFFF;
  box-shadow: 0 0 0 5rpx rgba(82, 124, 201, .12);
}

.tag {
  display: inline-flex;
  align-items: center;
  padding: 5rpx 14rpx;
  border-radius: var(--r-xs);
  font-size: 22rpx;
  font-weight: 550;
}

.tag-blue { background: var(--info-soft); color: var(--info); }
.tag-amber { background: var(--warning-soft); color: var(--warning); }
.tag-green { background: var(--success-soft); color: var(--success); }
.tag-red { background: var(--danger-soft); color: var(--danger); }

.i-dot {
  width: 10rpx;
  height: 10rpx;
  border-radius: 50%;
  display: inline-block;
  flex-shrink: 0;
}
.i-dot.green { background: var(--success); }
.i-dot.amber { background: var(--warning); }
.i-dot.gray { background: var(--faint); }
.i-dot.red { background: var(--danger); }
.i-dot.blue { background: var(--info); }

.i-check {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36rpx;
  height: 36rpx;
  border-radius: 50%;
  font-size: 20rpx;
  flex-shrink: 0;
}
.i-check.on { background: var(--success); color: #FFFFFF; }
.i-check.off { background: var(--surface-muted); color: var(--faint); }

.i-badge {
  display: inline-flex;
  align-items: center;
  padding: 6rpx 14rpx;
  border-radius: var(--r-xs);
  font-size: 22rpx;
  font-weight: 650;
}
.i-badge.in { background: var(--success-soft); color: var(--success); }
.i-badge.out { background: var(--surface-muted); color: var(--text-muted); }
.i-badge.warn { background: var(--warning-soft); color: var(--warning); }

.i-arrow {
  width: 15rpx;
  height: 15rpx;
  border-top: 2rpx solid var(--faint);
  border-right: 2rpx solid var(--faint);
  transform: rotate(45deg);
  display: inline-block;
  flex-shrink: 0;
}

.loading {
  text-align: center;
  color: var(--text-muted);
  padding: 64rpx 28rpx;
  font-size: 26rpx;
}

.loading::before {
  content: '';
  display: block;
  width: 44rpx;
  height: 44rpx;
  margin: 0 auto 18rpx;
  border: 4rpx solid rgba(82, 124, 201, .16);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: pp-spin .75s linear infinite;
}

.empty-sm,
.empty-state,
.hint,
.empty {
  text-align: center;
  color: var(--text-muted);
  padding: 38rpx 24rpx;
  font-size: 26rpx;
  line-height: 1.7;
}

.modal-mask {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: flex-end;
  background: rgba(36, 50, 74, .48);
  animation: pp-fade-in .18s ease-out both;
}

.pp-press {
  transition: transform var(--motion-fast) var(--ease-out), opacity var(--motion-fast) var(--ease-out);
}

.pp-press:active {
  transform: scale(var(--tap-scale));
  opacity: .9;
}

.pp-enter {
  animation: pp-enter var(--motion-slow) var(--ease-out) both;
}

.pp-success-pop {
  animation: pp-success-pop 220ms var(--ease-out) both;
}

.edu-rule {
  height: 1rpx;
  background: repeating-linear-gradient(90deg, var(--border) 0 16rpx, transparent 16rpx 24rpx);
}

.modal {
  width: 100%;
  max-height: 86vh;
  box-sizing: border-box;
  overflow: hidden;
  background: var(--surface);
  border-radius: 32rpx 32rpx 0 0;
  padding: 30rpx 30rpx calc(28rpx + env(safe-area-inset-bottom));
  box-shadow: var(--shadow-lg);
  animation: pp-sheet-in .24s var(--ease-out) both;
}

.modal-title {
  display: block;
  color: var(--ink);
  font-size: 33rpx;
  font-weight: 720;
  text-align: center;
  margin-bottom: 24rpx;
}

@keyframes pp-spin { to { transform: rotate(360deg); } }
@keyframes pp-fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes pp-sheet-in { from { transform: translateY(32rpx); opacity: .2; } to { transform: translateY(0); opacity: 1; } }
@keyframes pp-enter { from { transform: translateY(12rpx); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
@keyframes pp-success-pop { 0% { transform: scale(.88); opacity: 0; } 70% { transform: scale(1.04); } 100% { transform: scale(1); opacity: 1; } }

@media (prefers-reduced-motion: reduce) {
  .pressable,
  .action-item,
  .action-row,
  .class-item,
  .sc-line,
  .fb-box,
  .modal,
  .modal-mask,
  .loading::before,
  .pp-enter,
  .pp-success-pop {
    animation-duration: .01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .01ms !important;
  }
}
</style>
