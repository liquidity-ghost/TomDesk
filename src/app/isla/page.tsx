import { Suspense } from 'react';
import { StudentWorkspace } from '@/components/workspace/StudentWorkspace';

export default function IslaWorkspacePage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-[#eef2f7] text-sm font-medium text-slate-500">
          Loading Isla&apos;s workspace...
        </div>
      }
    >
      <StudentWorkspace student="Isla" />
    </Suspense>
  );
}
