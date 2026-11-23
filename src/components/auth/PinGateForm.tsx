'use client';

import { useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, Lock, ArrowRight, HeartHandshake, Loader2 } from 'lucide-react';
import { getSafeRedirectPath, cn } from '@/lib/utils';

export function PinGateForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [shake, setShake] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pin.trim() || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });

      const data = (await res.json()) as { ok?: boolean; error?: string };

      if (!res.ok || !data.ok) {
        setError(data.error ?? "That passcode didn't match — please try again.");
        setShake(true);
        window.setTimeout(() => setShake(false), 400);
        setSubmitting(false);
        return;
      }

      const nextPath = getSafeRedirectPath(searchParams.get('next'));
      router.replace(nextPath);
      router.refresh();
    } catch {
      setError('Could not connect right now. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <div
      className={cn(
        'w-full max-w-md rounded-2xl border border-desk-border bg-desk-surface/95 p-8 shadow-xl backdrop-blur-md',
        shake && 'animate-shake'
      )}
    >
      <div className="mb-6 flex flex-col items-center text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-desk-primary text-desk-primary-fg shadow-lg">
          <Lock className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-desk-heading">
          Tom&apos;s Study Desk
        </h1>
        <p className="mt-1.5 text-sm text-desk-muted">
          Welcome! Enter our passcode to jump into today&apos;s session.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="hub-pin-input"
            className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-desk-muted"
          >
            Passcode
          </label>
          <div className="relative">
            <input
              id="hub-pin-input"
              type={showPin ? 'text' : 'password'}
              inputMode="numeric"
              autoComplete="current-password"
              autoFocus
              value={pin}
              onChange={(e) => {
                setPin(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Enter passcode"
              className={cn(
                'w-full rounded-xl border bg-desk-surface-muted px-4 py-3 pr-11 text-base font-medium tracking-widest text-desk-body placeholder:font-normal placeholder:tracking-normal placeholder:text-desk-muted/70 focus:bg-desk-surface focus:outline-none focus:ring-2',
                error
                  ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/20'
                  : 'border-desk-border focus:border-desk-primary focus:ring-desk-primary/20'
              )}
            />
            <button
              type="button"
              onClick={() => setShowPin((prev) => !prev)}
              aria-label={showPin ? 'Hide passcode' : 'Show passcode'}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-desk-muted transition-colors hover:bg-desk-hover hover:text-desk-heading"
            >
              {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-xl border border-rose-300 bg-rose-50 px-3.5 py-2.5 text-sm font-medium text-rose-700 dark:border-rose-500/40 dark:bg-rose-950/60 dark:text-rose-200"
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={!pin.trim() || submitting}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-desk-primary px-4 py-3 text-sm font-semibold text-desk-primary-fg shadow-md transition-all hover:bg-desk-primary-hover focus:outline-none focus:ring-2 focus:ring-desk-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Opening...
            </>
          ) : (
            <>
              Let&apos;s Go
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </form>

      <div className="mt-6 flex items-center justify-center gap-2 border-t border-desk-border pt-4 text-xs text-desk-muted">
        <HeartHandshake className="h-4 w-4 shrink-0 text-desk-accent" />
        <span>We&apos;ll remember this device so you only have to enter this once.</span>
      </div>
    </div>
  );
}
