'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, Coins } from 'lucide-react'
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
import { RealTossPayment } from '@/components/real-toss-payment'
import { WaitlistDialog } from '@/components/waitlist-dialog'
import { useApp } from '@/lib/store'
import { orderApi, OrderApiError } from '@/lib/order-api'
import { performanceApi, type RealTicket } from '@/lib/performance-api'
import { writePendingPaymentLedger } from '@/lib/pending-payment'
import { canWaitlistZone, formatKRW, formatDay, formatTime } from '@/lib/domain'
import type { Performance, PerformanceSession, Zone } from '@/lib/types'

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
  const { points, heldSeat, holdSeat, releaseSeat, authUser } = useApp()

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

  const [step, setStep] = useState<'select' | 'price' | 'pay'>('select')
  const [activeZone, setActiveZone] = useState<Zone | null>(null)
  const [selectedSeats, setSelectedSeats] = useState<Record<Zone, string[]>>(heldSeatsForThisSession)
  const [waitlistOpen, setWaitlistOpen] = useState(false)
  const [waitlistPrefillZones, setWaitlistPrefillZones] = useState<Zone[]>([])
  const [pointsInput, setPointsInput] = useState('0')
  const [selectedRealTicket, setSelectedRealTicket] = useState<{ ticketId: number; price: number } | null>(null)
  const [pendingPayment, setPendingPayment] = useState<{
    paymentId: number
    tossOrderId: string
    amount: number
  } | null>(null)
  const [pendingPaymentError, setPendingPaymentError] = useState<string | null>(null)

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
      setPendingPayment(null)
      setPendingPaymentError(null)
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
    // 바뀌는데, 이걸 deps에 넣으면 다이얼로그가 열려 있는 동안(step==='pay'여도) 이 effect가
    // 다시 실행돼서 결제 진행 화면이 곧바로 좌석 선택 화면으로 리셋돼버린다. 다이얼로그가
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

  // 좌석 배치도는 hall의 정적 배치(mock)가 아니라, 그 회차·구역에 실제 발행된 티켓
  // (realTickets, seatRow/seatNum 포함)을 기준으로 그린다 — venue/hall 쪽엔 좌석 하나하나의
  // 배치를 조회하는 API가 없고(BE-요청-hall과-구역가격-조회API 참고), 어차피 결제에 쓸 수
  // 있는 좌석은 발행된 티켓뿐이라 이게 곧 유일한 정답 데이터다.
  const seatMap = useMemo(() => {
    if (!activeZone) return []
    const sorted = realTickets
      .slice()
      .sort((a, b) => a.seatRow.localeCompare(b.seatRow) || Number(a.seatNum) - Number(b.seatNum))
    const colByRow = new Map<string, number>()
    return sorted.map((ticket) => {
      const col = (colByRow.get(ticket.seatRow) ?? 0) + 1
      colByRow.set(ticket.seatRow, col)
      const seatId = `${activeZone}-${ticket.seatRow}-${col}`
      return {
        id: seatId,
        rowLabel: ticket.seatRow,
        col,
        sold: ticket.ticketStatus !== 'AVAILABLE',
        selected: (selectedSeats[activeZone] ?? []).includes(seatId),
        realTicket: ticket,
      }
    })
  }, [activeZone, selectedSeats, realTickets])

  /** 좌석판을 줄 단위로 그리기 위한 그룹핑(등장 순서 = seatMap 정렬 순서 = 행 알파벳순 유지) */
  const seatRows = useMemo(() => {
    const order: string[] = []
    const byRow = new Map<string, typeof seatMap>()
    for (const seat of seatMap) {
      if (!byRow.has(seat.rowLabel)) {
        byRow.set(seat.rowLabel, [])
        order.push(seat.rowLabel)
      }
      byRow.get(seat.rowLabel)!.push(seat)
    }
    return order.map((row) => ({ row, seats: byRow.get(row)! }))
  }, [seatMap])

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

  // 실 토스 결제창은 페이지 이탈(리다이렉트)을 동반해서, 결제 승인(confirm)은 여기서 못 하고
  // /payment/success에서 이어받는다. 이 다이얼로그는 'pay' 단계에 들어서면 실 주문(order-service)의
  // createOrder→pay만 미리 해둬서 토스 결제창을 열 orderId/paymentId를 준비하는 역할까지만 한다.
  useEffect(() => {
    if (step !== 'pay' || pendingPayment) return
    if (!authUser || !selectedRealTicket) {
      setPendingPaymentError('선택한 좌석 정보를 찾을 수 없습니다. 좌석을 다시 선택해 주세요.')
      return
    }
    let cancelled = false
    setPendingPaymentError(null)
    ;(async () => {
      try {
        // usedPoint는 의도적으로 안 넘긴다: 여기서 넘기면 백엔드 PointService가 실 포인트
        // 잔액에서 차감을 시도하는데, 실 포인트 적립/조회 API가 아직 없어서 실 잔액은 사실상
        // 항상 0에 가깝다 — 잘못 넘기면 포인트 사용 자체가 실패로 막힘. 그래서 토스 결제창엔
        // 항상 좌석 정가(gross)를 그대로 청구하고, "포인트 사용" 할인은 지금처럼 mock 장부에만
        // 반영한다(finalAmount는 화면 표시/마이페이지 mock 기록용).
        // 주문 생성 전에 반드시 hold를 호출해서 서버가 계산한 price/만료시각/holdKey를 받아야 한다
        // (order-service의 CreateOrderRequest가 이 값들을 요구함 — 클라이언트가 임의로 만들면 안 됨).
        const hold = await performanceApi.holdTicket(selectedRealTicket.ticketId, authUser.userId, 'GENERAL')
        const created = await orderApi.createOrder(hold.ticketId, authUser.userId, hold.price, hold.holdExpiredAt, hold.holdKey)
        const paid = await orderApi.pay(created.orderId, hold.price)
        if (cancelled) return

        // 포인트 잔액을 읽어오는 실 API가 아직 없어서(다음 정리 대상), 마이페이지 포인트 내역은
        // 여전히 mock 장부로 관리한다. 결제창으로 넘어가면 이 다이얼로그의 로컬 상태가 사라지므로
        // /payment/success가 이어받을 수 있게 paymentId 기준으로 남겨둔다(실 결제 완료와 무관한
        // 부가 정보라 여기서 실패해도 결제 진행 자체는 막지 않음).
        const selectedSeatPayload = seatSelections.map(({ zone, labels }) => ({ zone, seatLabels: labels }))
        writePendingPaymentLedger(paid.paymentId, {
          buyerId: String(authUser.userId),
          performanceId: performance.id,
          sessionId: session.id,
          selections: selectedSeatPayload.map(({ zone, seatLabels }) => ({ zone, quantity: seatLabels.length })),
          selectedSeats: selectedSeatPayload,
          pointsUsed,
        })

        setPendingPayment({ paymentId: paid.paymentId, tossOrderId: paid.orderId, amount: paid.amount })
        releaseSeat()
      } catch (e) {
        if (cancelled) return
        const message = e instanceof OrderApiError ? `${e.code ?? ''} ${e.message}`.trim() : '주문 생성에 실패했습니다.'
        setPendingPaymentError(message)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, pendingPayment, authUser, selectedRealTicket])

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
                    {seatRows.map(({ row, seats }) => (
                      <div key={row} className="flex items-center gap-2">
                        <span className="w-8 text-center text-xs font-semibold text-muted-foreground">{row}행</span>
                        <div
                          className="grid flex-1 gap-2"
                          style={{ gridTemplateColumns: `repeat(${seats.length}, minmax(0, 1fr))` }}
                        >
                          {seats.map((seat) => (
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
                    ))}
                    {seatRows.length === 0 && !realTicketsLoading && (
                      <p className="py-4 text-center text-sm text-muted-foreground">
                        이 구역에는 발행된 좌석이 없습니다.
                      </p>
                    )}
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
            {pendingPaymentError ? (
              <p className="text-sm text-destructive">{pendingPaymentError}</p>
            ) : pendingPayment ? (
              <RealTossPayment
                amount={pendingPayment.amount}
                orderId={pendingPayment.tossOrderId}
                paymentId={pendingPayment.paymentId}
                orderName={`${performance.title} ${session.sessionNum}회차`}
                customerName={authUser?.username}
              />
            ) : (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                주문 생성 중...
              </div>
            )}
            <Button variant="ghost" size="sm" onClick={() => setStep('price')}>
              이전
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
