import styles from './page.module.css';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { signOut } from './login/actions';
import { createTask } from './actions/tasks';
import { TaskCreateForm } from './task-create-form';
import { LoginForm } from './login/login-form';
import { signInWithGoogleFromHome, signInWithMagicLinkFromHome } from './actions/auth-home';

export const dynamic = 'force-dynamic';

const navItems = ['工作总览', '任务管理', '项目管理', '日程安排', '标签分类', '冲突与提醒', '历史记录', '系统设置'];

type TaskRow = {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_at: string | null;
};

const fallbackStats = [
  { title: '今日待办', value: '7', meta: '较昨日 +2', icon: '📅', cardClass: styles.statGreen, iconClass: styles.iconGreen },
  { title: '进行中任务', value: '12', meta: '当前执行中', icon: '▶', cardClass: styles.statBlue, iconClass: styles.iconBlue },
  { title: '逾期任务', value: '2', meta: '需要优先处理', icon: '!', cardClass: styles.statOrange, iconClass: styles.iconOrange },
  { title: '时间冲突', value: '3', meta: '待调整同步', icon: '⚡', cardClass: styles.statRed, iconClass: styles.iconRed },
];

const fallbackTasks: TaskRow[] = [
  { id: '1', title: '客户沟通', status: 'IN_PROGRESS', priority: 'HIGH', due_at: '2026-11-11T11:00:00.000Z' },
  { id: '2', title: '方案评审', status: 'TODO', priority: 'MEDIUM', due_at: '2026-11-11T12:00:00.000Z' },
  { id: '3', title: '团队周会', status: 'SCHEDULED', priority: 'HIGH', due_at: '2026-11-11T15:00:00.000Z' },
];

