import { AUTH_SETUP_GUIDANCE } from '@/lib/auth-configuration';

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className='flex min-h-svh items-center justify-center p-6'>
      <section className='max-w-lg rounded-xl border p-8'>
        <h1 className='text-xl font-semibold'>Sign-in unavailable</h1>
        <p className='mt-3'>
          {error === 'AuthSetupRequired'
            ? AUTH_SETUP_GUIDANCE
            : 'Sign-in could not complete. Try again, or contact your app administrator.'}
        </p>
      </section>
    </main>
  );
}
