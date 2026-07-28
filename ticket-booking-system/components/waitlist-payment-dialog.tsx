'use client'

import { useEffect, useState } from 'react'
import { CreditCard, Clock, Coins } from 'lucide-react'
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
import { TossPayment } from '@/components/toss-payment'
import { useApp } from '@/lib/store'
import { api } from '@/lib/api'
import { formatKRW, formatDay, formatTime } from '@/lib/domain'
import type { Performance, PerformanceSession, Zone } from '@/lib/types'
import { standbyApi, standbyErrorMessage, STANDBY_OFFER_TTL_SECONDS, STANDBY_USER_ID } from '@/lib/standby-api'
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
  heldSince,
  performance,
  session,
  onSettled,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  standbyId: number
  zone: Zone
  heldSince?: string
  performance: Performance
  session: PerformanceSession
  onSettled: () => void
}) {
  const { userId, createOrder, points } = useApp()
  const [remaining, setRemaining] = useState(() => remainingSeconds(heldSince))
  const [processing, setProcessing] = useState(false)
  const [step, setStep] = useState<'price' | 'pay'>('price')
  const [pointsInput, setPointsInput] = useState('0')

  // 절대 만료시각(근사치) 기준으로 1초마다 남은 시간 재계산
  useEffect(() => {
    setRemaining(remainingSeconds(heldSince))
    const timer = setInterval(() => {
      setRemaining(remainingSeconds(heldSince))
    }, 1000)
    return () => clearInterval(timer)
  }, [heldSince])

  const expired = remaining <= 0
  const price = api.listZonePrices(performance.id).find((p) => p.zone === zone)?.price ?? 0

  const maxUsablePoints = Math.max(0, Math.min(points, price))
  const pointsUsed = Math.max(0, Math.min(Number(pointsInput) || 0, maxUsablePoints))
  const finalAmount = price - pointsUsed

  function handlePointsChange(raw: string) {
    const digitsOnly = raw.replace(/[^0-9]/g, '')
    const clamped = Math.min(Number(digitsOnly) || 0, maxUsablePoints)
    setPointsInput(String(clamped))
  }

  function handlePay(method: string) {
    if (expired) {
      toast.error('결제 제한 시간이 지났습니다.')
      return
    }
    setProcessing(true)
    try {
      // 실제 결제/발권 API는 ticket·order 도메인 소관이라 이 가이드 범위 밖 —
      // 지금은 프론트 mock 주문 생성 로직을 그대로 재사용한다.
      createOrder({
        buyerId: userId,
        performanceId: performance.id,
        sessionId: session.id,
        selections: [{ zone, quantity: 1 }],
        method,
        fromWaitlist: true,
        pointsUsed,
      })
      standbyStore.remove(userId, standbyId)
      toast.success('결제가 완료되었습니다.', {
        description: '우선 예매가 확정되어 발권되었습니다.',
      })
      onOpenChange(false)
      onSettled()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '결제에 실패했습니다.')
    } finally {
      setProcessing(false)
    }
  }

  async function handleCancel() {
    setProcessing(true)
    try {
      await standbyApi.cancelZone(standbyId, zone, STANDBY_USER_ID)
      standbyStore.removeZone(userId, standbyId, zone)
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
              <Button onClick={() => setStep('pay')} disabled={expired}>
                다음
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'pay' && (
          <>
            <TossPayment amount={finalAmount} onApproved={handlePay} />
            <Button variant="ghost" size="sm" onClick={() => setStep('price')} disabled={processing}>
              이전
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
