<script>
import { BRAND, DEFAULT_TEACHER_NAME } from './utils/brand';

export default {
  onLaunch() { console.log(BRAND + '启动'); },
  globalData: {
    brand: {
      name: BRAND,
      teacher: DEFAULT_TEACHER_NAME,
      colors: {
        primary: '#183A36',
        accent: '#2F7D6B',
        text: '#1B2926',
        bg: '#F3F7F5',
        success: '#2F7D6B',
        warning: '#B66A3C'
      }
    }
  }
};
</script>

<style>
page {
  --primary: #183A36;
  --primary-light: #315550;
  --primary-soft: #E5F0EC;
  --navy: #183A36;
  --navy-2: #244A45;
  --navy-deep: #102E2A;
  --accent: #2F7D6B;
  --accent-strong: #246B5B;
  --accent-soft: #E4F3EE;
  --gold: #2F7D6B;
  --gold-soft: #95C7B9;

  --text: #1B2926;
  --ink: #1B2926;
  --text-secondary: #536762;
  --text-muted: #697B76;
  --muted: #697B76;
  --faint: #9AA9A5;

  --border: #DDE8E4;
  --hairline: #E5EEEB;
  --bg: #F3F7F5;
  --card: #FFFFFF;
  --surface: #FFFFFF;
  --surface-muted: #F7FAF8;
  --tint: #F7FAF8;

  --success: #2F7D6B;
  --success-soft: #E4F3EE;
  --warning: #B66A3C;
  --warning-soft: #FBF1E9;
  --danger: #C75D54;
  --danger-soft: #FCEEEB;
  --info: #52756F;
  --info-soft: #EDF4F2;

  --r-xs: 10rpx;
  --r-sm: 14rpx;
  --r: 22rpx;
  --r-lg: 30rpx;
  --shadow-sm: 0 4rpx 12rpx rgba(24, 58, 54, .045);
  --shadow: 0 12rpx 34rpx rgba(24, 58, 54, .075);
  --shadow-lg: 0 24rpx 64rpx rgba(24, 58, 54, .13);
  --ease-out: cubic-bezier(.16, 1, .3, 1);
  --tap-scale: .975;

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
  background: #CAD7D2 !important;
  color: #FFFFFF !important;
  box-shadow: none !important;
  opacity: .72;
}

.page,
.page-shell {
  min-height: 100vh;
  box-sizing: border-box;
  background:
    radial-gradient(circle at 88% 2%, rgba(47, 125, 107, .07), transparent 30%),
    var(--bg);
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
  border: 1rpx solid rgba(221, 232, 228, .86);
  box-sizing: border-box;
}

.hero-navy,
.page-hero {
  position: relative;
  overflow: hidden;
  background: linear-gradient(150deg, #F9FCFB 0%, #EEF6F3 100%);
  color: var(--ink);
  padding: 48rpx 34rpx 38rpx;
  border-bottom: 1rpx solid var(--hairline);
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
  background: rgba(47, 125, 107, .075);
  pointer-events: none;
}

.hero-navy .eyebrow,
.page-hero .eyebrow { color: var(--accent-strong); }

.gold-rule {
  width: 46rpx;
  height: 4rpx;
  background: var(--accent);
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
  background: var(--primary);
  color: #FFFFFF;
  border-radius: var(--r-sm);
  padding: 20rpx 28rpx;
  font-size: 29rpx;
  border: none;
  font-weight: 650;
  letter-spacing: .2rpx;
  box-shadow: 0 10rpx 22rpx rgba(24, 58, 54, .13);
  transition: transform .16s var(--ease-out), opacity .16s var(--ease-out), background-color .16s var(--ease-out);
}

.btn-accent,
.btn-publish { background: var(--accent-strong); }

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
  color: var(--primary);
  border: 1rpx solid #BFD2CC;
  border-radius: var(--r-sm);
  padding: 18rpx 26rpx;
  font-size: 28rpx;
  font-weight: 650;
  transition: transform .16s var(--ease-out), opacity .16s var(--ease-out), background-color .16s var(--ease-out);
}

.btn-secondary:active,
.btn-outline:active {
  transform: scale(var(--tap-scale));
  background: var(--accent-soft);
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
  transition: transform .16s var(--ease-out), opacity .16s var(--ease-out), background-color .16s var(--ease-out);
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
  border: 1rpx solid #D5E3DE;
  border-radius: var(--r-sm);
  background: #FAFCFB;
  color: var(--ink);
  box-sizing: border-box;
  min-height: 88rpx;
  line-height: 88rpx;
  padding: 0 22rpx;
  font-size: 29rpx;
  transition: border-color .18s var(--ease-out), background-color .18s var(--ease-out), box-shadow .18s var(--ease-out);
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
  border-color: var(--accent);
  background: #FFFFFF;
  box-shadow: 0 0 0 5rpx rgba(47, 125, 107, .09);
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
  border: 4rpx solid rgba(47, 125, 107, .16);
  border-top-color: var(--accent);
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
  background: rgba(12, 28, 25, .52);
  animation: pp-fade-in .18s ease-out both;
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

@media (prefers-reduced-motion: reduce) {
  .pressable,
  .action-item,
  .action-row,
  .class-item,
  .sc-line,
  .fb-box,
  .modal,
  .modal-mask,
  .loading::before {
    animation-duration: .01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .01ms !important;
  }
}
</style>
