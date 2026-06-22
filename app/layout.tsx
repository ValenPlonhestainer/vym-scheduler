import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/toaster'
import { Navigation } from '@/components/navigation'
import { LayoutWrapper } from '@/components/layout-wrapper'
import { ThemeProvider } from '@/components/theme-provider'
import { SessionGuard } from '@/components/session-guard'
import { UpdateDialog } from '@/components/update-dialog'
import { Sugerencias } from '@/components/sugerencias'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'VyM Scheduler',
  description: 'Programa semanal Vida y Ministerio Cristianos',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        {/* Evita flash al cargar — lee localStorage antes de que React hidrate */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){var t=localStorage.getItem('theme');if(t==='dark')document.documentElement.classList.add('dark');})();` }} />
      </head>
      <body className={inter.className}>
        <ThemeProvider>
          <Navigation />
          <LayoutWrapper>{children}</LayoutWrapper>
          <Toaster />
          <SessionGuard />
          <UpdateDialog />
          <Sugerencias />
        </ThemeProvider>
      </body>
    </html>
  )
}
