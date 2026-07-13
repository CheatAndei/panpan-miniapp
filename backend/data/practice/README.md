# 每日打卡题库数据

`guangzhou-blueprint-v1.json` 只保存广州官方公开资料中的命题方向、结构和来源链接，
不保存或复制考试原题。`guangzhou-original-v1.js` 根据该蓝图生成 60 道项目原创题，
所有城市数字都是练习设定，不是官方统计。

导入外部 JSON 时默认 dry-run：

```powershell
npm run practice:import -- .\path\questions.json
npm run practice:import -- .\path\questions.json --commit
```

只有项目原创、CC0、CC BY 4.0 或公版题可提交。来源仅公开但未授权复制时，
只能把 `provenance` 标为 `self_authored`，以其作为命题风格参考，不能导入原题。
