'use client'

import { useMemo, useState } from 'react'
import { Bell, ExternalLink, CreditCard } from 'lucide-react'
import Link from 'next/link'
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
import type { Zone } from '@/lib/types'

export default function WaitlistPage() {
  const { userId, role, version, cancelWaitlist, cancelWaitlistZone } = useApp()
  void version
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null)
  const [payingEntryId, setPayingEntryId] = useState<string | null>(null)

  const waitlist = useMemo(() => api.listWaitlist(userId), [userId, version])

  const selectedEntry = selectedEntryId
    ? waitlist.find((entry) => entry.id === selectedEntryId) ?? null
    : null
  const selectedPerf = selectedEntry ? api.getPerformance(selectedEntry.performanceId) : undefined
  const selectedSession = selectedEntry
    ? api.listSessions(selectedEntry.performanceId).find((s) => s.id === selectedEntry.sessionId)
    : undefined

  const payingEntry = payingEntryId
    ? waitlist.find((entry) => entry.id === payingEntryId) ?? null
    : null
  const payingPerf = payingEntry ? api.getPerformance(payingEntry.performanceId) : undefined
  const payingSession = payingEntry
    ? api.listSessions(payingEntry.performanceId).find((s) => s.id === payingEntry.sessionId)
    : undefined

  function getZonePosition(entry: (typeof waitlist)[number], zone: Zone) {
    if (entry.status !== 'WAITING') return null
    const waitingEntries = waitlist
      .filter((item) => item.sessionId === entry.sessionId && item.status === 'WAITING' && item.zones.includes(zone))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    const index = waitingEntries.findIndex((item) => item.id === entry.id)
    return index >= 0 ? index + 1 : null
  }

  function handleCancelZone(entryId: string, zone: Zone) {
    try {
      cancelWaitlistZone(entryId, zone)
    } catch (error) {
      alert(error instanceof Error ? error.message : '구역별 취소 실패')
    }
  }

  function openPayment(entryId: string) {
    setSelectedEntryId(null)
    setPayingEntryId(entryId)
  }

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
        {waitlist.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            대기 신청 이력이 없습니다.
          </div>
        ) : (
          waitlist.map((entry) => {
            const perf = api.getPerformance(entry.performanceId)
            const session = api.listSessions(entry.performanceId).find((s) => s.id === entry.sessionId)
            const isOffered = entry.status === 'OFFERED'
            return (
              <div
                key={entry.id}
                className={cn(
                  'rounded-xl border bg-card p-4',
                  isOffered ? 'border-warning/40 bg-warning/5' : 'border-border',
                )}
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{perf?.title}</p>
                      <WaitlistStatusBadge status={entry.status} />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {session ? `${session.sessionNum}회차 · ${formatDay(session.performanceStartAt)} ${formatTime(session.performanceStartAt)}` : ''}
                    </p>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                      <span>신청 구역: {entry.zones.join(', ')}</span>
                      {isOffered ? (
                        <span className="font-medium text-warning">우선예매 구역: {entry.offeredZone}</span>
                      ) : (
                        entry.position > 0 && <span>대기순번: {entry.position}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isOffered && (
                      <Button size="sm" onClick={() => openPayment(entry.id)}>
                        <CreditCard className="mr-1 size-3.5" />결제하기
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => setSelectedEntryId(entry.id)}>
                      상세
                    </Button>
                    <Link
                      href={`/performances/${entry.performanceId}`}
                      className={cn(buttonVariants({ size: 'sm', variant: 'outline' }))}
                    >
                      <ExternalLink className="mr-1 size-3.5" />공연 보기
                    </Link>
                    {entry.status === 'WAITING' && (
                      <Button size="sm" variant="ghost" onClick={() => cancelWaitlist(entry.id)}>
                        취소
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      <Dialog open={selectedEntry != null} onOpenChange={(v) => !v && setSelectedEntryId(null)}>
        <DialogContent className="max-w-md">
          {selectedEntry && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Bell className="size-5 text-primary" />
                  대기 상세
                </DialogTitle>
                <DialogDescription>
                  {selectedPerf?.title ?? '-'}
                  {selectedSession
                    ? ` · ${selectedSession.sessionNum}회차 ${formatDay(selectedSession.performanceStartAt)} ${formatTime(selectedSession.performanceStartAt)}`
                    : ''}
                </DialogDescription>
              </DialogHeader>

              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">대기 상태</span>
                <WaitlistStatusBadge status={selectedEntry.status} />
              </div>

              <div className="space-y-2 rounded-lg border border-border bg-secondary/20 p-3">
                {selectedEntry.zones.map((zone) => {
                  const isOfferedZone = selectedEntry.status === 'OFFERED' && selectedEntry.offeredZone === zone
                  const position = getZonePosition(selectedEntry, zone)
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
                            : position
                              ? `${position}번째 대기`
                              : selectedEntry.status === 'WAITING'
                                ? '대기 순번 확인 불가'
                                : '대기 중'}
                        </span>
                      </div>
                      {isOfferedZone ? (
                        <Button size="sm" onClick={() => openPayment(selectedEntry.id)}>
                          <CreditCard className="mr-1 size-3.5" />결제하기
                        </Button>
                      ) : selectedEntry.status === 'WAITING' ? (
                        <Button size="sm" variant="ghost" onClick={() => handleCancelZone(selectedEntry.id, zone)}>
                          구역 취소
                        </Button>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {payingEntry && payingPerf && payingSession && (
        <WaitlistPaymentDialog
          open={payingEntry != null}
          onOpenChange={(v) => !v && setPayingEntryId(null)}
          entry={payingEntry}
          performance={payingPerf}
          session={payingSession}
        />
      )}
    </div>
  )
}
