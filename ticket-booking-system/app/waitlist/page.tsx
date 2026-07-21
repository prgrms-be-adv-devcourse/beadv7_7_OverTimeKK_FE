'use client'

import { useMemo, useState } from 'react'
import { Bell, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react'
import Link from 'next/link'
import { useApp } from '@/lib/store'
import { api } from '@/lib/api'
import { formatDay, formatTime } from '@/lib/domain'
import { WaitlistStatusBadge, ZoneBadge } from '@/components/status-badges'
import { Button } from '@/components/ui/button'
import type { Zone } from '@/lib/types'

export default function WaitlistPage() {
  const { userId, role, version, cancelWaitlist, cancelWaitlistZone, acceptWaitlistOffer, declineWaitlistOffer } = useApp()
  void version
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null)

  const waitlist = useMemo(() => api.listWaitlist(userId), [userId, version])
  const offeredEntries = waitlist.filter((entry) => entry.status === 'OFFERED')
  const otherEntries = waitlist.filter((entry) => entry.status !== 'OFFERED')

  function handleAccept(entryId: string) {
    try {
      acceptWaitlistOffer(entryId)
    } catch (error) {
      alert(error instanceof Error ? error.message : '처리 실패')
    }
  }

  function handleDecline(entryId: string) {
    try {
      declineWaitlistOffer(entryId)
    } catch (error) {
      alert(error instanceof Error ? error.message : '처리 실패')
    }
  }

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
              취소표가 생기면 우선 예매 권한이 부여됩니다. 제한 시간 내 결제를 완료하지 않으면 다음 순번으로 넘어갑니다.
            </p>
          </div>
          <div className="rounded-full bg-primary/10 p-3 text-primary">
            <Bell className="size-5" />
          </div>
        </div>
      </div>

      {offeredEntries.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">예매 가능 알림</h2>
          {offeredEntries.map((entry) => {
            const perf = api.getPerformance(entry.performanceId)
            const session = api.listSessions(entry.performanceId).find((s) => s.id === entry.sessionId)
            return (
              <div key={entry.id} className="rounded-xl border border-warning/30 bg-warning/10 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-semibold">{perf?.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {session ? `${session.sessionNum}회차 · ${formatDay(session.performanceStartAt)} ${formatTime(session.performanceStartAt)}` : ''}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      신청 구역: {entry.zones.join(', ')} · 우선예매 구역: {entry.offeredZone}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => handleAccept(entry.id)}>
                      구매하기
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleDecline(entry.id)}>
                      다음 순번으로
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">대기 내역</h2>
        {waitlist.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            대기 신청 이력이 없습니다.
          </div>
        ) : (
          otherEntries.map((entry) => {
            const perf = api.getPerformance(entry.performanceId)
            const session = api.listSessions(entry.performanceId).find((s) => s.id === entry.sessionId)
            const isExpanded = expandedEntryId === entry.id
            return (
              <div key={entry.id} className="rounded-xl border border-border bg-card p-4">
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
                      {entry.position > 0 && <span>대기순번: {entry.position}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setExpandedEntryId((prev) => (prev === entry.id ? null : entry.id))}>
                      {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/performances/${entry.performanceId}`}>
                        <ExternalLink className="mr-1 size-3.5" />공연 보기
                      </Link>
                    </Button>
                    {entry.status === 'WAITING' && (
                      <Button size="sm" variant="ghost" onClick={() => cancelWaitlist(entry.id)}>
                        취소
                      </Button>
                    )}
                  </div>
                </div>
                {isExpanded && (
                  <div className="mt-4 space-y-2 rounded-lg border border-border bg-secondary/20 p-3">
                    {entry.zones.map((zone) => {
                      const position = getZonePosition(entry, zone)
                      return (
                        <div key={zone} className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <ZoneBadge zone={zone} />
                            <span className="text-xs text-muted-foreground">
                              {position ? `${position}번째 대기` : '대기 순번 확인 불가'}
                            </span>
                          </div>
                          {entry.status === 'WAITING' && (
                            <Button size="sm" variant="ghost" onClick={() => handleCancelZone(entry.id, zone)}>
                              구역 취소
                            </Button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
