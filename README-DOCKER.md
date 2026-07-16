# 潘潘老师独立后端部署

## 1. 准备环境

安装 Docker / Docker Compose。

## 2. 配置环境变量

```bash
cd panpan
cp backend/.env.example backend/.env
```

编辑 `backend/.env`：

```env
JWT_SECRET=换成一串长随机字符
APP_ID=微信小程序 AppID
APP_SECRET=微信小程序 AppSecret
DEEPSEEK_API_KEY=DeepSeek Key
WX_MINIPROGRAM_STATE=formal
TPL_CHECKIN=签到订阅消息模板ID
TPL_CHECKOUT=签退订阅消息模板ID
TPL_FEEDBACK=课后反馈订阅消息模板ID
TPL_REMINDER=上课提醒订阅消息模板ID
TPL_HOMEWORK=作业提醒订阅消息模板ID

TPL_FIELD_CHECKIN_STUDENT=thing1
TPL_FIELD_CHECKIN_TIME=time3
TPL_FIELD_CHECKIN_STATUS=phrase2
TPL_FIELD_CHECKOUT_STUDENT=thing1
TPL_FIELD_CHECKOUT_TIME=time3
TPL_FIELD_CHECKOUT_STATUS=phrase2
TPL_FIELD_CHECKOUT_NOTE=thing3
TPL_FIELD_FEEDBACK_TITLE=thing1
TPL_FIELD_FEEDBACK_TIME=time2
TPL_FIELD_FEEDBACK_NOTE=thing3
TPL_FIELD_REMINDER_CLASS=thing1
TPL_FIELD_REMINDER_TIME=time2
TPL_FIELD_REMINDER_NOTE=thing3
TPL_FIELD_HOMEWORK_TITLE=thing1
TPL_FIELD_HOMEWORK_TIME=time2
TPL_FIELD_HOMEWORK_NOTE=thing3
```

订阅消息模板 ID 获取位置：

1. 打开微信公众平台。
2. 进入你的小程序。
3. 左侧菜单点「功能」->「订阅消息」。
4. 选择或添加 5 个一次性订阅模板：签到通知、签退通知、课后反馈通知、上课提醒、作业提醒。
5. 复制每个模板详情里的「模板 ID」。
6. 粘贴到上面的 `TPL_CHECKIN`、`TPL_CHECKOUT`、`TPL_FEEDBACK`、`TPL_REMINDER`、`TPL_HOMEWORK`。

注意：模板里的字段名要和 `.env` 一致：

- 签到：`thing1`、`phrase2`、`time3`
- 签退：`thing1`、`phrase2`、`time3`，特殊签退长文案优先使用 `thing3`
- 课后反馈 / 上课提醒 / 作业提醒：`thing1`、`time2`、`thing3`

如果微信后台模板字段不是这些名字，不用改代码，只改 `.env` 里的 `TPL_FIELD_...`。

真实模板必须从微信接口白名单内的固定出口 IP `134.175.69.59` 读取。仓库中的
`Production Notification Inspect` 手动工作流会 SSH 到这台生产服务器，再在
`panpan-api` 容器内执行只读检查；不会从开发者本机直连，也不会输出 AppSecret 或完整访问令牌。

配置后可登录小程序，请求：

```txt
https://你的域名/api/notify/status
```

返回里这些值应为 `true`：

```json
{
  "appId": true,
  "appSecret": true,
  "templates": {
    "checkin": true,
    "checkout": true,
    "feedback": true,
    "reminder": true,
    "homework": true
  }
}
```

## 3. 启动

```bash
docker compose up -d --build
```

健康检查：

```bash
curl http://localhost:3000/api/health
```

## 4. 数据持久化

Docker volume：

- `panpan-data` -> SQLite DB `/app/data/teach.db`
- `panpan-uploads` -> 上传文件 `/app/uploads`

## 5. 小程序 API 地址

前端默认：

```txt
http://localhost:3000/api
```

构建时设置：

```bash
VITE_API_BASE_URL=https://你的域名/api npm run build:mp
```

微信真机要求：

- 必须 HTTPS
- 域名加入微信小程序后台 request 合法域名

体验版微信登录失败时，先检查：

1. 微信公众平台 -> 开发 -> 开发管理 -> 开发设置。
2. 服务器域名 -> request 合法域名。
3. 必须加入：

```txt
https://panpan.xpytt.com
```

4. 后端环境变量必须已配置：

```env
APP_ID=小程序 AppID
APP_SECRET=小程序 AppSecret
```

5. 可访问接口检查后端：

```txt
https://panpan.xpytt.com/api/health
https://panpan.xpytt.com/api/auth/status
```
