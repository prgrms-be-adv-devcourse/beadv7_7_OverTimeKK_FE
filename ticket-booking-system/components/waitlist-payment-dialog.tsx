'use client'

import { useEffect, useState } from 'react'
import { CreditCard, Clock, Coins, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ZoneBadge } from '@/components/status-badges'
import { BookingSteps } from '@/components/booking-steps'
import { RealTossPayment } from '@/components/real-toss-payment'
import { useApp } from '@/lib/store'
import { orderApi, OrderApiError } from '@/lib/order-api'
import { performanceApi } from '@/lib/performance-api'
import { writePendingPaymentLedger } from '@/lib/pending-payment'
import { formatKRW, formatDay, formatTime } from '@/lib/domain'
import type { Performance, PerformanceSession, Zone } from '@/lib/types'
import { standbyApi, standbyErrorMessage, STANDBY_OFFER_TTL_SECONDS } from '@/lib/standby-api'
import { standbyStore } from '@/lib/standby-store'

/** 대기순번 매칭으로 배정된 비지정석은 좌석 선택 단계가 없어 2단계(가격 선택 → 결제)로 시작 */
const STEP_LABELS = ['가격 선택', '결제']

/**
 * 남은 시간을 실시간(절대 만료시각 기준)으로 계산 — 창을 닫았다 열어도 시간은 계속 흐른다.
 * 백엔드 조회 API는 결제 만료시각을 내려주지 않는다(ticket 도메인 소관, 문서 범위 밖) —
 * 그래서 프론트가 매칭(isHeld) 감지 시각을 로컬에 기록해두고 여기서 30분을 더해 근사 계산한다.
 */
function remainingSeconds(heldSince?: string): number {
  if (!heldSince) return STANDBY_OFFER_TTL_SECONDS
  const expiresAt = new Date(heldSince).getTime() + STANDBY_OFFER_TTL_SECONDS * 1000
  return Math.max(0, Math.floor((expiresAt - Date.now()) / 1000))
}

