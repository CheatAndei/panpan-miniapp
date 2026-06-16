<script>
export default {
  onLaunch() { console.log('潘潘老师助手启动'); },
  globalData: {
    brand: {
      name: '潘潘老师',
      colors: { primary: '#1A365D', accent: '#D69E2E', text: '#4A5568', bg: '#F7F8FA', success: '#38A169', warning: '#DD6B20' }
    }
  }
};
</script>

<style>
page {
  --primary: #1A365D;
  --primary-light: #2A4A7F;
  --accent: #D69E2E;
  --text: #2D3748;
  --text-muted: #718096;
  --border: #E2E8F0;
  --bg: #F5F6F8;
  --card: #FFFFFF;
  --success: #38A169;
  --warning: #DD6B20;
  --danger: #E53E3E;

  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', sans-serif;
  font-size: 28rpx;
  color: var(--text);
  background: var(--bg);
  line-height: 1.5;
}

.card {
  background: var(--card);
  border-radius: 12rpx;
  padding: 28rpx;
  margin: 16rpx 20rpx;
  box-shadow: 0 1rpx 3rpx rgba(0,0,0,.04);
}

.btn-primary {
  background: var(--primary);
  color: #fff;
  border-radius: 10rpx;
  padding: 22rpx;
  font-size: 30rpx;
  border: none;
  font-weight: 600;
}
.btn-primary:active { opacity: .85; }

.btn-accent {
  background: var(--accent);
  color: #fff;
  border-radius: 10rpx;
  padding: 22rpx;
  font-size: 30rpx;
  border: none;
  font-weight: 600;
}

.tag {
  display: inline-flex;
  align-items: center;
  padding: 4rpx 14rpx;
  border-radius: 6rpx;
  font-size: 22rpx;
  font-weight: 500;
}
.tag-blue { background: #EBF0F7; color: #1A365D; }
.tag-amber { background: #FEF5E7; color: #B7791F; }
.tag-green { background: #F0FFF4; color: #276749; }
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

.i-badge { display: inline-flex; align-items: center; padding: 6rpx 14rpx; border-radius: 4rpx; font-size: 22rpx; font-weight: 600; letter-spacing: .02em; }
.i-badge.in { background: #F0FFF4; color: #276749; }
.i-badge.out { background: #EDF2F7; color: #718096; }
.i-badge.warn { background: #FFFFF0; color: #975A16; }

.i-arrow { width: 16rpx; height: 16rpx; border-top: 2rpx solid #CBD5E0; border-right: 2rpx solid #CBD5E0; transform: rotate(45deg); display: inline-block; flex-shrink: 0; }

.i-symbol { font-size: 28rpx; font-weight: 700; color: #4A5568; }
</style>
