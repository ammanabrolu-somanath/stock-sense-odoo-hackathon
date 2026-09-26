import { Outlet, useLocation } from 'react-router'
import { motion } from 'motion/react'

import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { useLiveUpdates } from '@/hooks/use-live-updates'
import { AppSidebar } from '../AppSidebar'
import { Topbar } from '../Topbar'

export function AppLayout() {
  const live = useLiveUpdates()
  const { pathname } = useLocation()
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-w-0">
        <Topbar live={live} />
        <main id="main" className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-6 sm:px-6">
          {/* 120 ms fade between pages; MotionConfig turns it off for reduced-motion users. */}
          <motion.div key={pathname} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.12, ease: 'easeOut' }}>
            <Outlet />
          </motion.div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
