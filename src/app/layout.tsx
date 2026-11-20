import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TomDesk — Collaborative Tutoring Whiteboard',
  description:
    'High-performance real-time collaborative tutoring whiteboard for Isla, India, and Ivy.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-slate-50 font-sans text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
