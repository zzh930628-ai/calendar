# 任务安排工作台 MVP 技术方案

## 1. 项目目标

构建一个面向个人管理场景的任务安排工作台，支持：

- 任务创建、编辑、归类、状态流转
- 周视图 / 日视图排期展示
- 时间冲突检测与提醒
- 与钉钉日历连接
- 与 Google Calendar 连接
- 支持外部日历与本地任务的双向同步

第一阶段目标不是做一个完整协作平台，而是先做一个可用、可扩展、可验证同步能力的 MVP。

## 2. MVP 范围

### 2.1 必做能力

- 用户登录
- 个人任务管理
- 日程事件管理
- 周视图工作台
- 今日时间线
- 冲突提醒
- Google Calendar OAuth 连接
- Google Calendar 事件读取与写入
- 钉钉日历授权接入
- 钉钉日历事件读取与写入
- 同步日志与失败重试

### 2.2 第一版暂不做

- 多人协作与团队权限
- 项目成员分配
- 智能自动排期
- 移动端 App
- 高级 BI 看板
- 复杂审批流
- 第三方通知中心聚合

## 3. 用户场景

### 3.1 核心用户

- 需要统一管理个人任务与会议安排的知识工作者
- 同时使用钉钉和 Google Calendar 的跨平台办公用户

### 3.2 典型流程

1. 用户登录系统
2. 连接 Google Calendar 与钉钉账号
3. 系统执行首次全量同步
4. 用户在工作台查看本周排期、任务、冲突
5. 用户在平台新建任务并转为日程
6. 系统将事件推送到外部日历
7. 外部日历发生变更时，系统回写平台
8. 出现冲突时在工作台中提示处理

## 4. 页面模块设计

## 4.1 登录页

- 邮箱或手机号登录
- 第三方授权入口
- Google Calendar 连接入口
- 钉钉授权入口

## 4.2 工作台首页

- 顶部搜索栏
- 今日待办统计卡片
- 进行中任务统计
- 逾期任务统计
- 时间冲突统计
- 本周日程大盘
- 今日时间线
- 待处理提醒
- 标签分类统计
- 最近调整记录

## 4.3 日程视图

- 日视图
- 周视图
- 月视图
- 外部日历开关筛选
- 冲突高亮
- 拖拽修改时间
- 点击事件查看详情

## 4.4 任务管理页

- 任务列表
- 状态筛选
- 优先级筛选
- 标签筛选
- 截止日期筛选
- 一键转日程
- 手动安排时间段

## 4.5 冲突中心

- 时间重叠冲突列表
- 双向同步冲突列表
- 外部删除 / 本地存在异常列表
- 手动确认保留版本

## 4.6 连接设置页

- Google Calendar 连接状态
- 钉钉连接状态
- 默认同步日历选择
- 同步方向配置
- 默认提醒配置
- 同步日志查看

## 5. 信息架构

核心分层如下：

- 任务层：描述事情本身
- 排期层：描述任务被安排到哪个时间段
- 同步层：描述本地对象与外部日历对象的映射关系
- 冲突层：描述时间冲突和版本冲突

建议本地系统始终作为业务主模型，外部日历作为同步目标与同步来源，而不是直接把外部事件当主表。

## 6. 系统架构

推荐采用前后端分离 + 异步同步架构。

### 6.1 技术栈建议

- 前端：Next.js + TypeScript + Tailwind CSS + Ant Design
- 后端：NestJS
- 数据库：PostgreSQL
- 缓存：Redis
- 队列：BullMQ
- ORM：Prisma
- 鉴权：NextAuth 或 NestJS JWT + OAuth 管理
- 部署：Vercel + 云主机 / Docker 部署后端

### 6.2 系统模块

- `web-app`：前端工作台
- `api-server`：业务 API 服务
- `sync-worker`：同步任务执行器
- `webhook-server`：接收 Google / 钉钉回调
- `scheduler`：定时补偿同步、续订 channel、失败重试

### 6.3 架构职责

- 前端负责展示、交互、状态编辑
- API 服务负责用户、任务、日程、冲突、连接配置
- Worker 负责异步同步外部日历
- Webhook 服务负责接收外部变更通知
- 定时任务负责补偿机制和健康巡检

