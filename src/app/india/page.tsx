import { Suspense } from 'react';
import { StudentWorkspace } from '@/components/workspace/StudentWorkspace';

export default function IndiaWorkspacePage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-desk-canvas text-sm font-medium text-desk-muted">
          Opening India&apos;s notebook...
        </div>
      }
    >
      <StudentWorkspace student="India" />
    </Suspense>
  );
}
