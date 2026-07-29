'use client'

import { useEffect, useMemo, useState } from 'react'
import { Users, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ZoneBadge } from '@/components/status-badges'
import { Countdown } from '@/components/countdown'
import { BookingDialog } from '@/components/booking-dialog'
import { WaitlistDialog } from '@/components/waitlist-dialog'
import { api } from '@/lib/api'
import { performanceApi } from '@/lib/performance-api'
import { useApp } from '@/lib/store'
import { formatKRW, formatDay, formatTime, parseDateTime, NOW } from '@/lib/domain'
import { cn } from '@/lib/utils'
import type { Performance, PerformanceSession, Zone } from '@/lib/types'

export function BookingPanel({ performance }: { performance: Performance }) {
  const { version, role } = useApp()
  void version

  // performance-service/v2로 등록된 실제 공연은 숫자 ID를 그대로 쓴다(mock은 'p_xxx' 형태)
  const isRealPerformance = /^\d+$/.test(performance.id)

  const sessions = useMemo(
    () => api.listSessions(performance.id),
    [performance.id, version],
  )
  const prices = useMemo(
    () => api.listZonePrices(performance.id),
    [performance.id, version],
  )

  const [selectedSessionId, setSelectedSessionId] = useState(sessions[0]?.id ?? '')
  const [bookingOpen, setBookingOpen] = useState(false)
  const [waitlistOpen, setWaitlistOpen] = useState(false)

  const opened = api.ticketOpened(performance)
  const openAt = parseDateTime(performance.ticketOpenAt).getTime()
  const cancelled = performance.status === 'CANCELLED'
  const ended = performance.status === 'ENDED'

  const selectedSession =
    sessions.find((s) => s.id === selectedSessionId) ?? sessions[0]

  const inventory = useMemo(() => {
    if (!selectedSession) return []
    return api.listInventory(selectedSession.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSession?.id, version])

  // real 공연은 잔여석도 mock 재고가 아니라 POST /api/tickets/select/seat로 구역별 실제
  // AVAILABLE 티켓 수를 세어서 계산한다 — mock 재고는 시드값 고정이라 실제 구매/취소가
  // 반영되지 않는다. null이면 아직 조회 전(로딩 중)이라는 뜻.
  const [realRemaining, setRealRemaining] = useState<Record<string, number> | null>(null)

  useEffect(() => {
    if (!isRealPerformance || !selectedSession) {
      setRealRemaining(null)
      return
    }
    let cancelled = false
    setRealRemaining(null)
    Promise.all(
      prices.map((price) =>
        performanceApi
          .selectSeatZone(Number(performance.id), selectedSession.sessionNum, price.zone)
          .then(
            (result) =>
              [price.zone, result.sessionZones.filter((t) => t.ticketStatus === 'AVAILABLE').length] as const,
          )
          .catch(() => [price.zone, 0] as const),
      ),
    ).then((entries) => {
      if (!cancelled) setRealRemaining(Object.fromEntries(entries))
    })
    return () => {
      cancelled = true
    }
    // bookingOpen도 deps에 넣는다: 결제 시 mock createOrder()가 version을 즉시 올리지만
    // 실제 order-service 동기화(syncRealOrder)는 그 뒤에 비동기로 끝나서 version 트리거만으론
    // 아직 최신 상태가 반영되기 전 시점을 조회하게 된다 — 다이얼로그를 닫는 시점(그때는 실제
    // 동기화가 끝나 있음)에 한 번 더 조회해서 따라잡는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRealPerformance, selectedSession?.sessionNum, performance.id, version, bookingOpen])

  const realRemainingLoading = isRealPerformance && realRemaining === null

  const zoneRows = prices
    .slice()
    .sort((a, b) => b.price - a.price)
    .map((price) => {
      if (isRealPerformance) {
        const remaining = realRemaining?.[price.zone] ?? 0
        return { zone: price.zone as Zone, price: price.price, remaining, total: remaining }
      }
      const inv = inventory.find((i) => i.zone === price.zone)
      const remaining = inv ? inv.total - inv.sold : 0
      return { zone: price.zone as Zone, price: price.price, remaining, total: inv?.total ?? 0 }
    })

  const allSoldOut = !realRemainingLoading && zoneRows.length > 0 && zoneRows.every((z) => z.remaining <= 0)

  if (cancelled) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
        <p className="font-semibold text-destructive">취소된 공연입니다</p>
        <p className="mt-1 text-sm text-muted-foreground">
          판매자 사정으로 취소되어 모든 예매가 100% 환불되었습니다.
        </p>
      </div>
    )
  }

  if (ended) {
    return (
      <div className="rounded-xl border border-border bg-muted/40 p-6 text-center">
        <p className="font-semibold">종료된 공연입니다</p>
        <p className="mt-1 text-sm text-muted-foreground">관람하신 분께는 익일 1% 포인트가 적립됩니다.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5 rounded-xl border border-border bg-card p-5">
      {!opened && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-center">
          <p className="text-sm font-medium text-muted-foreground">티켓 오픈까지</p>
          <Countdown target={openAt} className="mt-2 flex justify-center" />
          <p className="mt-2 text-xs text-muted-foreground">
            {formatDay(performance.ticketOpenAt)} {formatTime(performance.ticketOpenAt)} 오픈
          </p>
        </div>
      )}

      {/* 회차 선택 */}
      <div>
        <p className="mb-2 text-sm font-semibold">회차 선택</p>
        <div className="grid gap-2">
          {sessions.map((s: PerformanceSession) => {
            const past = parseDateTime(s.performanceStartAt).getTime() <= NOW.getTime()
            const active = s.id === selectedSessionId
            return (
              <button
                key={s.id}
                type="button"
                disabled={past}
                onClick={() => setSelectedSessionId(s.id)}
                className={cn(
                  'flex items-center justify-between rounded-lg border px-3 py-2.5 text-left transition-colors',
                  active
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/40',
                  past && 'cursor-not-allowed opacity-50',
                )}
              >
                <div>
                  <p className="text-sm font-medium">
                    {s.sessionNum}회차 · {formatDay(s.performanceStartAt)}{' '}
                    {formatTime(s.performanceStartAt)}
                  </p>
                  <p className="text-xs text-muted-foreground">출연: {s.actor}</p>
                </div>
                {active && <ChevronRight className="size-4 text-primary" />}
              </button>
            )
          })}
        </div>
      </div>

      {/* 좌석 구역/가격 */}
      <div>
        <p className="mb-2 text-sm font-semibold">좌석 등급 · 잔여석</p>
        <div className="space-y-1.5">
          {zoneRows.map((z) => (
            <div
              key={z.zone}
              className="flex items-center justify-between rounded-lg bg-secondary/60 px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <ZoneBadge zone={z.zone} />
                <span className="text-sm font-medium">{formatKRW(z.price)}</span>
              </div>
              <span
                className={cn(
                  'flex items-center gap-1 text-xs font-medium',
                  realRemainingLoading
                    ? 'text-muted-foreground'
                    : z.remaining <= 0
                      ? 'text-destructive'
                      : z.remaining <= 5
                        ? 'text-warning'
                        : 'text-muted-foreground',
                )}
              >
                <Users className="size-3.5" />
                {realRemainingLoading ? '잔여석 확인 중...' : z.remaining <= 0 ? '매진' : `잔여 ${z.remaining}석`}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 액션 */}
      <div className="space-y-2">
        {!opened ? (
          <Button className="w-full" size="lg" disabled>
            티켓 오픈 대기 중
          </Button>
        ) : realRemainingLoading ? (
          <Button className="w-full" size="lg" disabled>
            잔여석 확인 중...
          </Button>
        ) : allSoldOut ? (
          <>
            <Button
              className="w-full"
              size="lg"
              variant="secondary"
              onClick={() => setWaitlistOpen(true)}
              disabled={role !== 'BUYER'}
            >
              취소표 대기 신청
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              전 구역 매진 · 원하는 구역을 최대 3개까지 선택해 대기하세요
            </p>
          </>
        ) : (
          <>
            <Button
              className="w-full"
              size="lg"
              onClick={() => setBookingOpen(true)}
              disabled={role !== 'BUYER'}
            >
              예매하기
            </Button>
            {role !== 'BUYER' && (
              <p className="text-center text-xs text-muted-foreground">
                구매자로 전환하면 예매할 수 있습니다
              </p>
            )}
          </>
        )}
      </div>

      {selectedSession && (
        <>
          <BookingDialog
            open={bookingOpen}
            onOpenChange={setBookingOpen}
            performance={performance}
            session={selectedSession}
            zoneRows={zoneRows}
          />
          <WaitlistDialog
            open={waitlistOpen}
            onOpenChange={setWaitlistOpen}
            performance={performance}
            session={selectedSession}
            zones={zoneRows.map((z) => z.zone)}
          />
        </>
      )}
    </div>
  )
}
