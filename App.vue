<script>
import { BRAND, TEACHER } from './utils/brand';
export default {
  onLaunch() { console.log(BRAND + '启动'); },
  globalData: {
    brand: {
      name: BRAND,
      teacher: TEACHER,
      colors: { primary: '#202733', accent: '#A57945', text: '#46515C', bg: '#F4F5F2', success: '#3F8B65', warning: '#A66A3E' }
    }
  }
};
</script>

<style>
page {
  /* 品牌色 */
  --primary: #202733;
  --primary-light: #39434C;
  --navy: #202733;
  --navy-2: #2D3740;
  --navy-deep: #182126;
  --accent: #A57945;
  --gold: #A57945;
  --gold-soft: #D2B98E;
  /* 文字 */
  --text: #202733;
  --ink: #202733;
  --text-muted: #69717D;
  --muted: #69717D;
  --faint: #9CA2A8;
  /* 描边/分隔 */
  --border: #E5E0D8;
  --hairline: #E5E0D8;
  /* 表面 */
  --bg: #F4F5F2;
  --card: #FFFFFF;
  --tint: #F8F6F1;
  /* 语义 */
  --success: #3F8B65;
  --warning: #A66A3E;
  --danger: #B85C4E;
  /* 圆角 */
  --r-sm: 12rpx;
  --r: 18rpx;
  --r-lg: 24rpx;
  /* 投影（深蓝染、柔和分层） */
  --shadow-sm: 0 2rpx 8rpx rgba(36,42,50,.035);
  --shadow: 0 6rpx 18rpx rgba(36,42,50,.045);
  --shadow-lg: 0 14rpx 34rpx rgba(36,42,50,.075);

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

/* 纸面签名头部 */
.hero-navy {
  background: #FBFAF7;
  color: var(--ink);
  padding: 52rpx 32rpx 40rpx;
  border-bottom: 1rpx solid var(--hairline);
}
.hero-navy .eyebrow { color: #8D6A3F; }

/* 金色细线（签名元素） */
.gold-rule { width: 48rpx; height: 4rpx; background: var(--gold); border-radius: 2rpx; }

/* 区块小标签 */
.eyebrow { font-size: 22rpx; font-weight: 600; letter-spacing: 2rpx; color: var(--muted); }

/* 等宽数字 */
.num { font-variant-numeric: tabular-nums; }

/* 按钮 */
.btn-primary {
  background: var(--primary);
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
  background: var(--accent);
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
.tag-blue { background: #F3F1EA; color: #202733; }
.tag-amber { background: #F7F1E7; color: #8D6A3F; }
.tag-green { background: #ECFAF3; color: #1F7A52; }
.tag-red { background: #F7EDEA; color: #9F4E43; }

/* CSS 图标替代 emoji */
.i-dot { width: 10rpx; height: 10rpx; border-radius: 50%; display: inline-block; flex-shrink: 0; }
.i-dot.green { background: var(--success); }
.i-dot.amber { background: var(--accent); }
.i-dot.gray { background: #C3C1BA; }
.i-dot.red { background: var(--danger); }
.i-dot.blue { background: var(--primary); }

.i-check { display: inline-flex; align-items: center; justify-content: center; width: 36rpx; height: 36rpx; border-radius: 50%; font-size: 20rpx; flex-shrink: 0; }
.i-check.on { background: var(--success); color: #fff; }
.i-check.off { background: #EFEDE7; color: #8A929B; }

.i-badge { display: inline-flex; align-items: center; padding: 6rpx 14rpx; border-radius: 6rpx; font-size: 22rpx; font-weight: 600; letter-spacing: .04em; }
.i-badge.in { background: #ECFAF3; color: #1F7A52; }
.i-badge.out { background: #EFEDE7; color: #69717D; }
.i-badge.warn { background: #F7F1E7; color: #7B5B36; }

.i-arrow { width: 16rpx; height: 16rpx; border-top: 2rpx solid #C3C1BA; border-right: 2rpx solid #C3C1BA; transform: rotate(45deg); display: inline-block; flex-shrink: 0; }

.i-symbol { font-size: 28rpx; font-weight: 700; color: #46515C; }

/* 统一加载态 */
.loading { text-align: center; color: var(--faint); padding: 48rpx; font-size: 26rpx; }
</style>
