'use client'

import { useEffect, useMemo, useState } from 'react'
import { Ticket, CheckCircle2, Coins } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ZoneBadge } from '@/components/status-badges'
import { BookingSteps } from '@/components/booking-steps'
import { TossPayment } from '@/components/toss-payment'
import { WaitlistDialog } from '@/components/waitlist-dialog'
import { useApp } from '@/lib/store'
import { api } from '@/lib/api'
import { orderApi, OrderApiError } from '@/lib/order-api'
import { performanceApi, type RealTicket } from '@/lib/performance-api'
import { canWaitlistZone, formatKRW, formatDay, formatTime } from '@/lib/domain'
import type { Order, Performance, PerformanceSession, Zone } from '@/lib/types'

const STEP_LABELS = ['좌석 선택', '가격 선택', '결제']

interface ZoneRow {
  zone: Zone
  price: number
  remaining: number
}

function formatSelectedSeatLabel(label: string) {
  const parts = label.split('-')
  if (parts.length < 3) return label
  const [, row, col] = parts
  return `${row}행 ${col}열`
}

export function BookingDialog({
  open,
  onOpenChange,
  performance,
  session,
  zoneRows,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  performance: Performance
  session: PerformanceSession
  zoneRows: ZoneRow[]
}) {
  const { createOrder, userId, points, heldSeat, holdSeat, releaseSeat } = useApp()

  const heldSeatsForThisSession = useMemo<Record<Zone, string[]>>(() => {
    const empty: Record<Zone, string[]> = { VIP: [], R: [], S: [], A: [] }
    if (
      heldSeat &&
      heldSeat.performanceId === performance.id &&
      heldSeat.sessionId === session.id
    ) {
      empty[heldSeat.zone] = [heldSeat.seatId]
    }
    return empty
  }, [heldSeat, performance.id, session.id])

  const [step, setStep] = useState<'select' | 'price' | 'pay' | 'done'>('select')
  const [activeZone, setActiveZone] = useState<Zone | null>(null)
  const [selectedSeats, setSelectedSeats] = useState<Record<Zone, string[]>>(heldSeatsForThisSession)
  const [order, setOrder] = useState<Order | null>(null)
  const [waitlistOpen, setWaitlistOpen] = useState(false)
  const [waitlistPrefillZones, setWaitlistPrefillZones] = useState<Zone[]>([])
  const [pointsInput, setPointsInput] = useState('0')
  const [realOrder, setRealOrder] = useState<{ orderId: number; paymentId: number } | null>(null)
  const [selectedRealTicket, setSelectedRealTicket] = useState<{ ticketId: number; price: number } | null>(null)

  // performance-service/v2로 등록된 실제 공연은 숫자 ID를 그대로 쓴다(mock은 'p_xxx' 형태)
  const isRealPerformance = /^\d+$/.test(performance.id)

  const [realTickets, setRealTickets] = useState<RealTicket[]>([])
  const [realZonePrice, setRealZonePrice] = useState<number | null>(null)
  const [realTicketsLoading, setRealTicketsLoading] = useState(false)

  // real 공연은 좌석 배치도 자체를 POST /api/tickets/select/seat 결과(실제 발행된 티켓)로 그린다.
  useEffect(() => {
    if (!isRealPerformance || !activeZone) {
      setRealTickets([])
      setRealZonePrice(null)
      return
    }
    let cancelled = false
    setRealTicketsLoading(true)
    performanceApi
      .selectSeatZone(Number(performance.id), session.sessionNum, activeZone)
      .then((result) => {
        if (!cancelled) {
          setRealTickets(result.sessionZones)
          setRealZonePrice(result.price)
        }
      })
      .catch((e) => {
        if (!cancelled) {
          console.warn('실제 좌석 조회 실패:', e)
          setRealTickets([])
          setRealZonePrice(null)
        }
      })
      .finally(() => {
        if (!cancelled) setRealTicketsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [isRealPerformance, activeZone, performance.id, session.sessionNum])

  useEffect(() => {
    if (open) {
      setStep('select')
      setSelectedSeats(heldSeatsForThisSession)
      setOrder(null)
      setRealOrder(null)
      setSelectedRealTicket(null)
      setWaitlistOpen(false)
      setWaitlistPrefillZones([])
      setPointsInput('0')
      const preselectedZone = (Object.entries(heldSeatsForThisSession) as [Zone, string[]][]).find(
        ([, labels]) => labels.length > 0,
      )?.[0]
      const firstAvailable = preselectedZone ?? zoneRows.find((z) => z.remaining > 0)?.zone ?? null
      setActiveZone(firstAvailable)
    }
    // zoneRows는 의도적으로 deps에서 뺐다: 결제 성공 시 잔여석이 줄면서 zoneRows 참조가
    // 바뀌는데, 이걸 deps에 넣으면 다이얼로그가 열려 있는 동안(step==='done'이어도) 이 effect가
    // 다시 실행돼서 결제 완료 화면이 곧바로 좌석 선택 화면으로 리셋돼버린다. 다이얼로그가
    // "열릴 때"만 초기화하면 되므로 open만 감시한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const seatSelections = useMemo(
    () =>
      (Object.entries(selectedSeats) as [Zone, string[]][])
        .filter(([, labels]) => labels.length > 0)
        .map(([zone, labels]) => ({ zone, labels })),
    [selectedSeats],
  )

  const totalCount = seatSelections.reduce((sum, item) => sum + item.labels.length, 0)
  const total = seatSelections.reduce((sum, item) => {
    const row = zoneRows.find((z) => z.zone === item.zone)
    return sum + (row?.price ?? 0) * item.labels.length
  }, 0)

  const maxUsablePoints = Math.max(0, Math.min(points, total))
  const pointsUsed = Math.max(0, Math.min(Number(pointsInput) || 0, maxUsablePoints))
  const finalAmount = total - pointsUsed

  function handlePointsChange(raw: string) {
    const digitsOnly = raw.replace(/[^0-9]/g, '')
    const clamped = Math.min(Number(digitsOnly) || 0, maxUsablePoints)
    setPointsInput(String(clamped))
  }

  const hall = useMemo(() => api.getHall(performance.hallId), [performance.hallId])
  const inventory = useMemo(() => api.listInventory(session.id), [session.id, zoneRows])

  const seatMap = useMemo(() => {
    if (!activeZone || !hall) return []
    const occupied = new Set(inventory.find((i) => i.zone === activeZone)?.occupiedSeats ?? [])
    const realByPosition = new Map(realTickets.map((t) => [`${t.seatRow}-${t.seatNum}`, t]))
    const layout = hall.seatLayout[activeZone] ?? []
    const seats: Array<{
      id: string
      rowLabel: string
      col: number
      sold: boolean
      selected: boolean
      realTicket?: RealTicket
    }> = []

    for (const rowLayout of layout) {
      for (let colIndex = 0; colIndex < rowLayout.count; colIndex += 1) {
        const seatId = `${activeZone}-${rowLayout.row}-${colIndex + 1}`
        if (isRealPerformance) {
          // 실제 발행된 티켓(POST /api/tickets/select/seat) 기준으로만 판단 — 그 좌석에
          // 해당하는 티켓이 없거나 AVAILABLE이 아니면 매진 처리.
          const real = realByPosition.get(`${rowLayout.row}-${colIndex + 1}`)
          seats.push({
            id: seatId,
            rowLabel: rowLayout.row,
            col: colIndex + 1,
            sold: !real || real.ticketStatus !== 'AVAILABLE',
            selected: (selectedSeats[activeZone] ?? []).includes(seatId),
            realTicket: real,
          })
        } else {
          seats.push({
            id: seatId,
            rowLabel: rowLayout.row,
            col: colIndex + 1,
            sold: occupied.has(seatId),
            selected: (selectedSeats[activeZone] ?? []).includes(seatId),
          })
        }
      }
    }

    return seats
  }, [activeZone, hall, inventory, selectedSeats, isRealPerformance, realTickets])

  function selectZone(zone: Zone) {
    const target = zoneRows.find((z) => z.zone === zone)
    if (!target) return

    if (target.remaining <= 0) {
      if (!canWaitlistZone(performance, zone)) {
        toast.info('현재 공연은 VIP석과 S석만 대기 신청이 가능합니다.')
        return
      }
      setWaitlistPrefillZones([zone])
      setWaitlistOpen(true)
      onOpenChange(false)
      return
    }

    setActiveZone(zone)
  }

  function toggleSeat(zone: Zone, seatId: string, realTicket?: RealTicket) {
    const row = zoneRows.find((z) => z.zone === zone)
    const remaining = row?.remaining ?? 0
    if (!row || remaining <= 0) return

    const alreadySelected = (selectedSeats[zone] ?? []).includes(seatId)

    if (alreadySelected) {
      setSelectedSeats((prev) => ({ ...prev, [zone]: [] }))
      setSelectedRealTicket(null)
      releaseSeat()
      return
    }

    setSelectedSeats({
      VIP: [],
      R: [],
      S: [],
      A: [],
      [zone]: [seatId],
    })
    setSelectedRealTicket(
      realTicket && realZonePrice != null ? { ticketId: realTicket.ticketId, price: realZonePrice } : null,
    )
    holdSeat({ performanceId: performance.id, sessionId: session.id, zone, seatId })
  }

  function handlePay(method: string) {
    try {
      const selectedSeatPayload = seatSelections.map(({ zone, labels }) => ({ zone, seatLabels: labels }))
      const { order } = createOrder({
        buyerId: userId,
        performanceId: performance.id,
        sessionId: session.id,
        selections: selectedSeatPayload.map(({ zone, seatLabels }) => ({ zone, quantity: seatLabels.length })),
        selectedSeats: selectedSeatPayload,
        method,
        pointsUsed,
      })
      setOrder(order)
      setStep('done')
      releaseSeat()
      toast.success('결제가 완료되어 티켓이 발권되었습니다.')

      if (isRealPerformance && selectedRealTicket) {
        void syncRealOrder(selectedRealTicket)
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '결제에 실패했습니다.')
    }
  }

  // 실제 공연에 한해, 화면에서 고른 좌석의 실제 ticketId(좌석 선택 시 GET /api/tickets로 이미
  // 확보해둔 값)로 order-service에도 주문/결제를 남겨본다 — mock 예매와는 별개의 그림자 호출이라
  // 실패해도 화면 표시엔 영향 없음.
  async function syncRealOrder(ticket: { ticketId: number; price: number }) {
    try {
      const created = await orderApi.createOrder(ticket.ticketId)
      const paid = await orderApi.pay(created.orderId, ticket.price)
      const confirmed = await orderApi.confirm(paid.paymentId, paid.transactionKey)
      setRealOrder({ orderId: created.orderId, paymentId: confirmed.paymentId })
    } catch (e) {
      const message = e instanceof OrderApiError ? `${e.code} ${e.message}` : String(e)
      console.warn('실제 order-service 동기화 실패(화면 표시엔 영향 없음):', message)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        {step === 'select' && (
          <>
            <DialogHeader>
              <DialogTitle>좌석 선택</DialogTitle>
              <DialogDescription>
                {performance.title} · {session.sessionNum}회차{' '}
                {formatDay(session.performanceStartAt)} {formatTime(session.performanceStartAt)}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {zoneRows.map((z) => {
                  const soldOut = z.remaining <= 0
                  const isActive = activeZone === z.zone
                  return (
                    <button
                      key={z.zone}
                      type="button"
                      onClick={() => selectZone(z.zone)}
                      className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                        soldOut
                          ? 'border-destructive/40 bg-destructive/10 text-destructive'
                          : isActive
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border text-muted-foreground'
                      }`}
                    >
                      <ZoneBadge zone={z.zone} className="mr-2" />
                      {soldOut ? '매진 · 대기 신청' : `${z.remaining}석 남음`}
                    </button>
                  )
                })}
              </div>

              {activeZone && (
                <div className="rounded-xl border border-border bg-secondary/30 p-3">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{activeZone}석 좌석 배치도</p>
                      <p className="text-xs text-muted-foreground">
                        {isRealPerformance && realTicketsLoading
                          ? '실제 좌석 정보를 불러오는 중...'
                          : '무대 기준으로 좌석이 배치되어 있고, 한 번에 하나의 좌석만 선택할 수 있습니다.'}
                      </p>
                    </div>
                    <span className="text-sm font-medium text-primary">
                      {selectedSeats[activeZone].length > 0
                        ? `선택됨: ${formatSelectedSeatLabel(selectedSeats[activeZone][0])}`
                        : '선택된 좌석 없음'}
                    </span>
                  </div>

                  <div className="mb-3 flex justify-center">
                    <div className="rounded-full border border-dashed border-primary/40 bg-background/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                      Stage
                    </div>
                  </div>

                  <div className="space-y-2">
                    {(hall?.seatLayout[activeZone] ?? []).map((rowLayout) => {
                      const rowSeats = seatMap.filter((seat) => seat.rowLabel === rowLayout.row)
                      return (
                        <div key={rowLayout.row} className="flex items-center gap-2">
                          <span className="w-8 text-center text-xs font-semibold text-muted-foreground">{rowLayout.row}행</span>
                          <div
                            className="grid flex-1 gap-2"
                            style={{ gridTemplateColumns: `repeat(${rowLayout.count}, minmax(0, 1fr))` }}
                          >
                            {rowSeats.map((seat) => (
                              <button
                                key={seat.id}
                                type="button"
                                onClick={() => toggleSeat(activeZone, seat.id, seat.realTicket)}
                                className={`h-10 rounded-md border text-sm font-medium transition-colors ${
                                  seat.sold
                                    ? 'cursor-not-allowed border-muted bg-muted text-muted-foreground'
                                    : seat.selected
                                      ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                                      : 'border-border bg-background hover:border-primary/40 hover:bg-primary/5'
                                }`}
                                disabled={seat.sold}
                              >
                                {seat.col}
                              </button>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-lg border border-border bg-card p-3">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">선택한 좌석</span>
                <span className="font-semibold">총 {totalCount}석</span>
              </div>
              {seatSelections.length === 0 ? (
                <p className="text-sm text-muted-foreground">좌석을 선택해 주세요.</p>
              ) : (
                <div className="space-y-1 text-sm">
                  {seatSelections.map((item) => (
                    <div key={item.zone} className="flex items-center justify-between gap-2">
                      <span className="font-medium">{item.zone}석</span>
                      <span className="text-right text-muted-foreground">
                        {item.labels.map((label) => formatSelectedSeatLabel(label)).join(', ')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-border pt-3">
              <span className="text-sm text-muted-foreground">예상 결제금액</span>
              <span className="text-lg font-bold">{formatKRW(total)}</span>
            </div>

            <Button size="lg" className="w-full" disabled={totalCount === 0} onClick={() => setStep('price')}>
              좌석 선택 완료
            </Button>
          </>
        )}

        {step === 'price' && (
          <>
            <DialogHeader>
              <DialogTitle>가격 선택</DialogTitle>
              <DialogDescription>
                {totalCount}석 · {performance.title}
              </DialogDescription>
            </DialogHeader>
            <BookingSteps steps={STEP_LABELS} current={1} />

            <div className="space-y-2 rounded-lg border border-border bg-secondary/20 p-3 text-sm">
              <p className="font-medium">티켓 가격</p>
              {seatSelections.map((item) => {
                const row = zoneRows.find((z) => z.zone === item.zone)
                return (
                  <div key={item.zone} className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <ZoneBadge zone={item.zone} /> {item.labels.length}매
                    </span>
                    <span>{formatKRW((row?.price ?? 0) * item.labels.length)}</span>
                  </div>
                )
              })}
            </div>

            <div className="space-y-2 rounded-lg border border-border bg-secondary/20 p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 font-medium">
                  <Coins className="size-3.5 text-warning" />
                  포인트 사용
                </span>
                <span className="text-xs text-muted-foreground">잔여 포인트: {formatKRW(points)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  inputMode="numeric"
                  value={pointsInput}
                  onChange={(e) => handlePointsChange(e.target.value)}
                  disabled={maxUsablePoints <= 0}
                  className="text-right"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPointsInput(String(maxUsablePoints))}
                  disabled={maxUsablePoints <= 0}
                >
                  모두 사용
                </Button>
              </div>
            </div>

            <div className="space-y-1.5 rounded-lg border border-border bg-secondary/20 p-3 text-sm">
              <div className="flex items-center justify-between text-muted-foreground">
                <span>티켓금액</span>
                <span>{formatKRW(total)}</span>
              </div>
              {pointsUsed > 0 && (
                <div className="flex items-center justify-between text-warning">
                  <span>포인트 사용</span>
                  <span>-{formatKRW(pointsUsed)}</span>
                </div>
              )}
              <div className="flex items-center justify-between border-t border-border pt-2">
                <span className="font-medium">총 결제금액</span>
                <span className="text-lg font-bold">{formatKRW(finalAmount)}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('select')}>
                이전
              </Button>
              <Button className="flex-1" size="lg" onClick={() => setStep('pay')}>
                다음
              </Button>
            </div>
          </>
        )}

        {step === 'pay' && (
          <>
            <DialogHeader>
              <DialogTitle>결제</DialogTitle>
              <DialogDescription>
                {totalCount}석 · {performance.title}
              </DialogDescription>
            </DialogHeader>
            <BookingSteps steps={STEP_LABELS} current={2} />
            <TossPayment amount={finalAmount} onApproved={handlePay} />
            <Button variant="ghost" size="sm" onClick={() => setStep('price')}>
              이전
            </Button>
          </>
        )}

        {step === 'done' && order && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="size-5 text-success" />
                예매 완료
              </DialogTitle>
              <DialogDescription>선택한 고정 좌석으로 티켓이 발권되었습니다.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 rounded-lg border border-border bg-secondary/40 p-4">
              <div className="flex items-center gap-2">
                <Ticket className="size-4 text-primary" />
                <p className="text-sm font-semibold">{performance.title}</p>
              </div>
              <p className="text-xs text-muted-foreground">
                {session.sessionNum}회차 · {formatDay(session.performanceStartAt)}{' '}
                {formatTime(session.performanceStartAt)}
              </p>
              <div className="space-y-1">
                {order.items.map((it) => (
                  <div key={it.zone} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5">
                      <ZoneBadge zone={it.zone} /> {it.quantity}매
                    </span>
                    <span className="text-muted-foreground">{it.seatLabels.join(', ')}</span>
                  </div>
                ))}
              </div>
              {!!order.pointsUsed && (
                <div className="flex items-center justify-between text-sm text-warning">
                  <span>포인트 사용</span>
                  <span>-{formatKRW(order.pointsUsed)}</span>
                </div>
              )}
              <div className="flex items-center justify-between border-t border-border pt-2 text-sm font-semibold">
                <span>결제금액</span>
                <span>{formatKRW(order.totalAmount - (order.pointsUsed ?? 0))}</span>
              </div>
            </div>
            {realOrder && (
              <p className="text-xs text-muted-foreground">
                실제 order-service 주문 #{realOrder.orderId} · 결제 #{realOrder.paymentId} 승인 완료
              </p>
            )}
            <Button className="w-full" onClick={() => onOpenChange(false)}>
              확인
            </Button>
          </>
        )}
      </DialogContent>
      <WaitlistDialog
        open={waitlistOpen}
        onOpenChange={(next) => {
          setWaitlistOpen(next)
          if (!next) {
            setWaitlistPrefillZones([])
          }
        }}
        performance={performance}
        session={session}
        zones={zoneRows
          .filter((z) => z.remaining <= 0 && canWaitlistZone(performance, z.zone))
          .map((z) => z.zone)}
        prefillZones={waitlistPrefillZones}
      />
    </Dialog>
  )
}
