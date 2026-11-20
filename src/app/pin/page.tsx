import { Suspense } from 'react';
import { PinGateForm } from '@/components/auth/PinGateForm';

export default function PinPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 px-4 py-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:24px_24px] opacity-60"
      />
      <div className="relative z-10 flex w-full justify-center">
        <Suspense
          fallback={
            <div className="h-80 w-full max-w-md animate-pulse rounded-2xl border border-slate-200 bg-white/80" />
          }
        >
          <PinGateForm />
        </Suspense>
      </div>
    </main>
  );
}
