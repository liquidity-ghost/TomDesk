import Link from 'next/link';
import { ArrowRight, Layers, PenTool, Sparkles } from 'lucide-react';
import { STUDENTS, STUDENT_META } from '@/types/board';

export default function HubHomePage() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-slate-50 px-6 py-16">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:24px_24px] opacity-60"
      />

      <div className="relative z-10 w-full max-w-4xl">
        <div className="mb-10 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/25">
            <PenTool className="h-6 w-6" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            TomDesk Tutoring Hub
          </h1>
          <p className="mx-auto mt-2.5 max-w-xl text-sm text-slate-600 sm:text-base">
            Select a student workspace below to open saved boards, annotate PDFs
            side-by-side on lined or graph paper, and collaborate in real time.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-3">
          {STUDENTS.map((name) => {
            const meta = STUDENT_META[name];
            return (
              <Link
                key={name}
                href={meta.href}
                className={`group flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl ${meta.cardBorderHoverClass}`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span
                      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${meta.badgeBgClass} ${meta.badgeTextClass}`}
                    >
                      <span className={`h-2 w-2 rounded-full ${meta.dotClass}`} />
                      Student Workspace
                    </span>
                    <Layers className="h-4 w-4 text-slate-300 transition-colors group-hover:text-slate-500" />
                  </div>

                  <h2 className="mt-5 text-2xl font-bold text-slate-900">
                    {meta.name}
                  </h2>
                  <p className="mt-1.5 text-sm text-slate-500">
                    Open {meta.name}&apos;s live tutoring boards, uploaded PDFs, and
                    saved lessons.
                  </p>
                </div>

                <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4 text-sm font-semibold text-slate-700 group-hover:text-indigo-600">
                  <span>Enter {meta.href}</span>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </div>
              </Link>
            );
          })}
        </div>

        <div className="mt-8 flex items-center justify-center gap-2 text-xs text-slate-400">
          <Sparkles className="h-3.5 w-3.5" />
          <span>
            Supports Wacom / XPPen stylus pressure, side-by-side PDFs, and Area Snip
          </span>
        </div>
      </div>
    </main>
  );
}
