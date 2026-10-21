'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { SetPasswordForm } from '@/components/auth/set-password-form';
import { confirmAccountRequest } from '@/lib/auth/auth-api';

function ConfirmAccountForm() {
  const router = useRouter();
  const token = useSearchParams().get('token') ?? '';

  return (
    <SetPasswordForm
      title="Confirm your account"
      description="Choose the password you will use to sign in. This confirms the instructor account."
      token={token}
      submitLabel="Confirm and save password"
      onSubmit={async (password) => {
        await confirmAccountRequest(token, password);
        router.replace('/login?confirmed=1');
      }}
    />
  );
}

export default function ConfirmAccountPage() {
  return (
    <Suspense fallback={null}>
      <ConfirmAccountForm />
    </Suspense>
  );
}
