// 七年级「周末攻坚战」首发两周内容。
// 学生端只序列化 render；answer、solution 与来源复核信息仅教师端可见。
const text = (value) => ({ type: 'text', value });
const fraction = (numerator, denominator) => ({ type: 'fraction', numerator, denominator });

module.exports = {
  schema_version: 1,
  sets: [
    {
      stable_code: 'wm-g7-2026-08-07-number-line-v1',
      cycle_start: '2026-08-07',
      cycle_end: '2026-08-14',
      grade_code: 'g7',
      subject_code: 'math',
      topic_key: 'number-line-motion',
      title: '数轴动点 · 距离分类',
      status: 'published',
      questions: [
        {
          stable_code: 'wm-g7-2026-08-07-s1',
          stage: 1,
          difficulty: 3,
          title: '双点会合与倍距',
          render: {
            version: 1,
            sections: [
              {
                type: 'paragraph',
                text: '在数轴上，点 A 表示的数为 −5，点 B 表示的数为 7。动点 P 从点 A 出发，以每秒 3 个单位长度的速度向右运动；同时，动点 Q 从点 B 出发，以每秒 1 个单位长度的速度向左运动。相遇后两点继续沿原方向运动，速度保持不变。',
              },
              {
                type: 'number_line',
                label: '初始位置与运动方向（示意图）',
                points: [
                  { name: 'A（P 起点）', value: '−5', position: 24 },
                  { name: 'B（Q 起点）', value: '7', position: 76 },
                ],
                motions: [
                  { from: 24, to: 52, label: 'P：3 单位/秒' },
                  { from: 76, to: 58, label: 'Q：1 单位/秒' },
                ],
              },
              { type: 'paragraph', text: '设运动时间为 t 秒，且 t≥0。' },
              {
                type: 'list',
                items: [
                  { label: '（1）', text: '用含 t 的式子表示点 P、点 Q 所表示的数，并求两点相遇的时刻及相遇点所表示的数。' },
                  { label: '（2）', text: '当 P、Q 两点之间的距离为 4 个单位长度时，求 t。' },
                  { label: '（3）', text: '当 PA＝2PQ 时，求 t。' },
                ],
              },
            ],
          },
          diagram: { type: 'native_number_line', asset_required: false },
          answer: {
            version: 1,
            text: '（1）xP=−5+3t，xQ=7−t；3 秒时相遇于 4。（2）t=2 或 4。（3）t=24/11 或 24/5。',
          },
          solution: {
            version: 1,
            sections: [
              { type: 'paragraph', text: '运动 t 秒后，点 P、Q 表示的数分别为：' },
              { type: 'formula', blocks: [text('xP＝−5＋3t，　xQ＝7−t')] },
              { type: 'paragraph', text: '（1）相遇时 −5＋3t＝7−t，解得 t＝3；相遇点表示的数为 −5＋3×3＝4。' },
              { type: 'paragraph', text: '（2）PQ＝|（−5＋3t）−（7−t）|＝|4t−12|。由 |4t−12|＝4，得：' },
              { type: 'formula', blocks: [text('t＝2　或　t＝4')] },
              { type: 'paragraph', text: '（3）PA＝3t，PQ＝|4t−12|，所以 3t＝2|4t−12|。以两点相遇的 t＝3 为分界分类。' },
              { type: 'paragraph', text: '当 0≤t≤3 时，3t＝2（12−4t），所以 11t＝24；当 t≥3 时，3t＝2（4t−12），所以 5t＝24。两个解都符合各自范围。' },
              {
                type: 'formula',
                blocks: [text('t＝'), fraction('24', '11'), text('　或　t＝'), fraction('24', '5')],
              },
            ],
          },
          source_label: '广州七上试卷库同类结构重编',
          source_url: '',
          provenance_note: '母结构来自 GZ7-MON-3150EE3BC7、GZ7-MID-25DD1A4DCF；题干、坐标、速度与小问均重新编写。已用方程求解与代回坐标两种方法复核：24/11、24/5 均满足 PA＝2PQ。',
        },
        {
          stable_code: 'wm-g7-2026-08-07-s2',
          stage: 2,
          difficulty: 5,
          title: '三点联动与距离最值',
          render: {
            version: 1,
            sections: [
              { type: 'paragraph', text: '在数轴上，点 A、B、P 最初表示的数分别为 −8、10、16。三点同时开始运动，相遇后仍按原方向和原速度继续运动。' },
              {
                type: 'number_line',
                label: '初始位置与运动方向（示意图）',
                points: [
                  { name: 'A', value: '−8', position: 18 },
                  { name: 'B', value: '10', position: 61 },
                  { name: 'P', value: '16', position: 83 },
                ],
                motions: [
                  { from: 18, to: 42, label: 'A：向右 3' },
                  { from: 61, to: 73, label: 'B：向右 1' },
                  { from: 83, to: 67, label: 'P：向左 2' },
                ],
              },
              { type: 'paragraph', text: '点 A 每秒向右 3 个单位长度，点 B 每秒向右 1 个单位长度，点 P 每秒向左 2 个单位长度。设运动时间为 t 秒，且 t≥0。' },
              {
                type: 'list',
                items: [
                  { label: '（1）', text: '用含 t 的式子表示三点所表示的数，并分别求出 P 与 B、P 与 A、A 与 B 相遇的时刻。' },
                  { label: '（2）', text: '若某一时刻满足 PA＝2PB 或 PB＝2PA，则称它为点 P 关于 A、B 的“倍距时刻”。求所有倍距时刻。' },
                  { label: '（3）', text: '求 PA＋PB 的最小值，并求取得最小值时的 t。' },
                ],
              },
            ],
          },
          diagram: { type: 'native_number_line', asset_required: false },
          answer: {
            version: 1,
            text: '（1）xA=−8+3t，xB=10+t，xP=16−2t；相遇时刻依次为 2、24/5、9。（2）36/11、54/13、6。（3）最小值 42/5，t=24/5。',
          },
          solution: {
            version: 1,
            sections: [
              { type: 'paragraph', text: '运动 t 秒后：' },
              { type: 'formula', blocks: [text('xA＝−8＋3t，　xB＝10＋t，　xP＝16−2t')] },
              { type: 'paragraph', text: '（1）分别令两点坐标相等，可得 P、B 在 t＝2 时相遇，A、B 在 t＝9 时相遇；P、A 相遇时：' },
              { type: 'formula', blocks: [text('t＝'), fraction('24', '5')] },
              { type: 'paragraph', text: '（2）PA＝|24−5t|，PB＝|6−3t|。分别解 |24−5t|＝2|6−3t| 与 |6−3t|＝2|24−5t|，舍去负数解，得到：' },
              {
                type: 'formula',
                blocks: [text('t＝'), fraction('36', '11'), text('，　'), fraction('54', '13'), text('，　6')],
              },
              { type: 'paragraph', text: '（3）按 t＝2 和 t＝24/5 分类，PA＋PB 分别为 30−8t、18−2t、8t−30。前两段递减，第三段递增，因此转折点取得全局最小值。' },
              {
                type: 'formula',
                blocks: [text('当 t＝'), fraction('24', '5'), text(' 时，PA＋PB 的最小值为 '), fraction('42', '5')],
              },
            ],
          },
          source_label: '广州七上试卷库同类结构重编',
          source_url: '',
          provenance_note: '母结构来自 GZ7-MID-099E2A5F0E；题目全部重写。独立复核三个倍距时刻的两段距离分别为 84/11 与 42/11、42/13 与 84/13、6 与 12；最值函数三段斜率为 −8、−2、8。',
        },
      ],
    },
    {
      stable_code: 'wm-g7-2026-08-14-pattern-v1',
      cycle_start: '2026-08-14',
      cycle_end: '2026-08-21',
      grade_code: 'g7',
      subject_code: 'math',
      topic_key: 'pair-counting-pattern',
      title: '找规律 · 字母表示与组合计数',
      status: 'published',
      questions: [
        {
          stable_code: 'wm-g7-2026-08-14-s1',
          stage: 1,
          difficulty: 3,
          title: '星轨灯阵',
          render: {
            version: 1,
            sections: [
              { type: 'paragraph', text: '科技节要制作“星轨灯阵”：在圆周上放置 n 个光点，每两个光点之间都连接且只连接 1 条灯带。设灯带总数为 Lₙ。下面记录了前几次试装的数据。' },
              {
                type: 'table',
                label: '光点数与灯带总数',
                headers: ['光点数 n', '5', '6', '7', '8'],
                rows: [['灯带数 Lₙ', '10', '15', '21', '？']],
              },
              {
                type: 'list',
                items: [
                  { label: '（1）', text: '当 n＝8 时，求灯带总数。' },
                  { label: '（2）', text: '用含 n 的式子表示 Lₙ，并用“逐点连接”或“两次计数”的方法解释你的式子。' },
                  { label: '（3）', text: '当 n＝14 时，求灯带总数，并换一种方法进行验证。' },
                  { label: '（4）', text: '现有 104 条灯带，能否恰好搭成一个完整的星轨灯阵？说明理由。' },
                ],
              },
            ],
          },
          diagram: null,
          answer: { version: 1, text: '（1）28。（2）Lₙ=n(n−1)/2。（3）91。（4）不能，91<104<105。' },
          solution: {
            version: 1,
            sections: [
              { type: 'paragraph', text: '（1）前面的新增灯带数依次是 1、2、3、…；加入第 8 个光点时新增 7 条，所以 L₈＝21＋7＝28。' },
              { type: 'paragraph', text: '（2）第 2、3、…、n 个光点依次新增 1、2、…、n−1 条灯带，因此 Lₙ＝1＋2＋…＋（n−1）。也可把每个光点连接的 n−1 条都数一遍，再除去每条灯带被重复计算的 2 次。' },
              { type: 'formula', blocks: [text('Lₙ＝'), fraction('n(n−1)', '2')] },
              { type: 'paragraph', text: '（3）代入 n＝14：' },
              { type: 'formula', blocks: [text('L₁₄＝'), fraction('14×13', '2'), text('＝91')] },
              { type: 'paragraph', text: '另一种验证：1＋2＋…＋13＝（1＋13）＋（2＋12）＋…＋（6＋8）＋7＝6×14＋7＝91。' },
              { type: 'paragraph', text: '（4）L₁₄＝91，L₁₅＝15×14÷2＝105，而 91＜104＜105，所以不存在整数个光点恰好使用 104 条灯带。' },
            ],
          },
          source_label: '广州七上找规律题库与 NRICH 组合计数模型重编',
          source_url: 'https://nrich.maths.org/problems/mystic-rose',
          provenance_note: '模型参考教师提供的广州七上期末模拟卷同类题及 Cambridge NRICH Mystic Rose、Handshakes；场景、数字与四个小问均重新编写。用递推求和与两次计数独立复核。',
        },
        {
          stable_code: 'wm-g7-2026-08-14-s2',
          stage: 2,
          difficulty: 5,
          title: '机器人联赛的缺赛之谜',
          render: {
            version: 1,
            sections: [
              { type: 'paragraph', text: '某机器人联赛有 n 台机器人参加，每两台之间原计划比赛 1 场。比赛中，机器人 A 完成 8 场后退出，机器人 B 完成 3 场后退出；除 A、B 外，其余 n−2 台机器人相互之间的比赛全部完成。最终共完成 65 场。' },
              {
                type: 'list',
                items: [
                  { label: '（1）', text: '用含 n 的式子表示其余 n−2 台机器人相互之间完成的比赛场数。' },
                  { label: '（2）', text: '设 x＝1 表示 A、B 已经交手，x＝0 表示两者没有交手。用含 n、x 的式子表示总场数。' },
                  { label: '（3）', text: '求 n，并判断 A、B 是否已经交手。' },
                  { label: '（4）', text: '把完整单循环的总场数减去未完成场数，验证你的结论。' },
                ],
              },
              { type: 'note', label: '注意', text: '若 A、B 已交手，这一场会同时出现在 A 的 8 场和 B 的 3 场中，不能重复计算。' },
            ],
          },
          diagram: null,
          answer: { version: 1, text: '（1）(n−2)(n−3)/2。（2）(n−2)(n−3)/2+11−x。（3）n=13，A、B 已交手。（4）78−13=65。' },
          solution: {
            version: 1,
            sections: [
              { type: 'paragraph', text: '（1）其余 n−2 台之间每两台赛 1 场，所以比赛场数为：' },
              { type: 'formula', blocks: [fraction('(n−2)(n−3)', '2')] },
              { type: 'paragraph', text: '（2）A、B 完成的场数相加为 8＋3；若两者已交手，要减去重复计算的 1 场，所以总场数为：' },
              { type: 'formula', blocks: [fraction('(n−2)(n−3)', '2'), text('＋11−x')] },
              { type: 'paragraph', text: '（3）当 x＝0 时，需要（n−2）（n−3）＝108，但相邻整数 10×9＝90、11×10＝110，不可能。' },
              { type: 'paragraph', text: '当 x＝1 时，（n−2）（n−3）＝110＝11×10，因此 n−2＝11，n＝13。故 A、B 已经交手。' },
              { type: 'paragraph', text: '（4）13 台完整单循环共 13×12÷2＝78 场。与 A、B 有关的比赛原计划 2×11＋1＝23 场，实际完成 8＋3−1＝10 场，所以未完成 13 场。' },
              { type: 'formula', blocks: [text('78−13＝65')] },
            ],
          },
          source_label: 'NRICH Handshakes 同型计数模型重编',
          source_url: 'https://nrich.maths.org/problems/handshakes?tab=solutions',
          provenance_note: '参考 Cambridge NRICH Handshakes 的配对计数思想；机器人联赛场景、退出条件和 65 场数据均重新编写。已用分类方程与补集计数两条独立路径复核 n＝13。',
        },
      ],
    },
  ],
};