## 7. 数据库设计

以下为 MVP 建议核心表。

### 7.1 users

```sql
id                  uuid pk
email               varchar unique
name                varchar
avatar_url          varchar
timezone            varchar default 'Asia/Shanghai'
locale              varchar default 'zh-CN'
created_at          timestamptz
updated_at          timestamptz
```

### 7.2 tasks

```sql
id                  uuid pk
user_id             uuid fk -> users.id
title               varchar
description         text
priority            varchar
status              varchar
source              varchar default 'local'
due_at              timestamptz null
estimated_minutes   int null
tag_names           jsonb
created_at          timestamptz
updated_at          timestamptz
```

说明：

- `priority` 可取 `low | medium | high | urgent`
- `status` 可取 `todo | scheduled | in_progress | done | overdue | archived`

### 7.3 schedule_events

```sql
id                  uuid pk
user_id             uuid fk -> users.id
task_id             uuid null fk -> tasks.id
title               varchar
description         text
start_at            timestamptz
end_at              timestamptz
all_day             boolean default false
timezone            varchar
location            varchar null
reminders           jsonb
status              varchar
origin              varchar
last_modified_by    varchar
created_at          timestamptz
updated_at          timestamptz
deleted_at          timestamptz null
```

说明：

- `origin` 可取 `local | google | dingtalk`
- `status` 可取 `confirmed | tentative | cancelled`
- `last_modified_by` 用于辅助冲突判断

### 7.4 calendar_connections

```sql
id                  uuid pk
user_id             uuid fk -> users.id
provider            varchar
provider_account_id varchar
status              varchar
access_token        text
refresh_token       text
token_expires_at    timestamptz null
scope               text
meta                jsonb
created_at          timestamptz
updated_at          timestamptz
```

说明：

- `provider` 可取 `google | dingtalk`
- 生产环境建议对 token 做加密存储

### 7.5 calendars

```sql
id                  uuid pk
user_id             uuid fk -> users.id
connection_id       uuid fk -> calendar_connections.id
provider            varchar
provider_calendar_id varchar
name                varchar
color               varchar null
is_primary          boolean default false
is_selected         boolean default true
read_only           boolean default false
sync_enabled        boolean default true
created_at          timestamptz
updated_at          timestamptz
```

### 7.6 external_event_bindings

```sql
id                  uuid pk
user_id             uuid fk -> users.id
schedule_event_id   uuid fk -> schedule_events.id
provider            varchar
calendar_id         uuid fk -> calendars.id
provider_event_id   varchar
provider_etag       varchar null
provider_updated_at timestamptz null
sync_token_snapshot text null
last_sync_at        timestamptz null
sync_status         varchar
created_at          timestamptz
updated_at          timestamptz
```

### 7.7 sync_cursors

```sql
id                  uuid pk
user_id             uuid fk -> users.id
provider            varchar
calendar_id         uuid fk -> calendars.id
cursor_type         varchar
cursor_value        text
expires_at          timestamptz null
meta                jsonb
created_at          timestamptz
updated_at          timestamptz
```

说明：

- Google 这里主要存 `nextSyncToken`
- 如果有 webhook channel，也需要记录资源 ID 和到期时间

### 7.8 sync_logs

```sql
id                  uuid pk
user_id             uuid fk -> users.id
provider            varchar
direction           varchar
action              varchar
resource_type       varchar
resource_local_id   uuid null
resource_remote_id  varchar null
status              varchar
error_code          varchar null
error_message       text null
payload             jsonb
created_at          timestamptz
```

### 7.9 conflict_records

```sql
id                  uuid pk
user_id             uuid fk -> users.id
schedule_event_id   uuid fk -> schedule_events.id
conflict_type       varchar
provider            varchar null
resolution_status   varchar
local_snapshot      jsonb
remote_snapshot     jsonb
resolved_by         uuid null
resolved_at         timestamptz null
created_at          timestamptz
updated_at          timestamptz
```

说明：

- `conflict_type` 可取 `time_overlap | version_conflict | deleted_mismatch`

## 8. API 设计

