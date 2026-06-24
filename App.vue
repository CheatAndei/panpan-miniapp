<script>
import { BRAND, TEACHER } from './utils/brand';
export default {
  onLaunch() { console.log(BRAND + '启动'); },
  globalData: {
    brand: {
      name: BRAND,
      teacher: TEACHER,
      colors: { primary: '#1A365D', accent: '#D69E2E', text: '#4A5568', bg: '#F7F8FA', success: '#38A169', warning: '#DD6B20' }
    }
  }
};
</script>

<style>
page {
  /* 品牌色 */
  --primary: #1A365D;
  --primary-light: #2A4A7F;
  --navy: #1A365D;
  --navy-2: #244271;
  --navy-deep: #10243F;
  --accent: #D69E2E;
  --gold: #D69E2E;
  --gold-soft: #E6BE6A;
  /* 文字（深蓝化更显高级） */
  --text: #1B2A45;
  --ink: #1B2A45;
  --text-muted: #64748B;
  --muted: #64748B;
  --faint: #94A3B8;
  /* 描边/分隔（发丝级、深蓝染） */
  --border: rgba(26,54,93,.10);
  --hairline: rgba(26,54,93,.10);
  /* 表面 */
  --bg: #F1F4F9;
  --card: #FFFFFF;
  --tint: #F6F8FC;
  /* 语义 */
  --success: #2F9E6E;
  --warning: #DD6B20;
  --danger: #E53E3E;
  /* 圆角 */
  --r-sm: 12rpx;
  --r: 18rpx;
  --r-lg: 24rpx;
  /* 投影（深蓝染、柔和分层） */
  --shadow-sm: 0 2rpx 8rpx rgba(26,54,93,.05);
  --shadow: 0 8rpx 24rpx rgba(26,54,93,.07);
  --shadow-lg: 0 16rpx 40rpx rgba(26,54,93,.10);

  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', sans-serif;
  font-size: 28rpx;
  color: var(--ink);
  background: var(--bg);
  line-height: 1.6;
}

/* 卡片：大圆角 + 柔和深蓝投影 + 发丝边 */
.card {
  background: var(--card);
  border-radius: var(--r);
  padding: 32rpx;
  margin: 18rpx 24rpx;
  box-shadow: var(--shadow);
  border: 1rpx solid var(--hairline);
}

/* 深蓝渐变签名头部 */
.hero-navy {
  background: linear-gradient(150deg, #244271 0%, #1A365D 55%, #10243F 100%);
  color: #fff;
  padding: 52rpx 32rpx 40rpx;
}
.hero-navy .eyebrow { color: var(--gold-soft); }

/* 金色细线（签名元素） */
.gold-rule { width: 48rpx; height: 4rpx; background: var(--gold); border-radius: 2rpx; }

/* 区块小标签 */
.eyebrow { font-size: 22rpx; font-weight: 600; letter-spacing: 2rpx; color: var(--muted); }

/* 等宽数字 */
.num { font-variant-numeric: tabular-nums; }

/* 按钮 */
.btn-primary {
  background: linear-gradient(180deg, #244271, #1A365D);
  color: #fff;
  border-radius: 14rpx;
  padding: 26rpx;
  font-size: 30rpx;
  border: none;
  font-weight: 600;
  letter-spacing: 1rpx;
  transition: transform .15s, opacity .15s;
}
.btn-primary:active { transform: scale(.985); opacity: .94; }

.btn-accent {
  background: linear-gradient(180deg, #E0AC44, #D69E2E);
  color: #fff;
  border-radius: 14rpx;
  padding: 26rpx;
  font-size: 30rpx;
  border: none;
  font-weight: 600;
  letter-spacing: 1rpx;
  transition: transform .15s, opacity .15s;
}
.btn-accent:active { transform: scale(.985); opacity: .94; }

.tag {
  display: inline-flex;
  align-items: center;
  padding: 4rpx 14rpx;
  border-radius: 8rpx;
  font-size: 22rpx;
  font-weight: 500;
  letter-spacing: .5rpx;
}
.tag-blue { background: #EBF0F7; color: #1A365D; }
.tag-amber { background: #FEF5E7; color: #B7791F; }
.tag-green { background: #ECFAF3; color: #1F7A52; }
.tag-red { background: #FFF5F5; color: #C53030; }

/* CSS 图标替代 emoji */
.i-dot { width: 10rpx; height: 10rpx; border-radius: 50%; display: inline-block; flex-shrink: 0; }
.i-dot.green { background: var(--success); }
.i-dot.amber { background: var(--accent); }
.i-dot.gray { background: #CBD5E0; }
.i-dot.red { background: var(--danger); }
.i-dot.blue { background: var(--primary); }

.i-check { display: inline-flex; align-items: center; justify-content: center; width: 36rpx; height: 36rpx; border-radius: 50%; font-size: 20rpx; flex-shrink: 0; }
.i-check.on { background: var(--success); color: #fff; }
.i-check.off { background: #EDF2F7; color: #A0AEC0; }

.i-badge { display: inline-flex; align-items: center; padding: 6rpx 14rpx; border-radius: 6rpx; font-size: 22rpx; font-weight: 600; letter-spacing: .04em; }
.i-badge.in { background: #ECFAF3; color: #1F7A52; }
.i-badge.out { background: #EDF2F7; color: #64748B; }
.i-badge.warn { background: #FEF5E7; color: #975A16; }

.i-arrow { width: 16rpx; height: 16rpx; border-top: 2rpx solid #CBD5E0; border-right: 2rpx solid #CBD5E0; transform: rotate(45deg); display: inline-block; flex-shrink: 0; }

.i-symbol { font-size: 28rpx; font-weight: 700; color: #4A5568; }

/* 统一加载态 */
.loading { text-align: center; color: var(--faint); padding: 48rpx; font-size: 26rpx; }
</style>
