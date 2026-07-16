const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'docs', 'manuals', 'assets', 'parent');
const teacherOutDir = path.join(root, 'docs', 'manuals', 'assets', 'teacher');
const W = 416;
const H = 781;

const C = {
  bg: '#f2f7f5',
  card: '#ffffff',
  navy: '#173f39',
  green: '#2f7d6b',
  soft: '#e5f3ef',
  ink: '#17332f',
  muted: '#73827e',
  line: '#dce8e4',
  red: '#e53935',
  peach: '#fff0ec',
};

const esc = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;');

function text(x, y, value, size = 16, weight = 400, fill = C.ink, anchor = 'start') {
  return `<text x="${x}" y="${y}" font-family="Microsoft YaHei, PingFang SC, sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${esc(value)}</text>`;
}

function rect(x, y, w, h, r = 16, fill = C.card, stroke = C.line) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}"/>`;
}

function pill(x, y, w, value, fill = C.soft, color = C.green) {
  return `${rect(x, y, w, 28, 14, fill, fill)}${text(x + w / 2, y + 19, value, 12, 700, color, 'middle')}`;
}

function topbar(title) {
  return `${rect(0, 0, W, 48, 0, '#fff', '#fff')}${text(20, 31, '‹', 30, 400)}${text(W / 2, 30, title, 15, 650, C.ink, 'middle')}${text(372, 30, '•••', 14, 700, C.ink, 'middle')}`;
}

function demoLabel() {
  return `${rect(242, 749, 164, 24, 12, '#ffffffdd', '#d8e5e1')}${text(324, 766, '新版界面示意｜演示数据', 10, 600, C.muted, 'middle')}`;
}

function callout(n, x, y, w, h, bx, by) {
  const tx = bx < x ? x : x + w;
  const ty = Math.max(y + 8, Math.min(y + h - 8, by));
  return `<g>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="none" stroke="${C.red}" stroke-width="4"/>
    <line x1="${bx}" y1="${by}" x2="${tx}" y2="${ty}" stroke="${C.red}" stroke-width="4" stroke-linecap="round" marker-end="url(#arrow)"/>
    <circle cx="${bx}" cy="${by}" r="15" fill="${C.red}" stroke="#fff" stroke-width="2"/>
    ${text(bx, by + 6, n, 18, 700, '#fff', 'middle')}
  </g>`;
}

