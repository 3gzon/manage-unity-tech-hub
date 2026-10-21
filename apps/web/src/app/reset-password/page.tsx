'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { SetPasswordForm } from '@/components/auth/set-password-form';
import { resetPasswordRequest } from '@/lib/auth/auth-api';

function ResetPasswordForm() {
  const router = useRouter();
  const token = useSearchParams().get('token') ?? '';

  return (
    <SetPasswordForm
      title="Choose a new password"
      description="This replaces the password for your Unity Tech Hub account."
      token={token}
      submitLabel="Save password"
      onSubmit={async (password) => {
        await resetPasswordRequest(token, password);
        router.replace('/login?reset=1');
      }}
    />
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
