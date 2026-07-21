'use client'

import { useMemo, useState } from 'react'
import { Ticket, Bell, TrendingUp } from 'lucide-react'
import { PerformanceCard } from '@/components/performance-card'
import { Button } from '@/components/ui/button'
import { useApp } from '@/lib/store'
import { api } from '@/lib/api'
import type { PerformanceStatus } from '@/lib/types'

type Filter = 'ALL' | 'ON_SALE' | 'SOLD_OUT' | 'UPCOMING'

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'ALL', label: '전체' },
  { key: 'ON_SALE', label: '예매중' },
  { key: 'SOLD_OUT', label: '매진' },
  { key: 'UPCOMING', label: '오픈예정' },
]

export default function HomePage() {
  const { version } = useApp()
  const [filter, setFilter] = useState<Filter>('ALL')

  const performances = useMemo(() => {
    // version 을 참조해 데이터 변경 시 재계산
    void version
    return api.listPerformances().filter((p) => p.status !== 'DRAFT')
  }, [version])

  const filtered = useMemo(() => {
    return performances.filter((p) => {
      if (filter === 'ALL') return true
      if (filter === 'UPCOMING') return !api.ticketOpened(p)
      if (filter === 'ON_SALE') return p.status === 'ON_SALE'
      if (filter === 'SOLD_OUT') return p.status === 'SOLD_OUT'
      return true
    })
  }, [performances, filter])

  const soldOutCount = performances.filter(
    (p: { status: PerformanceStatus }) => p.status === 'SOLD_OUT',
  ).length

  return (
    <div>
      {/* Hero */}
      <section className="border-b border-border bg-gradient-to-b from-accent/40 to-background">
        <div className="mx-auto max-w-6xl px-4 py-14 md:py-20">
          <div className="max-w-2xl space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              <Bell className="size-3.5 text-primary" />
              취소표 대기 알림 서비스
            </div>
            <h1 className="text-4xl font-bold leading-tight tracking-tight text-balance md:text-5xl">
              놓친 티켓, <span className="text-primary">취소표 대기</span>로 다시 잡으세요
            </h1>
            <p className="text-pretty text-muted-foreground md:text-lg">
              매진된 공연도 원하는 구역을 최대 3개까지 선택해 대기하세요. 취소표가 나오면 순서대로
              우선 예매 기회를 알려드립니다.
            </p>
            <div className="flex flex-wrap gap-6 pt-2">
              <div className="flex items-center gap-2">
                <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Ticket className="size-5" />
                </div>
                <div>
                  <p className="text-lg font-semibold leading-none">{performances.length}</p>
                  <p className="text-xs text-muted-foreground">진행 공연</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex size-9 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                  <TrendingUp className="size-5" />
                </div>
                <div>
                  <p className="text-lg font-semibold leading-none">{soldOutCount}</p>
                  <p className="text-xs text-muted-foreground">매진 · 대기 가능</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Performance list */}
      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-xl font-bold">공연 조회</h2>
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <Button
                key={f.key}
                size="sm"
                variant={filter === f.key ? 'default' : 'outline'}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
              </Button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="py-20 text-center text-muted-foreground">해당 조건의 공연이 없습니다.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {filtered.map((p) => (
              <PerformanceCard key={p.id} performance={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
