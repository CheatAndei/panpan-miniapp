# 学生专属每日练习清单

本目录存放“按学生、按日期固定”的自编题清单。它与通用
`practice_questions` 题库隔离，不能参与普通自适应抽题。

## JSON v1

```json
{
  "metadata": {
    "schema_version": 1,
    "curriculum_key": "stable-lowercase-key-v1",
    "title": "学生专属计算 22 天",
    "start_date": "2026-07-28",
    "end_date": "2026-08-18",
    "daily_question_count": 10,
    "retire_overlapping_adaptive_plans": true,
    "retirement_guard": {
      "expected_plans": [
        {
          "plan_id": 10,
          "title": "需结束的旧计划原名",
          "teacher_nickname": "教师昵称",
          "class_name": "班级名",
          "start_date": "2026-07-27",
          "end_date": "2026-07-29",
          "retire_to": "2026-07-27",
          "active_student_external_ids": ["stu_32位十六进制"]
        }
      ]
    },
    "source_document": {
      "key": "calculation-100-source-v1",
      "title": "计算100题",
      "sha256": "可选的原文件 SHA-256"
    }
  },
  "student_match": {
    "external_id": "stu_32位十六进制"
  },
  "days": [
    {
      "day_index": 1,
      "date": "2026-07-28",
      "source_page": 4,
      "question_type_key": "single-page-type-key",
      "question_type_label": "当天唯一题型",
      "questions": [
        {
          "signature": "curriculum.day01.q01",
          "template_key": "single-page-type-key",
          "stem": "兼容旧端的纯文本题干",
          "answer": "教师答案",
          "answer_render": {
            "version": 1,
            "blocks": [
              { "type": "fraction", "numerator": "5", "denominator": "6" }
            ]
          },
          "difficulty": 3,
          "estimated_seconds": 90,
          "provenance": "self_authored",
          "render": {
            "version": 1,
            "blocks": [
              { "type": "text", "value": "计算：" },
              { "type": "fraction", "numerator": "1", "denominator": "2" },
              { "type": "operator", "value": "+" },
              { "type": "fraction", "numerator": "1", "denominator": "3" }
            ]
          }
        }
      ]
    }
  ]
}
```

每个 `days[].questions` 必须恰好 10 道；示例只展示单题结构，不能直接导入。
日期必须从 `start_date` 起连续，`day_index` 从 1 连续增长。每个 day 只有一组
`source_page` 和 `question_type_*`，题目不能自行改成其他题型。

分数必须放入 `render.blocks` 的 `fraction`，分别填写 `numerator` 和
`denominator`；题干及显示块不得用 `/` 假装分数。`render` 只供学生端显示，
答案永远不会由今日题单接口返回。
若标准答案本身是分数，可在内部 `answer` 保留精确有理数值，但必须同时提供
`answer_render.blocks.fraction`；教师批改台只按分子、分母结构显示，不展示 `/`。

`student_match.external_id` 是首选。只有首次定位旧数据时才可改用：

```json
{
  "student_match": {
    "name": "学生姓名",
    "teacher_scope": { "nickname": "教师昵称" },
    "class_name": "可选班名"
  }
}
```

脚本会要求匹配结果严格等于一条，并在数据库已经生成稳定 `external_id` 后才允许
继续。清单中禁止写生产自增 `student_id`。

`retire_overlapping_adaptive_plans` 只有在需要结束该学生旧混合练习计划时才设为
`true`，并且必须同时完整填写 `retirement_guard.expected_plans`。服务会逐项核对
旧计划 ID、标题、教师、班级、原起止日期、班级在读学生和计划设置学生的稳定
`external_id`；实际重叠计划集合必须与保护清单一致。更新采用全字段 compare-and-swap，
只把明确列出的计划结束在新课程前一天；任一字段变化、出现额外计划或涉及其他学生，
都会整批中止。

## 安全部署

先预检；默认模式会自动把指定数据库复制到临时目录，只迁移和检查临时副本：

```bash
npm run practice:curriculum -- --manifest resources/practice/curricula/<file>.json
```

生产数据库必须先备份，再执行带显式保护值的应用：

```bash
npm run db:backup
npm run practice:curriculum -- \
  --manifest resources/practice/curricula/<file>.json \
  --expect-student-external-id <stu_xxx> \
  --apply
```

脚本在一个 `BEGIN IMMEDIATE` 事务中写入课程、22 个日期和题单：

- 已存在但尚未领取的 `ready` 题单会连同旧题目原子替换。
- `claimed_at` 非空、已有 submission 或状态不为 `ready` 时，全批中止。
- 同一清单重复执行只核对哈希，不重复插入或改写已经锁定的题单。
- 清单中删除日期时，若该日期已领取或提交，同样全批中止。

冯浩源这次清单的业务验收条件是：`2026-07-28` 为 Day 1 / PDF P4，
逐日递增至 `2026-08-18` 的 Day 22 / PDF P25，每天恰好 10 道、全天单一题型，
不循环。

仓库的手动工作流 `Production Student Curriculum Apply` 会再次要求稳定
`external_id` 和确认口令，停止 API 后备份、预检、应用，并验证 7 月 27 日已提交
历史未变、22 天页码映射、每天 10 题和单一题型；任一步失败都会恢复备份并重启 API。
