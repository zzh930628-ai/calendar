import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { signInWithGoogle, signInWithMagicLink } from './actions';
import { LoginForm } from './login-form';

export const dynamic = 'force-dynamic';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect('/');
  }

  const params = await searchParams;

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-head">
          <p className="eyebrow">Supabase Auth</p>
          <h1>登录任务安排工作台</h1>
          <p>先完成登录，后续首页会按当前用户读取任务、日程和日历连接信息。</p>
        </div>

        {params.message ? <div className="auth-message">{params.message}</div> : null}

        <LoginForm magicLinkAction={signInWithMagicLink} googleAction={signInWithGoogle} />

        <div className="auth-footnote">
          <p>如果你要用 Google 登录，请先在 Supabase Auth 里启用 Google Provider。</p>
          <Link href="/">返回首页</Link>
        </div>
      </section>
    </main>
  );
}
