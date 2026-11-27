import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/admin-auth'
import { AdminSidebar } from '@/components/admin/sidebar'
import { prisma } from '@/lib/prisma'

export const metadata: Metadata = {
  title: {
    default: 'Admin',
    template: '%s | VerifyChain Admin',
  },
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await requireAdmin()

  const alertCount = await prisma.alertLog.count({
    where: {
      resolved: false,
      severity: { in: ['HIGH_CONCERN', 'CRITICAL'] },
    },
  })

  // The admin console is always dark, whatever the visitor's theme setting.
  return (
    <div className="dark flex h-[100dvh] overflow-hidden bg-gray-950 text-gray-100 [color-scheme:dark]">
      <AdminSidebar
        userRole={session.user.role}
        userName={session.user.name ?? session.user.email ?? ''}
        alertCount={alertCount}
      />
      <main id="main" className="min-w-0 flex-1 overflow-y-auto pt-14 lg:pt-0">
        {children}
      </main>
    </div>
  )
}
