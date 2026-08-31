'use client'

import { useEffect, useState } from 'react'
import { Bell, ExternalLink, CreditCard } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { useApp } from '@/lib/store'
import { api } from '@/lib/api'
import { formatDay, formatTime } from '@/lib/domain'
import { WaitlistStatusBadge, ZoneBadge } from '@/components/status-badges'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { WaitlistPaymentDialog } from '@/components/waitlist-payment-dialog'
import { useMyStandby } from '@/lib/use-standby'
import { standbyApi, standbyErrorMessage, type StandbyListItem, type StandbyZoneRank } from '@/lib/standby-api'
import { LoginRequired } from '@/components/login-required'
import type { Zone } from '@/lib/types'

export default function WaitlistPage() {
  const { authUser, accessToken, authLoading } = useApp()
  const { entries, refresh } = useMyStandby(accessToken ?? '')
  const [selectedStandbyId, setSelectedStandbyId] = useState<number | null>(null)
  const [selectedZoneRanks, setSelectedZoneRanks] = useState<StandbyZoneRank[] | null>(null)
  const [payingStandbyId, setPayingStandbyId] = useState<number | null>(null)

  const selectedEntry = selectedStandbyId
    ? entries.find((e) => e.standbyId === selectedStandbyId) ?? null
    : null

  const payingEntry = payingStandbyId
    ? entries.find((e) => e.standbyId === payingStandbyId) ?? null
    : null
  const payingZone = payingEntry?.matchedZone
  const payingTicketId = payingEntry?.ticketId
  const payingPerf = payingEntry ? api.getPerformance(String(payingEntry.performanceId)) : undefined
  const payingSession = payingEntry
    ? api
        .listSessions(String(payingEntry.performanceId))
        .find((s) => s.sessionNum === payingEntry.sessionNum)
    : undefined

  // 상세 다이얼로그를 열 때만 구역별 순위(zoneRanks)를 조회한다 — 매칭 완료(RESERVED) 건은
  // 순위 조회가 막혀 있어(STB409_004) 목록 폴링에는 포함하지 않는다.
  useEffect(() => {
    if (!selectedStandbyId || !accessToken) {
      setSelectedZoneRanks(null)
      return
    }
    let cancelled = false
    standbyApi
      .get(selectedStandbyId, accessToken)
      .then((detail) => {
        if (!cancelled) setSelectedZoneRanks(detail.zoneRanks)
      })
      .catch(() => {
        if (!cancelled) setSelectedZoneRanks([])
      })
    return () => {
      cancelled = true
    }
  }, [selectedStandbyId, accessToken])

  async function handleCancelAll(entry: StandbyListItem) {
    if (!authUser || !accessToken) return
    try {
      await standbyApi.cancel(entry.standbyId, accessToken)
      refresh()
    } catch (e) {
      toast.error(standbyErrorMessage(e, '대기 취소에 실패했습니다.'))
    }
  }

  async function handleCancelZone(entry: StandbyListItem, zone: Zone) {
    if (!authUser || !accessToken) return
    try {
      await standbyApi.cancelZone(entry.standbyId, zone, accessToken)
      refresh()
    } catch (e) {
      toast.error(standbyErrorMessage(e, '구역별 취소에 실패했습니다.'))
    }
  }

  function openPayment(standbyId: number) {
    setSelectedStandbyId(null)
    setPayingStandbyId(standbyId)
  }

  if (authLoading) return null
  if (!authUser) return <LoginRequired message="대기 신청 내역은 로그인 후 이용할 수 있습니다." />

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 space-y-6">
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-primary">대기 신청 현황</p>
            <h1 className="mt-1 text-2xl font-bold">내 대기 신청</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              취소표가 생기면 우선 예매 권한이 부여됩니다. 제한 시간(30분) 내 결제를 완료하지 않으면 다음 순번으로 넘어갑니다.
            </p>
          </div>
          <div className="rounded-full bg-primary/10 p-3 text-primary">
            <Bell className="size-5" />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">대기 내역</h2>
        {entries.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            대기 신청 이력이 없습니다.
          </div>
        ) : (
          entries.map((entry) => {
            const isOffered = entry.status === 'HELD'
            return (
              <div
                key={entry.standbyId}
                className={cn(
                  'rounded-xl border bg-card p-4',
                  isOffered ? 'border-warning/40 bg-warning/5' : 'border-border',
                )}
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{entry.performanceTitle}</p>
                      <WaitlistStatusBadge status={isOffered ? 'HELD' : 'WAITING'} />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {entry.sessionNum}회차 · {formatDay(entry.performanceStartAt)} {formatTime(entry.performanceStartAt)}
                    </p>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                      <span>신청 구역: {entry.zones.join(', ')}</span>
                      {isOffered && (
                        <span className="font-medium text-warning">우선예매 구역: {entry.matchedZone}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isOffered && (
                      <Button size="sm" onClick={() => openPayment(entry.standbyId)}>
                        <CreditCard className="mr-1 size-3.5" />결제하기
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => setSelectedStandbyId(entry.standbyId)}>
                      상세
                    </Button>
                    <Link
                      href={`/performances/${entry.performanceId}`}
                      className={cn(buttonVariants({ size: 'sm', variant: 'outline' }))}
                    >
                      <ExternalLink className="mr-1 size-3.5" />공연 보기
                    </Link>
                    <Button size="sm" variant="ghost" onClick={() => handleCancelAll(entry)}>
                      취소
                    </Button>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      <Dialog open={selectedEntry != null} onOpenChange={(v) => !v && setSelectedStandbyId(null)}>
        <DialogContent className="max-w-md">
          {selectedEntry && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Bell className="size-5 text-primary" />
                  대기 상세
                </DialogTitle>
                <DialogDescription>
                  {selectedEntry.performanceTitle} · {selectedEntry.sessionNum}회차{' '}
                  {formatDay(selectedEntry.performanceStartAt)} {formatTime(selectedEntry.performanceStartAt)}
                </DialogDescription>
              </DialogHeader>

              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">대기 상태</span>
                <WaitlistStatusBadge status={selectedEntry.status === 'HELD' ? 'HELD' : 'WAITING'} />
              </div>

              <div className="space-y-2 rounded-lg border border-border bg-secondary/20 p-3">
                {selectedEntry.zones.map((zone) => {
                  const zoneRank = selectedZoneRanks?.find((z) => z.zone === zone)
                  const isOfferedZone = zoneRank?.isHeld ?? zone === selectedEntry.matchedZone
                  return (
                    <div key={zone} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <ZoneBadge zone={zone} />
                        <span
                          className={cn(
                            'text-xs',
                            isOfferedZone ? 'font-medium text-warning' : 'text-muted-foreground',
                          )}
                        >
                          {isOfferedZone
                            ? '결제 가능'
                            : zoneRank
                              ? `${zoneRank.rank}번째 대기`
                              : selectedZoneRanks == null
                                ? '순위 확인 중...'
                                : '대기 순번 확인 불가'}
                        </span>
                      </div>
                      {isOfferedZone ? (
                        <Button size="sm" onClick={() => openPayment(selectedEntry.standbyId)}>
                          <CreditCard className="mr-1 size-3.5" />결제하기
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleCancelZone(selectedEntry, zone)}
                        >
                          구역 취소
                        </Button>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {payingEntry && payingZone && payingTicketId && payingPerf && payingSession && (
        <WaitlistPaymentDialog
          open={payingEntry != null}
          onOpenChange={(v) => !v && setPayingStandbyId(null)}
          standbyId={payingEntry.standbyId}
          zone={payingZone}
          ticketId={payingTicketId}
          expiredAt={payingEntry.expiredAt}
          performance={payingPerf}
          session={payingSession}
          onSettled={refresh}
        />
      )}
    </div>
  )
}
