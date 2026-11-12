'use client';

import { useFormStatus } from 'react-dom';
import styles from './page.module.css';

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button className={styles.taskFormSubmit} type="submit" disabled={pending}>
      {pending ? '创建中...' : '创建任务'}
    </button>
  );
}

export function TaskCreateForm({
  action,
}: {
  action: (formData: FormData) => Promise<void>;
}) {
  return (
    <form action={action} className={styles.taskForm}>
      <div className={styles.taskFormGrid}>
        <label className={styles.taskField}>
          <span>任务标题</span>
          <input name="title" type="text" placeholder="例如：整理客户周报" required />
        </label>

        <label className={styles.taskField}>
          <span>优先级</span>
          <select name="priority" defaultValue="MEDIUM">
            <option value="LOW">低</option>
            <option value="MEDIUM">中</option>
            <option value="HIGH">高</option>
            <option value="URGENT">紧急</option>
          </select>
        </label>

        <label className={`${styles.taskField} ${styles.taskFieldWide}`}>
          <span>任务说明</span>
          <textarea name="description" rows={3} placeholder="补充任务背景、输出要求或备注" />
        </label>

        <label className={styles.taskField}>
          <span>截止时间</span>
          <input name="dueAt" type="datetime-local" />
        </label>
      </div>

      <div className={styles.taskFormActions}>
        <span className={styles.taskFormHint}>创建后会直接写入 Supabase `tasks` 表，并刷新首页列表。</span>
        <SubmitButton />
      </div>
    </form>
  );
}
