import { Suspense } from 'react';
import { PinGateForm } from '@/components/auth/PinGateForm';
import { ThemeToggle } from '@/components/theme/ThemeToggle';

export default function PinPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-desk-canvas px-4 py-12">
      <div
        aria-hidden="true"
        className="bg-desk-dots pointer-events-none absolute inset-0 opacity-85"
      />

      <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
        <ThemeToggle />
      </div>

      <div className="relative z-10 flex w-full justify-center">
        <Suspense
          fallback={
            <div className="h-80 w-full max-w-md animate-pulse rounded-2xl border border-desk-border bg-desk-surface/80" />
          }
        >
          <PinGateForm />
        </Suspense>
      </div>
    </main>
  );
}