function base(content) {
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="4" stdDeviation="7" flood-color="#173f39" flood-opacity="0.08"/></filter>
      <marker id="arrow" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L9,4.5 L0,9 z" fill="${C.red}"/></marker>
    </defs>
    <rect width="${W}" height="${H}" fill="${C.bg}"/>
    ${content}
    ${demoLabel()}
  </svg>`;
}

function bindInput() {
  return base(`${topbar('绑定孩子')}
    <circle cx="208" cy="125" r="34" fill="${C.navy}"/>${text(208, 134, '书', 28, 700, '#fff', 'middle')}
    ${text(208, 189, '绑定孩子', 30, 760, C.ink, 'middle')}
    ${text(208, 220, '请输入老师提供的学生邀请码', 15, 400, C.muted, 'middle')}
    <g filter="url(#shadow)">${rect(24, 258, 368, 238, 22)}
      ${text(48, 292, '学生邀请码', 14, 650)}
      ${rect(48, 312, 320, 64, 14, '#fafcfb', '#bfd6cf')}
      ${text(208, 354, 'GYRYK7', 26, 760, C.ink, 'middle')}
      ${text(208, 399, '邀请码由老师在学生资料中复制', 12, 400, C.muted, 'middle')}
      ${rect(48, 427, 320, 52, 14, C.navy, C.navy)}${text(208, 460, '确认绑定', 17, 700, '#fff', 'middle')}
    </g>
    ${text(208, 534, '注意：PANAAA 是教师激活码', 13, 650, C.red, 'middle')}
    ${text(208, 558, '家长请使用学生邀请码', 13, 400, C.muted, 'middle')}
    ${callout(1, 46, 310, 324, 68, 28, 300)}
    ${callout(2, 46, 425, 324, 56, 388, 414)}`);
}

function teacherActivation() {
  return base(`${topbar('绑定孩子')}
    <circle cx="208" cy="125" r="34" fill="${C.navy}"/>${text(208, 134, '书', 28, 700, '#fff', 'middle')}
    ${text(208, 189, '教师身份激活', 30, 760, C.ink, 'middle')}
    ${text(208, 220, '首次登录时在邀请码页输入教师激活码', 14, 400, C.muted, 'middle')}
    <g filter="url(#shadow)">${rect(24, 258, 368, 238, 22)}
      ${text(48, 292, '邀请码', 14, 650)}
      ${rect(48, 312, 320, 64, 14, '#fafcfb', '#bfd6cf')}
      ${text(208, 354, 'PANAAA', 26, 760, C.ink, 'middle')}
      ${text(208, 399, 'PANAAA 仅用于首次激活教师身份', 12, 400, C.muted, 'middle')}
      ${rect(48, 427, 320, 52, 14, C.navy, C.navy)}${text(208, 460, '确认绑定', 17, 700, '#fff', 'middle')}
    </g>
    ${text(208, 534, '提示“已成为老师”后自动进入教师首页', 13, 600, C.green, 'middle')}
    ${callout(1, 46, 310, 324, 68, 28, 300)}
    ${callout(2, 46, 425, 324, 56, 388, 414)}`);
}

function bindSuccess() {
  return base(`${topbar('绑定孩子')}
    <g filter="url(#shadow)">${rect(24, 112, 368, 372, 24)}
      <circle cx="208" cy="180" r="38" fill="${C.soft}"/>${text(208, 190, '✓', 35, 760, C.green, 'middle')}
      ${text(208, 256, '潘同学', 30, 760, C.ink, 'middle')}
      ${text(208, 289, '举例班', 17, 500, C.muted, 'middle')}
      ${text(208, 320, '来自 潘老师', 15, 650, C.green, 'middle')}
      ${text(208, 353, '绑定成功', 13, 650, '#39806f', 'middle')}
      ${rect(48, 401, 320, 56, 14, C.navy, C.navy)}${text(208, 437, '进入首页', 17, 700, '#fff', 'middle')}
    </g>
    ${callout(1, 74, 230, 268, 126, 52, 218)}
    ${callout(2, 46, 399, 324, 60, 388, 389)}`);
}

function parentHomeTop() {
  return base(`${topbar('番番记录')}
    <rect x="0" y="48" width="416" height="138" rx="0" fill="${C.navy}"/>
    ${text(24, 77, '番番记录', 12, 700, '#bfe1d8')}
    ${text(24, 116, '晚上好，潘同学家长', 25, 760, '#fff')}
    ${text(24, 147, '举例班 · 潘老师', 14, 500, '#d8eeea')}
    <g filter="url(#shadow)">${rect(16, 202, 384, 76)}
      <circle cx="52" cy="240" r="20" fill="${C.soft}"/>${text(52, 247, '✓', 22, 700, C.green, 'middle')}
      ${text(84, 229, '今日状态', 12, 600, C.muted)}${pill(84, 237, 112, '今日已签到 18:30')}
    </g>
    <g filter="url(#shadow)">${rect(16, 294, 384, 74)}
      <circle cx="52" cy="331" r="20" fill="${C.soft}"/>${text(52, 338, '铃', 17, 700, C.green, 'middle')}
      ${text(84, 323, '开启学习提醒', 16, 700)}${text(84, 346, '及时接收签到、签退和课后反馈', 11, 400, C.muted)}${text(377, 337, '›', 24, 400, C.green, 'middle')}
    </g>
    <g filter="url(#shadow)">${rect(16, 384, 384, 132)}
      ${text(32, 414, '本周课表', 17, 720)}${text(382, 414, '进入小组详情 ›', 11, 600, C.green, 'end')}
      ${pill(32, 436, 70, '星期三')}${text(120, 455, '举例班', 15, 700)}${text(120, 478, '18:30 - 20:30', 12, 400, C.muted)}
    </g>
    ${callout(1, 14, 292, 388, 78, 403, 282)}
    ${callout(2, 14, 382, 388, 136, 403, 372)}`);
}

function parentHomeMiddle() {
  return base(`${topbar('番番记录')}
    <g filter="url(#shadow)">${rect(16, 64, 384, 144)}
      ${text(32, 91, '专属清单', 11, 700, C.green)}${text(32, 120, '今日课后任务', 18, 760)}
      ${text(32, 151, '完成口算练习第 1—20 题', 14, 500)}${text(32, 178, '整理错题，明天课堂讲评', 13, 400, C.muted)}
    </g>
    <g filter="url(#shadow)">${rect(16, 224, 384, 248)}
      ${text(32, 255, '最新反馈', 18, 760)}${text(382, 255, '历史记录 ›', 11, 600, C.green, 'end')}
      ${rect(32, 274, 352, 80, 14, '#f6faf8', '#e0ebe7')}${text(48, 300, '学习小组总反馈', 14, 700)}${text(48, 325, '今天计算基础掌握稳定…', 12, 400, C.muted)}
      ${rect(32, 366, 352, 80, 14, '#f6faf8', '#e0ebe7')}${text(48, 392, '学生个人反馈', 14, 700)}${text(48, 417, '潘同学课堂主动，书写有进步…', 12, 400, C.muted)}
    </g>
    <g filter="url(#shadow)">${rect(16, 490, 384, 100)}
      <circle cx="54" cy="540" r="22" fill="${C.soft}"/>${text(54, 547, '题', 17, 700, C.green, 'middle')}
      ${text(88, 528, '每日打卡', 17, 760)}${text(88, 553, '领取今日题目、拍照提交、查看复核结果', 11, 400, C.muted)}${text(378, 546, '›', 25, 400, C.green, 'middle')}
    </g>
    ${text(24, 636, '说明：课后任务卡仅展示；反馈卡点开后原地弹窗。', 12, 500, C.muted)}
    ${callout(1, 14, 62, 388, 148, 403, 53)}
    ${callout(2, 14, 222, 388, 252, 403, 213)}
    ${callout(3, 14, 488, 388, 104, 403, 478)}`);
}

function practiceReady() {
  return base(`${topbar('每日打卡')}
    <rect x="0" y="48" width="416" height="110" rx="0" fill="${C.navy}"/>
    ${text(24, 76, 'DAILY PRACTICE', 10, 700, '#bfe1d8')}${text(24, 111, '每日个性化打卡', 23, 760, '#fff')}${text(24, 137, '2026-07-13 · 约 20 分钟', 12, 400, '#d8eeea')}
    ${rect(16, 174, 384, 76)}${text(32, 202, '暑期计算力计划', 16, 720)}${text(32, 226, '小学四则运算 · 3 题 · 20 分钟', 11, 400, C.muted)}${pill(311, 193, 68, '待完成', '#fff3df', '#a66c1f')}
    ${rect(16, 266, 384, 236)}${text(32, 296, '今日题目', 17, 760)}${text(382, 296, '建议写在纸上', 11, 500, C.green, 'end')}
    ${pill(32, 316, 36, '1')}${text(82, 335, '125 × 8 = ?', 15, 600)}${text(82, 355, '乘法 · 难度 2', 10, 400, C.muted)}
    ${pill(32, 374, 36, '2')}${text(82, 393, '840 ÷ 7 = ?', 15, 600)}${text(82, 413, '除法 · 难度 2', 10, 400, C.muted)}
    ${pill(32, 432, 36, '3')}${text(82, 451, '商店原有 96 本练习册…', 14, 600)}${text(82, 473, '应用题 · 难度 3', 10, 400, C.muted)}
    ${rect(16, 518, 384, 142)}${text(32, 548, '拍照提交', 17, 760)}${text(32, 570, '拍清题号和解题过程，最多 6 张', 11, 400, C.muted)}
    ${rect(32, 590, 352, 52, 14, C.navy, C.navy)}${text(208, 623, '拍照或选择图片', 16, 700, '#fff', 'middle')}
    ${callout(1, 14, 264, 388, 240, 403, 254)}
    ${callout(2, 30, 588, 356, 56, 403, 578)}`);
}

function practiceReviewed() {
  return base(`${topbar('每日打卡')}
    <rect x="0" y="48" width="416" height="100" rx="0" fill="${C.navy}"/>
    ${text(24, 78, 'DAILY PRACTICE', 10, 700, '#bfe1d8')}${text(24, 111, '每日个性化打卡', 23, 760, '#fff')}
    ${rect(16, 166, 384, 74)}${text(32, 195, '暑期计算力计划', 16, 720)}${text(32, 218, '小学四则运算 · 3 题', 11, 400, C.muted)}${pill(304, 185, 76, '已复核')}
    ${rect(16, 256, 384, 188)}${text(32, 286, '拍照提交', 17, 760)}${pill(310, 272, 70, '已传 2 张')}
    ${rect(32, 310, 78, 58, 10, '#eef4f2', '#dce8e4')}${text(71, 345, '照片 1', 11, 500, C.muted, 'middle')}${rect(120, 310, 78, 58, 10, '#eef4f2', '#dce8e4')}${text(159, 345, '照片 2', 11, 500, C.muted, 'middle')}
    ${rect(32, 382, 352, 46, 12, C.soft, C.soft)}${text(48, 410, '老师已复核：第 2 题注意竖式对齐。', 13, 600, C.green)}
    ${rect(16, 460, 384, 178)}${text(32, 490, '最近记录', 17, 760)}
    ${text(32, 527, '2026-07-13', 13, 500)}${pill(302, 508, 76, '已复核')}
    <line x1="32" y1="544" x2="384" y2="544" stroke="${C.line}"/>
    ${text(32, 574, '2026-07-12', 13, 500)}${pill(302, 555, 76, '已提交', '#eef3fb', '#496a9a')}
    <line x1="32" y1="591" x2="384" y2="591" stroke="${C.line}"/>
    ${text(32, 621, '2026-07-11', 13, 500)}${pill(302, 602, 76, '待完成', '#fff3df', '#a66c1f')}
    ${callout(1, 302, 183, 80, 32, 394, 173)}
    ${callout(2, 30, 380, 356, 50, 403, 370)}
    ${callout(3, 14, 458, 388, 182, 403, 448)}`);
}

function homeworkList() {
  return base(`${topbar('作业批改')}
    <rect x="16" y="64" width="384" height="108" rx="20" fill="${C.navy}"/>
    ${text(32, 91, '作业批改', 12, 650, '#bfe1d8')}${text(32, 126, '潘同学', 25, 760, '#fff')}${text(32, 151, '积分余额 18', 12, 400, '#d8eeea')}
    <g filter="url(#shadow)">${rect(16, 190, 384, 150)}
      ${text(32, 222, '7 月 13 日数学作业', 17, 720)}${text(32, 248, '2026-07-13 · 数学', 12, 400, C.muted)}${pill(322, 208, 58, '8/10')}
      <line x1="32" y1="270" x2="384" y2="270" stroke="${C.line}"/>
      ${text(32, 306, '本次积分 +6', 12, 500, C.muted)}${text(382, 306, '查看逐题结果 ›', 12, 650, C.green, 'end')}
    </g>
    <g filter="url(#shadow)">${rect(16, 356, 384, 150)}
      ${text(32, 388, '7 月 10 日口算练习', 17, 720)}${text(32, 414, '2026-07-10 · 数学', 12, 400, C.muted)}${pill(322, 374, 58, '10/10')}
      <line x1="32" y1="436" x2="384" y2="436" stroke="${C.line}"/>
      ${text(32, 472, '本次积分 +10', 12, 500, C.muted)}${text(382, 472, '查看逐题结果 ›', 12, 650, C.green, 'end')}
    </g>
    ${text(24, 548, '入口：点击微信“作业批改完成”通知。', 13, 650, C.red)}
    ${text(24, 574, '当前首页没有作业批改入口。', 12, 500, C.muted)}
    ${callout(1, 14, 188, 388, 154, 403, 178)}
    ${callout(2, 270, 282, 116, 36, 253, 319)}`);
}

function homeworkDetail() {
  return base(`${topbar('作业批改')}
    <rect x="0" y="48" width="416" height="733" fill="#173f3955"/>
    <rect x="0" y="94" width="416" height="687" rx="26" fill="#fff"/>
    ${text(24, 132, '7 月 13 日数学作业', 18, 760)}${text(24, 157, '2026-07-13 · 本次积分 +6', 11, 400, C.muted)}${text(390, 137, '关闭', 12, 650, C.green, 'end')}
    ${rect(16, 181, 384, 496, 18, '#fff', C.line)}
    ${text(32, 215, '第 2 题', 17, 720)}${pill(289, 196, 92, '需要订正', C.peach, '#b14e47')}
    ${rect(32, 238, 352, 142, 10, '#f6f7f5', '#d9e3df')}
    ${text(54, 275, '2.  840 ÷ 7 =', 17, 600)}${text(77, 319, '840', 15, 500)}${text(77, 345, '− 70', 15, 500)}${text(292, 326, '×', 42, 800, C.red, 'middle')}
    ${text(32, 416, '学生答案', 12, 500, C.muted)}${text(113, 416, '12', 13, 600)}
    ${text(32, 450, '错误步骤', 12, 500, C.muted)}${text(113, 450, '第二步商位写错', 13, 600)}
    ${text(32, 484, '错误类型', 12, 500, C.muted)}${text(113, 484, '竖式位值错误', 13, 600)}
    ${rect(32, 510, 352, 88, 12, '#f2f8f6', '#e0ebe7')}${text(48, 539, '教师评语', 12, 700, C.green)}${text(48, 566, '先确定商的最高位，再逐位计算。', 13, 500)}
    ${text(32, 629, '点击批改图片可放大查看原位勾叉', 12, 500, C.muted)}
    ${callout(1, 30, 236, 356, 146, 403, 226)}
    ${callout(2, 104, 431, 184, 31, 303, 421)}
    ${callout(3, 30, 508, 356, 92, 403, 498)}`);
}

const pages = {
  'P01-bind-input.png': bindInput,
  'P02-bind-success.png': bindSuccess,
  'P03-parent-home-top.png': parentHomeTop,
  'P04-parent-home-middle.png': parentHomeMiddle,
  'P05-practice-ready.png': practiceReady,
  'P06-practice-reviewed.png': practiceReviewed,
  'P07-homework-list.png': homeworkList,
  'P08-homework-detail.png': homeworkDetail,
};

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(teacherOutDir, { recursive: true });
  const teacherOutput = path.join(teacherOutDir, 'T02-teacher-activate.png');
  await sharp(Buffer.from(teacherActivation())).png().toFile(teacherOutput);
  process.stdout.write(`${path.relative(root, teacherOutput)}\n`);
  for (const [name, render] of Object.entries(pages)) {
    const output = path.join(outDir, name);
    await sharp(Buffer.from(render())).png().toFile(output);
    process.stdout.write(`${path.relative(root, output)}\n`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
