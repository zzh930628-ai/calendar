'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createSupabaseServerClient } from '@/lib/supabase/server';

function getBaseUrl(headerList: Headers) {
  const forwardedHost = headerList.get('x-forwarded-host');
  const host = forwardedHost ?? headerList.get('host') ?? 'localhost:3000';
  const protocol = host.includes('localhost') ? 'http' : 'https';

  return `${protocol}://${host}`;
}

export async function signInWithMagicLink(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();

  if (!email) {
    redirect('/login?message=请输入邮箱地址');
  }

  const supabase = await createSupabaseServerClient();
  const headerList = await headers();
  const baseUrl = getBaseUrl(headerList);

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${baseUrl}/auth/callback`,
    },
  });

  if (error) {
    redirect(`/login?message=${encodeURIComponent(error.message)}`);
  }

  redirect('/login?message=魔法链接已发送，请去邮箱确认');
}

export async function signInWithGoogle() {
  const supabase = await createSupabaseServerClient();
  const headerList = await headers();
  const baseUrl = getBaseUrl(headerList);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${baseUrl}/auth/callback`,
    },
  });

  if (error || !data.url) {
    redirect(`/login?message=${encodeURIComponent(error?.message ?? 'Google 登录初始化失败')}`);
  }

  redirect(data.url);
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect('/');
}
