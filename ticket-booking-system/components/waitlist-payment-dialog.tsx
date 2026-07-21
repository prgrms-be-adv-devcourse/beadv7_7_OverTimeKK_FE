'use client'

import { useEffect, useState } from 'react'
import { CreditCard, Clock } from 'lucide-react'
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
import { ZoneBadge } from '@/components/status-badges'
import { useApp } from '@/lib/store'
import { api } from '@/lib/api'
import { formatKRW, formatDay, formatTime } from '@/lib/domain'
import type { Performance, PerformanceSession, WaitlistEntry } from '@/lib/types'

/** 남은 시간을 실시간(절대 만료시각 기준)으로 계산 — 창을 닫았다 열어도 시간은 계속 흐른다. */
function remainingSeconds(expiresAt?: string): number {
  if (!expiresAt) return 0
  return Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))
}

function formatCountdown(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function WaitlistPaymentDialog({
  open,
  onOpenChange,
  entry,
  performance,
  session,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  entry: WaitlistEntry
  performance: Performance
  session: PerformanceSession
}) {
  const { acceptWaitlistOffer, cancelWaitlistOffer } = useApp()
  const [remaining, setRemaining] = useState(() => remainingSeconds(entry.offerExpiresAt))
  const [processing, setProcessing] = useState(false)

  // 절대 만료시각 기준으로 1초마다 남은 시간 재계산
  useEffect(() => {
    setRemaining(remainingSeconds(entry.offerExpiresAt))
    const timer = setInterval(() => {
      setRemaining(remainingSeconds(entry.offerExpiresAt))
    }, 1000)
    return () => clearInterval(timer)
  }, [entry.offerExpiresAt])

  const expired = remaining <= 0
  const zone = entry.offeredZone
  const price = zone
    ? api.listZonePrices(performance.id).find((p) => p.zone === zone)?.price ?? 0
    : 0

  function handlePay() {
    if (expired) {
      toast.error('결제 제한 시간이 지났습니다.')
      return
    }
    setProcessing(true)
    try {
      acceptWaitlistOffer(entry.id)
      toast.success('결제가 완료되었습니다.', {
        description: '우선 예매가 확정되어 발권되었습니다.',
      })
      onOpenChange(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '결제에 실패했습니다.')
    } finally {
      setProcessing(false)
    }
  }

  function handleCancel() {
    setProcessing(true)
    try {
      cancelWaitlistOffer(entry.id)
      toast.info('우선 예매를 취소했습니다.', {
        description: '대기열에서 취소 처리되었습니다.',
      })
      onOpenChange(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '취소에 실패했습니다.')
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

        {/* 결제 제한 시간 카운트다운 */}
        <div
          className={`flex items-center justify-between rounded-lg border p-3 ${
            expired
              ? 'border-destructive/30 bg-destructive/10 text-destructive'
              : 'border-warning/30 bg-warning/10 text-warning-foreground'
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

        <div className="space-y-2 rounded-lg border border-border bg-secondary/20 p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">배정 구역</span>
            {zone && <ZoneBadge zone={zone} />}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">수량</span>
            <span>1매</span>
          </div>
          <div className="flex items-center justify-between border-t border-border pt-2">
            <span className="font-medium">결제 금액</span>
            <span className="font-semibold">{formatKRW(price)}</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={processing}>
            결제 취소
          </Button>
          <Button onClick={handlePay} disabled={processing || expired}>
            결제하기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
