'use client';

import { useFormStatus } from 'react-dom';

function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending}>
      {pending ? '处理中...' : children}
    </button>
  );
}

export function LoginForm({
  magicLinkAction,
  googleAction,
}: {
  magicLinkAction: (formData: FormData) => Promise<void>;
  googleAction: () => Promise<void>;
}) {
  return (
    <>
      <form action={magicLinkAction}>
        <div className="field">
          <label htmlFor="email">邮箱</label>
          <input id="email" name="email" type="email" placeholder="you@example.com" required />
        </div>
        <SubmitButton>发送魔法链接</SubmitButton>
      </form>

      <form action={googleAction}>
        <SubmitButton>使用 Google 登录</SubmitButton>
      </form>
    </>
  );
}
