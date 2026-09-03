'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/atoms/button';
import { AuthService } from '@/services/auth.service';

export function DashboardLayout({ children }: { children: React.ReactNode }): JSX.Element {
  const router = useRouter();

  async function handleLogout(): Promise<void> {
    await AuthService.Logout();
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Link href="/" className="text-lg font-semibold text-gray-900">
            Auto-Clip Generator
          </Link>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            Sign out
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
