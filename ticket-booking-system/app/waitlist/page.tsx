'use client'

import { useState } from 'react'
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
import { useMyStandby, type StandbySummaryEntry } from '@/lib/use-standby'
import { standbyApi, standbyErrorMessage } from '@/lib/standby-api'
import { standbyStore } from '@/lib/standby-store'
import { LoginRequired } from '@/components/login-required'
import type { Zone } from '@/lib/types'

export default function WaitlistPage() {
  const { userId, role, authUser, accessToken, authLoading } = useApp()
  const { entries, refresh } = useMyStandby(userId ?? '', accessToken ?? '')
  const [selectedStandbyId, setSelectedStandbyId] = useState<number | null>(null)
  const [payingStandbyId, setPayingStandbyId] = useState<number | null>(null)

  const selectedEntry = selectedStandbyId
    ? entries.find((e) => e.record.standbyId === selectedStandbyId) ?? null
    : null

  const payingEntry = payingStandbyId
    ? entries.find((e) => e.record.standbyId === payingStandbyId) ?? null
    : null
  const payingHeldZoneRank = payingEntry?.zoneRanks.find((z) => z.isHeld)
  const payingZone = payingHeldZoneRank?.zone
  const payingTicketId = payingHeldZoneRank?.ticketId
  const payingPerf = payingEntry ? api.getPerformance(payingEntry.record.performanceId) : undefined
  const payingSession = payingEntry
    ? api.listSessions(payingEntry.record.performanceId).find((s) => s.id === payingEntry.record.sessionId)
    : undefined

  async function handleCancelAll(entry: StandbySummaryEntry) {
    if (!authUser || !accessToken) return
    try {
      await standbyApi.cancel(entry.record.standbyId, accessToken)
      standbyStore.remove(String(authUser.userId), entry.record.standbyId)
      refresh()
    } catch (e) {
      toast.error(standbyErrorMessage(e, '대기 취소에 실패했습니다.'))
    }
  }

  async function handleCancelZone(entry: StandbySummaryEntry, zone: Zone) {
    if (!authUser || !accessToken) return
    try {
      await standbyApi.cancelZone(entry.record.standbyId, zone, accessToken)
      standbyStore.removeZone(String(authUser.userId), entry.record.standbyId, zone)
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
  if (role !== 'BUYER') {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <p className="text-muted-foreground">구매자 전환 후 이용할 수 있습니다.</p>
      </div>
    )
  }

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
            const { record, zoneRanks } = entry
            const perf = api.getPerformance(record.performanceId)
            const session = api
              .listSessions(record.performanceId)
              .find((s) => s.id === record.sessionId)
            const heldZone = zoneRanks.find((z) => z.isHeld)?.zone
            const isOffered = heldZone != null
            return (
              <div
                key={record.standbyId}
                className={cn(
                  'rounded-xl border bg-card p-4',
                  isOffered ? 'border-warning/40 bg-warning/5' : 'border-border',
                )}
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{perf?.title}</p>
                      <WaitlistStatusBadge status={isOffered ? 'HELD' : 'WAITING'} />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {session ? `${session.sessionNum}회차 · ${formatDay(session.performanceStartAt)} ${formatTime(session.performanceStartAt)}` : ''}
                    </p>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                      <span>신청 구역: {record.zones.join(', ')}</span>
                      {isOffered && (
                        <span className="font-medium text-warning">우선예매 구역: {heldZone}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isOffered && (
                      <Button size="sm" onClick={() => openPayment(record.standbyId)}>
                        <CreditCard className="mr-1 size-3.5" />결제하기
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => setSelectedStandbyId(record.standbyId)}>
                      상세
                    </Button>
                    <Link
                      href={`/performances/${record.performanceId}`}
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
              {(() => {
                const perf = api.getPerformance(selectedEntry.record.performanceId)
                const session = api
                  .listSessions(selectedEntry.record.performanceId)
                  .find((s) => s.id === selectedEntry.record.sessionId)
                const heldZone = selectedEntry.zoneRanks.find((z) => z.isHeld)?.zone
                return (
                  <>
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <Bell className="size-5 text-primary" />
                        대기 상세
                      </DialogTitle>
                      <DialogDescription>
                        {perf?.title ?? '-'}
                        {session
                          ? ` · ${session.sessionNum}회차 ${formatDay(session.performanceStartAt)} ${formatTime(session.performanceStartAt)}`
                          : ''}
                      </DialogDescription>
                    </DialogHeader>

                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">대기 상태</span>
                      <WaitlistStatusBadge status={heldZone ? 'HELD' : 'WAITING'} />
                    </div>

                    <div className="space-y-2 rounded-lg border border-border bg-secondary/20 p-3">
                      {selectedEntry.record.zones.map((zone) => {
                        const zoneRank = selectedEntry.zoneRanks.find((z) => z.zone === zone)
                        const isOfferedZone = zoneRank?.isHeld ?? false
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
                                    : '대기 순번 확인 불가'}
                              </span>
                            </div>
                            {isOfferedZone ? (
                              <Button size="sm" onClick={() => openPayment(selectedEntry.record.standbyId)}>
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
                )
              })()}
            </>
          )}
        </DialogContent>
      </Dialog>

      {payingEntry && payingZone && payingTicketId && payingPerf && payingSession && (
        <WaitlistPaymentDialog
          open={payingEntry != null}
          onOpenChange={(v) => !v && setPayingStandbyId(null)}
          standbyId={payingEntry.record.standbyId}
          zone={payingZone}
          ticketId={payingTicketId}
          heldSince={payingEntry.record.heldSince}
          performance={payingPerf}
          session={payingSession}
          onSettled={refresh}
        />
      )}
    </div>
  )
}
