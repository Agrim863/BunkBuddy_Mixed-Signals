import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { MobileNav } from './MobileNav';
import { SearchModal } from './SearchModal';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-dvh min-h-0 overflow-hidden bg-[var(--bg-app)] text-[var(--text-main)]">
      <Sidebar />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar />
        <main className="min-h-0 flex-1 overflow-y-auto pb-24 lg:pb-10">
          <div className="mx-auto max-w-[1440px] p-5 sm:p-7 lg:p-9">
            {children}
          </div>
        </main>
      </div>
      <MobileNav />
      <SearchModal />
    </div>
  );
}