function formatDueTime(value: string | null) {
  if (!value) {
    return '-';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function getStatusLabel(status: string) {
  switch (status) {
    case 'IN_PROGRESS':
      return { label: '进行中', className: styles.pillGreen };
    case 'DONE':
      return { label: '已完成', className: styles.pillGreen };
    case 'SCHEDULED':
      return { label: '已排期', className: styles.pillOrange };
    case 'OVERDUE':
      return { label: '已逾期', className: styles.pillOrange };
    default:
      return { label: '待开始', className: styles.pillBlue };
  }
}

async function loadDashboardTasks() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return {
        source: 'fallback' as const,
        sourceLabel: '当前未登录，无法读取你的任务数据',
        tasks: fallbackTasks,
        stats: fallbackStats,
        user: null,
      };
    }

    const { data, error } = await supabase
      .from('tasks')
      .select('id, title, status, priority, due_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      return {
        source: 'fallback' as const,
        sourceLabel: `Supabase 查询失败：${error.message}`,
        tasks: fallbackTasks,
        stats: fallbackStats,
        user,
      };
    }

    const tasks = (data ?? []) as TaskRow[];
    const now = new Date();
    const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(now);
    const todayCount = tasks.filter((task) => task.due_at && new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(new Date(task.due_at)) === today).length;
    const inProgressCount = tasks.filter((task) => task.status === 'IN_PROGRESS').length;
    const overdueCount = tasks.filter((task) => task.due_at && new Date(task.due_at) < now && task.status !== 'DONE').length;

    const stats = [
      { title: '今日待办', value: String(todayCount), meta: `Supabase 任务 ${tasks.length} 条`, icon: '📅', cardClass: styles.statGreen, iconClass: styles.iconGreen },
      { title: '进行中任务', value: String(inProgressCount), meta: '来自真实数据库', icon: '▶', cardClass: styles.statBlue, iconClass: styles.iconBlue },
      { title: '逾期任务', value: String(overdueCount), meta: '按截止时间计算', icon: '!', cardClass: styles.statOrange, iconClass: styles.iconOrange },
      { title: '时间冲突', value: '0', meta: '冲突检测待接入', icon: '⚡', cardClass: styles.statRed, iconClass: styles.iconRed },
    ];

    return {
      source: 'supabase' as const,
      sourceLabel: `Supabase 已连接，当前读取 ${tasks.length} 条任务`,
      tasks,
      stats,
        user,
    };
  } catch (error) {
    return {
      source: 'fallback' as const,
      sourceLabel: error instanceof Error ? `Supabase 初始化失败：${error.message}` : 'Supabase 初始化失败',
      tasks: fallbackTasks,
      stats: fallbackStats,
      user: null,
    };
  }
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const dashboard = await loadDashboardTasks();
  const params = await searchParams;

  if (!dashboard.user) {
    return (
      <main className={styles.publicPage}>
        <section className={styles.publicHero}>
          <div className={styles.publicIntro}>
            <div className={styles.publicBadge}>Google 登录已接入首页</div>
            <h1 className={styles.publicTitle}>任务安排工作台</h1>
            <p className={styles.publicDesc}>
              直接在首页登录，进入后即可查看你自己的任务、后续接入 Google Calendar 和钉钉日历。
            </p>

            <div className={styles.featureList}>
              <div className={styles.featureItem}>
                <strong>任务与时间统一管理</strong>
                <span className={styles.muted}>支持任务、日程、冲突提醒和后续双日历同步。</span>
              </div>
              <div className={styles.featureItem}>
                <strong>Supabase Auth</strong>
                <span className={styles.muted}>支持邮箱魔法链接和 Google 登录，两种方式都能从首页发起。</span>
              </div>
              <div className={styles.featureItem}>
                <strong>已准备好接真实数据</strong>
                <span className={styles.muted}>登录后首页会按当前用户读取 Supabase `tasks` 表。</span>
              </div>
            </div>
          </div>

          <div className={styles.publicCard}>
            <section className="auth-card">
              <div className="auth-head">
                <p className="eyebrow">从首页直接登录</p>
                <h1>开始使用你的工作台</h1>
                <p>推荐先用 Google 登录，后续接 Google Calendar 会更顺畅。</p>
              </div>

              {params.message ? <div className="auth-message">{params.message}</div> : null}

              <LoginForm
                magicLinkAction={signInWithMagicLinkFromHome}
                googleAction={signInWithGoogleFromHome}
              />
            </section>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.appShell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <div className={styles.brandLogo}>任</div>
          <div>任务管理</div>
        </div>
        <nav className={styles.nav}>
          {navItems.map((item, index) => (
            <div key={item} className={index === 1 ? styles.navItemActive : styles.navItem}>
              {item}
            </div>
          ))}
        </nav>
        <div className={styles.sidebarFoot}>让工作更有条理<br />把重要的事放到位</div>
      </aside>

      <section className={styles.content}>
        <div className={styles.workspace}>
          <section className={styles.topbar}>
            <div className={styles.headline}>
              <h1>任务安排工作台</h1>
              <p>事情再多，也能把重要事项安排清楚。</p>
            </div>
            <div className={styles.search}>搜索任务、项目、标签或负责人...</div>
            <div className={styles.topChip}>2026 年 11 月 11 日 周三</div>
            <div className={styles.profile}>
              <span>{dashboard.user.email ?? '已登录用户'}</span>
              <form action={signOut}>
                <button className={styles.ghostBtn} type="submit">退出</button>
              </form>
            </div>
          </section>

          <section className={styles.stats}>
            {dashboard.stats.map((item) => (
              <div key={item.title} className={`${styles.statCard} ${item.cardClass}`}>
                <div className={styles.statTitle}>
                  <div className={`${styles.statIcon} ${item.iconClass}`}>{item.icon}</div>
                  {item.title}
                </div>
                <div className={styles.statValue}>{item.value}</div>
                <div className={styles.statMeta}>{item.meta}</div>
              </div>
            ))}
          </section>

          <section className={styles.mainGrid}>
            <div className={styles.panel}>
              <div className={styles.panelHead}>
                <div>
                  <div className={styles.panelTitle}>本周日程</div>
                  <div className={styles.panelSubtitle}>2026 年 11 月 9 日 - 2026 年 11 月 15 日</div>
                </div>
                <div className={styles.panelActions}>
                  <div className={styles.ghostBtn}>今天</div>
                  <div className={styles.ghostBtn}>周视图</div>
                </div>
              </div>
              <div className={styles.sectionBody}>
                <div className={styles.placeholder}>
                  <div className={styles.placeholderCard}>
                    <strong>周视图日历区</strong>
                    <span className={styles.muted}>下一步将把静态原型中的周视图、拖拽事件块和冲突高亮迁移成组件。</span>
                  </div>
                  <div className={styles.placeholderCard}>
                    <strong>Google / 钉钉双日历筛选</strong>
                    <span className={styles.muted}>预留连接状态、来源筛选、同步异常提示位。</span>
                  </div>
                  <div className={styles.placeholderCard}>
                    <strong>Supabase 接入状态</strong>
                    <span className={styles.muted}>
                      {dashboard.sourceLabel}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.rightStack}>
              <div className={styles.panel}>
                <div className={styles.panelHead}>
                  <div>
                    <div className={styles.panelTitle}>月历</div>
                    <div className={styles.panelSubtitle}>当前选中 11 月 11 日</div>
                  </div>
                </div>
                <div className={styles.sectionBody}>
                  <div className={styles.placeholderCard}>
                    <strong>迷你月历</strong>
                    <span className={styles.muted}>后续接入日期切换和日程定位。</span>
                  </div>
                </div>
              </div>

              <div className={styles.panel}>
                <div className={styles.panelHead}>
                  <div>
                    <div className={styles.panelTitle}>今日时间线</div>
                    <div className={styles.panelSubtitle}>11 月 11 日 星期三</div>
                  </div>
                </div>
                <div className={styles.sectionBody}>
                  <div className={styles.placeholderCard}>
                    <strong>09:30 客户沟通</strong>
                    <span className={styles.muted}>来源：Google Calendar</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className={styles.bottomGrid}>
            <div className={styles.panel}>
              <div className={styles.panelHead}>
                <div>
                  <div className={styles.panelTitle}>今日任务清单</div>
                  <div className={styles.panelSubtitle}>平台任务与外部日历统一展示</div>
                </div>
              </div>
            {params.message ? <div className={styles.inlineMessage}>{params.message}</div> : null}
            <div className={styles.taskFormWrap}>
              <TaskCreateForm action={createTask} />
            </div>
              <div className={styles.sectionBody}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>任务标题</th>
                      <th>所属项目</th>
                      <th>负责人</th>
                      <th>截止时间</th>
                      <th>状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.tasks.length > 0 ? (
                      dashboard.tasks.map((task, index) => {
                        const status = getStatusLabel(task.status);

                        return (
                          <tr key={task.id}>
                            <td>{index + 1}</td>
                            <td>{task.title}</td>
                            <td>{dashboard.source === 'supabase' ? 'Supabase' : '演示项目'}</td>
                            <td>{dashboard.user.email ?? '当前用户'}</td>
                            <td>{formatDueTime(task.due_at)}</td>
                            <td><span className={`${styles.pill} ${status.className}`}>{status.label}</span></td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={6} className={styles.muted}>当前还没有任务数据，下一步可以插入一条测试任务。</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className={styles.rightStack}>
              <div className={styles.panel}>
                <div className={styles.panelHead}>
                  <div>
                    <div className={styles.panelTitle}>待处理提醒</div>
                    <div className={styles.panelSubtitle}>高影响事项优先展示</div>
                  </div>
                </div>
                <div className={styles.sectionBody}>
                  <div className={styles.placeholderCard}>
                    <strong>时间冲突 3 条</strong>
                    <span className={styles.muted}>下一步接入冲突中心和提醒动作。</span>
                  </div>
                </div>
              </div>

              <div className={styles.panel}>
                <div className={styles.panelHead}>
                  <div>
                    <div className={styles.panelTitle}>标签分类</div>
                    <div className={styles.panelSubtitle}>预留任务标签与颜色映射</div>
                  </div>
                </div>
                <div className={styles.sectionBody}>
                  <div className={styles.placeholderCard}>
                    <strong>客户相关 / 会议相关 / 文档整理</strong>
                    <span className={styles.muted}>后续补成可筛选的标签组件。</span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
