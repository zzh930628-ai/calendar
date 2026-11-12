# Supabase + Vercel + GitHub 实施方案

## 1. 推荐定位

当前项目建议演进为：

- `GitHub`：代码仓库、版本管理、CI/CD 触发源
- `Vercel`：部署 Next.js 前端、API Route、Server Actions、定时任务入口
- `Supabase`：Postgres、认证、存储、后续 Edge Functions

这样可以把第一版重心放在：

- 页面交互
- 任务与日程数据建模
- Google Calendar 接入
- 上线与验证

## 2. 推荐架构

### 2.1 前端与服务端

- `apps/web` 继续作为主应用
- 使用 `Next.js App Router`
- 页面、Server Components、Route Handlers 都部署到 `Vercel`

### 2.2 数据层

- 使用 `Supabase Postgres`
- 用户数据、任务、日程、外部连接、同步日志统一存 Postgres
- 前端优先使用 `@supabase/supabase-js`

### 2.3 鉴权

- 第一版可选 `Supabase Auth`
- 如果后面要同时管理 Google 登录和业务账号，也可以叠加 `NextAuth`

### 2.4 第三方集成

- `Google Calendar OAuth callback` 放在 `Vercel`
- `Google webhook` 也可先接到 `Vercel Route Handler`
- `钉钉` 同理

## 3. 为什么这套更适合当前阶段

- 不需要自建数据库主机
- 不需要优先维护 NestJS 独立服务
- 部署链路短，适合 MVP
- 数据库原生就是 Postgres，与你当前数据模型兼容
- 未来仍可以继续拆出独立 worker

## 4. 推荐数据库表

建议在 Supabase 里先建以下核心表：

- `profiles`
- `tasks`
- `schedule_events`
- `calendar_connections`
- `calendars`
- `external_event_bindings`
- `sync_cursors`
- `sync_logs`
- `conflict_records`

这些表结构可直接参考当前 `apps/api/prisma/schema.prisma` 的模型设计。

## 5. 环境变量

### 5.1 Vercel 里至少需要

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`

### 5.2 本地开发

在 `apps/web/.env.local` 中配置：

```bash
cp apps/web/.env.local.example apps/web/.env.local
```

## 6. 路线建议

### 阶段 1

- 接入 Supabase
- 在前端完成任务、日程读取
- 上线 Vercel 测试环境

### 阶段 2

- Google Calendar OAuth 改到 Next.js Route Handlers
- 完成 Google 日历列表同步
- 写入 `calendar_connections` 和 `calendars`

### 阶段 3

- 增量同步
- webhook
- 冲突检测
- 定时补偿

### 阶段 4

- 接钉钉
- 评估是否拆独立 worker

## 7. 对当前代码库的建议

- 前端继续保留并作为主线
- 后端 `apps/api` 暂时不删除，作为过渡实现和接口参考
- 等 Supabase 版跑通后，再决定是否完全移除 `NestJS`

## 8. 下一步最优先事项

1. 创建 Supabase 项目
2. 填写 `apps/web/.env.local`
3. 在前端接入 Supabase client
4. 把任务列表切到真实数据库
5. 再处理 Google OAuth 的 Vercel 部署版本
