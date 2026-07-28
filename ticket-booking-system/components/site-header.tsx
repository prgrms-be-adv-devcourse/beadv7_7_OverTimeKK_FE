'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Ticket, Bell, Coins } from 'lucide-react'
import { api } from '@/lib/api'
import { useApp } from '@/lib/store'
import { formatKRW, formatDay, formatTime } from '@/lib/domain'
import { cn } from '@/lib/utils'
import { useMyStandby } from '@/lib/use-standby'
import { STANDBY_USER_ID } from '@/lib/standby-api'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'

const buyerNav = [
  { href: '/', label: '공연 예매' },
  { href: '/waitlist', label: '내 대기 신청' },
  { href: '/mypage', label: '마이페이지' },
]

const sellerNav = [
  { href: '/', label: '공연 둘러보기' },
  { href: '/seller', label: '공연 관리' },
  { href: '/seller/mypage', label: '판매자 마이페이지' },
]

export function SiteHeader() {
  const { role, setRole, userId, userName, points } = useApp()
  const pathname = usePathname()
  const router = useRouter()
  const nav = role === 'BUYER' ? buyerNav : sellerNav

  const { entries } = useMyStandby(userId, STANDBY_USER_ID)
  const offeredEntries =
    role === 'BUYER'
      ? entries
          .filter((e) => e.zoneRanks.some((z) => z.isHeld))
          .map((e) => {
            const heldZone = e.zoneRanks.find((z) => z.isHeld)?.zone
            const performance = api.getPerformance(e.record.performanceId)
            const session = api
              .listSessions(e.record.performanceId)
              .find((s) => s.id === e.record.sessionId)
            return { standbyId: e.record.standbyId, heldZone, performance, session }
          })
      : []
  const offeredCount = offeredEntries.length

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Ticket className="size-4.5" />
          </span>
          <span className="text-lg font-bold tracking-tight">
            Re<span className="text-primary">Seat</span>
          </span>
        </Link>

        <nav className="ml-4 hidden items-center gap-1 md:flex">
          {nav.map((item) => {
            const active =
              item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'relative rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {item.label}
                {item.href === '/waitlist' && offeredCount > 0 && (
                  <span className="absolute -top-0.5 right-0 flex size-2 rounded-full bg-warning" />
                )}
              </Link>
            )
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {role === 'BUYER' && (
            <DropdownMenu>
              <DropdownMenuTrigger
                className="relative hidden rounded-md p-2 text-muted-foreground outline-none transition-colors hover:text-foreground data-popup-open:text-foreground sm:inline-flex"
                aria-label="대기 알림"
              >
                <Bell className="size-4.5" />
                {offeredCount > 0 && (
                  <Badge className="absolute -top-1 -right-1 size-4 min-w-4 rounded-full px-0 tabular-nums">
                    {offeredCount}
                  </Badge>
                )}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <p className="px-1.5 py-1 text-xs font-medium text-muted-foreground">알림</p>
                <DropdownMenuSeparator />
                {offeredEntries.length === 0 ? (
                  <p className="px-1.5 py-4 text-center text-sm text-muted-foreground">
                    새로운 알림이 없습니다.
                  </p>
                ) : (
                  offeredEntries.map(({ standbyId, heldZone, performance, session }) => (
                    <DropdownMenuItem
                      key={standbyId}
                      className="flex-col items-start gap-0.5 py-2"
                      onClick={() => router.push('/waitlist')}
                    >
                      <span className="font-medium text-foreground">
                        {performance?.title} {heldZone}석 취소표 매칭 성공! 확인해보세요
                      </span>
                      {session && (
                        <span className="text-xs text-muted-foreground">
                          {session.sessionNum}회차 · {formatDay(session.performanceStartAt)}{' '}
                          {formatTime(session.performanceStartAt)}
                        </span>
                      )}
                    </DropdownMenuItem>
                  ))
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push('/waitlist')} className="justify-center text-primary">
                  내 대기 신청 바로가기
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <div className="hidden items-center gap-1.5 rounded-md bg-secondary px-2.5 py-1.5 text-sm font-medium sm:flex">
            <Coins className="size-4 text-warning" />
            <span className="tabular-nums">{formatKRW(points)}</span>
          </div>

          <div className="flex items-center rounded-lg border border-border p-0.5">
            <button
              type="button"
              onClick={() => setRole('BUYER')}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                role === 'BUYER'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              구매자
            </button>
            <button
              type="button"
              onClick={() => setRole('SELLER')}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                role === 'SELLER'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              판매자
            </button>
          </div>
        </div>
      </div>

      {/* 모바일 네비 */}
      <nav className="flex items-center gap-1 overflow-x-auto border-t border-border px-3 py-1.5 md:hidden">
        {nav.map((item) => {
          const active =
            item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                active ? 'bg-secondary text-foreground' : 'text-muted-foreground',
              )}
            >
              {item.label}
            </Link>
          )
        })}
        <span className="ml-auto hidden items-center gap-1 text-xs text-muted-foreground xs:flex">
          {userName}
        </span>
      </nav>
    </header>
  )
}
