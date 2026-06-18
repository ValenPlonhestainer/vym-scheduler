"use client"

import { usePathname } from 'next/navigation'

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const hasSidebar = pathname !== '/' && !pathname.startsWith('/admin')
  return (
    <main className={`min-h-screen bg-background${hasSidebar ? ' md:pl-52 pt-14 md:pt-0' : ''}`}>
      {children}
    </main>
  )
}
