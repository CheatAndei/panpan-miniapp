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