### 8.1 认证与用户

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/me`

### 8.2 任务

- `GET /api/tasks`
- `POST /api/tasks`
- `GET /api/tasks/:id`
- `PATCH /api/tasks/:id`
- `DELETE /api/tasks/:id`
- `POST /api/tasks/:id/schedule`

### 8.3 日程

- `GET /api/events`
- `POST /api/events`
- `GET /api/events/:id`
- `PATCH /api/events/:id`
- `DELETE /api/events/:id`
- `POST /api/events/:id/sync`

### 8.4 日历连接

- `GET /api/integrations`
- `POST /api/integrations/google/connect`
- `GET /api/integrations/google/callback`
- `POST /api/integrations/dingtalk/connect`
- `GET /api/integrations/dingtalk/callback`
- `GET /api/calendars`
- `PATCH /api/calendars/:id`

### 8.5 冲突与日志

- `GET /api/conflicts`
- `POST /api/conflicts/:id/resolve`
- `GET /api/sync-logs`

### 8.6 Webhook

- `POST /api/webhooks/google/calendar`
- `POST /api/webhooks/dingtalk/events`

## 9. Google Calendar 接入方案

### 9.1 接入方式

- 使用 OAuth 2.0 获取用户授权
- 使用 Calendar API 读写 events
- 使用 `watch` 创建 webhook channel
- 使用 `syncToken` 做增量同步

### 9.2 推荐同步模式

1. 用户授权 Google
2. 拉取 calendar list
3. 选择主同步 calendar
4. 初次全量拉取 events
5. 保存 `nextSyncToken`
6. 为选中的 calendar 建立 `watch` channel
7. 收到 webhook 后触发增量同步
8. 定时任务兜底执行补偿同步

### 9.3 关键实现点

- webhook 只表示“有变化”，不直接包含完整事件内容
- 必须在收到通知后调用 `events.list(syncToken=...)`
- 若同步 token 失效返回 `410 Gone`，则清理本地 cursor 并重新全量同步
- channel 会过期，必须提前续订
- 同步过程要支持分页

## 10. 钉钉日历接入方案

### 10.1 接入前置决策

先明确应用类型：

- 企业内部应用
- 第三方企业应用

如果当前主要服务个人或你自己所在组织，优先选企业内部应用，路径更直接。

### 10.2 接入目标

- 完成钉钉 OAuth / 免登授权
- 拉取用户可见日历或日程
- 支持创建和更新日程
- 能力允许时接入事件订阅
- 若回调不满足事件同步精度，则启用轮询补偿

### 10.3 推荐策略

- 第一版先支持“读 + 写”
- 如果文档和权限验证通过，再开“实时事件回调”
- 如果回调能力受限，采用“定时拉取增量”作为兜底

### 10.4 钉钉同步建议

1. 用户完成授权
2. 系统读取日历 / 日程数据
3. 建立本地映射表
4. 平台事件变更时推送钉钉
5. 定时拉取用户近期变更事件
6. 若可配置事件订阅，则用回调触发快速同步

## 11. 同步规则设计

### 11.1 主数据原则

- 任务始终以本系统为主
- 日程事件以本系统保存统一模型
- 外部平台是同步对象和外部来源，不直接作为唯一真相源

### 11.2 同步方向

- 本地创建事件 -> 推送 Google / 钉钉
- Google / 钉钉外部创建事件 -> 拉回平台并展示
- 本地更新事件 -> 更新对应外部事件
- 外部更新事件 -> 更新本地事件
- 本地删除事件 -> 删除或取消外部事件
- 外部删除事件 -> 标记本地事件已取消，并记录日志

### 11.3 幂等策略

- 每个本地事件必须保存外部 `provider_event_id`
- 同步任务必须带幂等键
- 重试时先查映射关系再决定创建还是更新
- webhook 重复投递必须可安全处理

### 11.4 冲突规则

- 两边短时间内同时编辑同一事件，标记 `version_conflict`
- 两个事件时间重叠，标记 `time_overlap`
- 外部删除但本地仍存在编辑记录，标记 `deleted_mismatch`
- MVP 阶段不自动合并，统一进入冲突中心手动处理

## 12. 任务流与同步流程

### 12.1 本地创建任务并安排日程

1. 用户创建任务
2. 用户点击“安排时间”
3. 生成 `schedule_event`
4. API 写入数据库
5. 投递同步任务到队列
6. Worker 调用 Google / 钉钉 API
7. 保存外部映射与同步日志

### 12.2 Google webhook 回写

1. Google 发送 webhook 到系统
2. 系统校验 channel 信息
3. 投递增量同步任务
4. Worker 读取 `syncToken`
5. 调用 `events.list(syncToken=...)`
6. 将变更合并到本地事件
7. 更新 `nextSyncToken`

### 12.3 钉钉回调或轮询回写

1. 收到钉钉事件回调或定时器触发
2. 拉取最近变更的日程数据
3. 匹配本地映射
4. 执行新增 / 更新 / 取消
5. 记录日志与冲突

## 13. 队列设计

建议拆分以下队列：

- `calendar-sync-outbound`
- `calendar-sync-inbound`
- `calendar-webhook-process`
- `calendar-channel-renewal`
- `calendar-retry`

每个任务至少带：

- `jobId`
- `userId`
- `provider`
- `calendarId`
- `eventId`
- `action`
- `retryCount`

## 14. 安全设计

- 所有第三方 token 加密存储
- webhook 入口校验签名 / headers / channel token
- 访问控制基于用户隔离数据
- 敏感日志脱敏
- OAuth scope 最小化申请
- 数据库审计关键同步动作

## 15. 异常处理与补偿

### 15.1 常见异常

- token 过期
- refresh token 失效
- Google sync token 失效
- 钉钉接口权限不足
- webhook 重复投递
- 外部 event 已被删除
- 时区转换错误

### 15.2 补偿策略

- token 失效自动刷新
- 刷新失败则提示用户重新授权
- 增量 token 失效则重新全量同步
- 同步失败写入重试队列
- 超过阈值进入人工处理

## 16. 时区与时间规则

- 默认用户时区为 `Asia/Shanghai`
- 所有数据库存储统一使用 `timestamptz`
- 全天事件单独标识 `all_day`
- 前端展示按用户时区转换
- 外部日历写回时必须带时区信息

## 17. MVP 开发顺序

### 阶段 1：基础骨架

- 初始化前后端项目
- 搭建数据库和 Prisma
- 完成登录与用户体系
- 完成任务和事件基础 CRUD

### 阶段 2：工作台页面

- 首页统计卡片
- 周视图日历组件
- 今日时间线
- 任务列表
- 冲突中心基础页面

### 阶段 3：Google 集成

- OAuth 连接
- 拉取 calendar list
- 事件双向读写
- webhook 接收
- syncToken 增量同步

### 阶段 4：钉钉集成

- 应用配置与授权
- 日程读写
- 回调验证或轮询补偿
- 同步日志与错误处理

### 阶段 5：稳定性补强

- 幂等处理
- 重试机制
- channel 续订
- 冲突处理流程
- 可观测性与告警

## 18. 建议里程碑

### 第 1 周

- 完成 PRD 和技术设计
- 初始化项目仓库
- 建表与基础 API

### 第 2 周

- 完成首页和周视图
- 完成任务与事件联动

### 第 3 周

- 完成 Google 接入
- 跑通首次全量同步和回写

### 第 4 周

- 完成钉钉接入验证
- 跑通同步链路
- 完成冲突中心和日志页

## 19. 第一版成功标准

- 用户可登录并创建任务
- 用户可把任务安排到日历时间块中
- 工作台可展示一周内任务和会议
- Google Calendar 可完成双向同步
- 钉钉日历至少完成稳定读写，同步能力可验证
- 同步失败可追踪
- 冲突可发现、可查看、可处理

## 20. 下一步实施建议

建议立即进入以下动作：

1. 先确定钉钉应用类型是企业内部应用还是第三方企业应用
2. 先以 Google Calendar 作为第一条完整打通链路
3. 按本方案先落数据库和统一事件模型
4. 完成工作台静态页面和任务 CRUD
5. 再补 webhook、同步队列、冲突中心

如果要直接开工，下一步建议输出两份补充文档：

- `数据库 ER 图`
- `接口字段定义文档`

