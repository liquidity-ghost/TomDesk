import Link from 'next/link';
import { ArrowRight, BookOpen, PenTool } from 'lucide-react';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { STUDENTS, STUDENT_META } from '@/types/board';

export default function HubHomePage() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-desk-canvas px-6 py-16">
      <div
        aria-hidden="true"
        className="bg-desk-dots pointer-events-none absolute inset-0 opacity-85"
      />

      <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
        <ThemeToggle />
      </div>

      <div className="relative z-10 w-full max-w-4xl">
        <div className="mb-10 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-desk-primary text-desk-primary-fg shadow-lg">
            <PenTool className="h-6 w-6" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-desk-heading sm:text-4xl">
            Hey! Whose notebook are we opening today?
          </h1>
          <p className="mx-auto mt-2.5 max-w-xl text-sm text-desk-muted sm:text-base">
            Pick your space below to look over past lessons or work together live.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-3">
          {STUDENTS.map((name) => {
            const meta = STUDENT_META[name];
            return (
              <Link
                key={name}
                href={meta.href}
                className="group flex flex-col justify-between rounded-2xl border border-desk-border bg-desk-surface p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-desk-accent hover:shadow-xl"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-desk-accent-soft text-sm font-bold text-desk-accent">
                      {meta.initial}
                    </span>
                    <BookOpen className="h-4 w-4 text-desk-muted transition-colors group-hover:text-desk-accent" />
                  </div>

                  <h2 className="mt-5 text-2xl font-bold text-desk-heading">
                    {meta.name}
                  </h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-desk-muted">
                    {meta.description}
                  </p>
                </div>

                <div className="mt-6 flex items-center justify-between border-t border-desk-border pt-4 text-sm font-semibold text-desk-heading transition-colors group-hover:text-desk-accent">
                  <span>Open Notebook</span>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </main>
  );
}
