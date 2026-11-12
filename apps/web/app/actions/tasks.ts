'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';

function normalizeDueAt(value: FormDataEntryValue | null) {
  const raw = String(value ?? '').trim();

  if (!raw) {
    return null;
  }

  const date = new Date(raw);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

export async function createTask(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?message=请先登录后再创建任务');
  }

  const title = String(formData.get('title') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim();
  const priority = String(formData.get('priority') ?? 'MEDIUM').trim().toUpperCase();
  const dueAt = normalizeDueAt(formData.get('dueAt'));

  if (!title) {
    redirect('/?message=任务标题不能为空');
  }

  const { error } = await supabase.from('tasks').insert({
    user_id: user.id,
    title,
    description: description || null,
    priority,
    status: 'TODO',
    source: 'local',
    due_at: dueAt,
  });

  if (error) {
    redirect(`/?message=${encodeURIComponent(`任务创建失败：${error.message}`)}`);
  }

  revalidatePath('/');
  redirect('/?message=任务创建成功');
}