function formatCountdown(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function WaitlistPaymentDialog({
  open,
  onOpenChange,
  standbyId,
  zone,
  ticketId,
  heldSince,
  performance,
  session,
  onSettled,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  standbyId: number
  zone: Zone
  ticketId: number
  heldSince?: string
  performance: Performance
  session: PerformanceSession
  onSettled: () => void
}) {
  const { points, authUser } = useApp()
  const [remaining, setRemaining] = useState(() => remainingSeconds(heldSince))
  const [processing, setProcessing] = useState(false)
  const [step, setStep] = useState<'price' | 'pay'>('price')
  const [pointsInput, setPointsInput] = useState('0')
  const [zonePrice, setZonePrice] = useState<number | null>(null)
  const [pendingPayment, setPendingPayment] = useState<{
    paymentId: number
    tossOrderId: string
    amount: number
  } | null>(null)
  const [pendingPaymentError, setPendingPaymentError] = useState<string | null>(null)

  // 절대 만료시각(근사치) 기준으로 1초마다 남은 시간 재계산
  useEffect(() => {
    setRemaining(remainingSeconds(heldSince))
    const timer = setInterval(() => {
      setRemaining(remainingSeconds(heldSince))
    }, 1000)
    return () => clearInterval(timer)
  }, [heldSince])

  // 다이얼로그가 열릴 때마다 초기화(다른 대기 건으로 다시 열릴 수 있음)
  useEffect(() => {
    if (open) {
      setStep('price')
      setPointsInput('0')
      setPendingPayment(null)
      setPendingPaymentError(null)
    }
  }, [open])

  // 실 구역 가격 — mock 가격이 아니라 booking-dialog와 동일하게 performanceApi로 조회
  useEffect(() => {
    if (!open) return
    let cancelled = false
    performanceApi
      .selectSeatZone(Number(performance.id), session.sessionNum, zone)
      .then((result) => {
        if (!cancelled) setZonePrice(result.price)
      })
      .catch((e) => {
        if (!cancelled) console.warn('실 구역 가격 조회 실패:', e)
      })
    return () => {
      cancelled = true
    }
  }, [open, performance.id, session.sessionNum, zone])

  const expired = remaining <= 0
  const price = zonePrice ?? 0

  // price - 1로 캡: 백엔드가 포인트 전액 결제(PG 결제액 0원)는 아직 지원하지 않는다고
  // 명시돼 있음(PaymentServiceImpl.pay() 주석) — 최소 1원은 PG로 결제되게 강제.
  const maxUsablePoints = Math.max(0, Math.min(points, price - 1))
  const pointsUsed = Math.max(0, Math.min(Number(pointsInput) || 0, maxUsablePoints))
  const finalAmount = price - pointsUsed

  function handlePointsChange(raw: string) {
    const digitsOnly = raw.replace(/[^0-9]/g, '')
    const clamped = Math.min(Number(digitsOnly) || 0, maxUsablePoints)
    setPointsInput(String(clamped))
  }

  // 실 주문(order-service)의 createOrder→pay만 미리 해둬서 토스 결제창을 열 orderId/paymentId를
  // 준비한다. 결제 승인(confirm)은 토스 결제창 리다이렉트 이후 /payment/success에서 처리된다 —
  // booking-dialog와 동일한 구조(자세한 설명은 그쪽 주석 참고).
  useEffect(() => {
    if (step !== 'pay' || pendingPayment || expired) return
    if (!authUser) {
      setPendingPaymentError('로그인이 필요합니다.')
      return
    }
    let cancelled = false
    setPendingPaymentError(null)
    ;(async () => {
      try {
        // 주문 생성 전에 반드시 hold를 호출해서 서버가 계산한 price/만료시각/holdKey를 받아야 한다
        // (order-service의 CreateOrderRequest가 이 값들을 요구함 — booking-dialog와 동일한 이유).
        const hold = await performanceApi.holdTicket(ticketId, authUser.userId, 'STANDBY')
        const created = await orderApi.createOrder(hold.ticketId, authUser.userId, hold.price, hold.holdExpiredAt, hold.holdKey)
        // usedPoint를 실제로 넘겨 백엔드가 포인트를 차감하게 한다. paid.amount는 항상 주문
        // 원금(gross)이라 토스 결제창엔 대신 순수 결제액(hold.price - pointsUsed)을 써야 한다
        // (자세한 이유는 booking-dialog.tsx의 동일 지점 주석 참고).
        const paid = await orderApi.pay(created.orderId, hold.price, pointsUsed)
        if (cancelled) return

        writePendingPaymentLedger(paid.paymentId, {
          buyerId: String(authUser.userId),
          performanceId: performance.id,
          sessionId: session.id,
          selections: [{ zone, quantity: 1 }],
          fromWaitlist: true,
          pointsUsed,
          standbyCleanup: { userId: String(authUser.userId), standbyId },
        })

        setPendingPayment({
          paymentId: paid.paymentId,
          tossOrderId: paid.orderId,
          amount: hold.price - pointsUsed,
        })
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
  }, [step, pendingPayment, expired, authUser, ticketId, price])

  async function handleCancel() {
    if (!authUser) {
      toast.error('로그인이 필요합니다.')
      return
    }
    setProcessing(true)
    try {
      await standbyApi.cancelZone(standbyId, zone, authUser.userId)
      standbyStore.removeZone(String(authUser.userId), standbyId, zone)
      toast.info('우선 예매를 취소했습니다.', {
        description: '대기열에서 취소 처리되었습니다.',
      })
      onOpenChange(false)
      onSettled()
    } catch (e) {
      toast.error(standbyErrorMessage(e, '취소에 실패했습니다.'))
    } finally {
      setProcessing(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="size-5 text-primary" />
            우선 예매 결제
          </DialogTitle>
          <DialogDescription>
            {performance.title} · {session.sessionNum}회차{' '}
            {formatDay(session.performanceStartAt)} {formatTime(session.performanceStartAt)}
          </DialogDescription>
        </DialogHeader>

        <BookingSteps steps={STEP_LABELS} current={step === 'price' ? 0 : 1} />

        {/* 결제 제한 시간 카운트다운 */}
        <div
          className={`flex items-center justify-between rounded-lg border p-3 ${
            expired
              ? 'border-destructive/30 bg-destructive/10 text-destructive'
              : 'border-warning/30 bg-warning/10 text-warning'
          }`}
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            <Clock className="size-4" />
            결제 제한 시간
          </span>
          <span className="font-mono text-lg font-semibold tabular-nums">
            {expired ? '시간 초과' : formatCountdown(remaining)}
          </span>
        </div>

        {expired && (
          <p className="text-xs text-destructive">
            제한 시간(30분)이 지나 결제할 수 없습니다. 우선 예매권은 다음 대기자에게 넘어갑니다.
          </p>
        )}

        {step === 'price' && (
          <>
            <div className="space-y-2 rounded-lg border border-border bg-secondary/20 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">배정 구역</span>
                <ZoneBadge zone={zone} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">수량</span>
                <span>1매</span>
              </div>
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
                  disabled={maxUsablePoints <= 0 || expired}
                  className="text-right"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPointsInput(String(maxUsablePoints))}
                  disabled={maxUsablePoints <= 0 || expired}
                >
                  모두 사용
                </Button>
              </div>
            </div>

            <div className="space-y-1.5 rounded-lg border border-border bg-secondary/20 p-3 text-sm">
              <div className="flex items-center justify-between text-muted-foreground">
                <span>티켓 금액</span>
                <span>{formatKRW(price)}</span>
              </div>
              {pointsUsed > 0 && (
                <div className="flex items-center justify-between text-warning">
                  <span>포인트 사용</span>
                  <span>-{formatKRW(pointsUsed)}</span>
                </div>
              )}
              <div className="flex items-center justify-between border-t border-border pt-2">
                <span className="font-medium">결제 금액</span>
                <span className="font-semibold">{formatKRW(finalAmount)}</span>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleCancel} disabled={processing}>
                결제 취소
              </Button>
              <Button onClick={() => setStep('pay')} disabled={expired || zonePrice == null}>
                다음
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'pay' && (
          <>
            {pendingPaymentError ? (
              <p className="text-sm text-destructive">{pendingPaymentError}</p>
            ) : pendingPayment ? (
              <RealTossPayment
                amount={pendingPayment.amount}
                orderId={pendingPayment.tossOrderId}
                paymentId={pendingPayment.paymentId}
                orderName={`${performance.title} ${session.sessionNum}회차 (우선예매)`}
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
    </Dialog>
  )
}
