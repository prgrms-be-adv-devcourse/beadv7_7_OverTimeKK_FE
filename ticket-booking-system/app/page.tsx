'use client'

import { useMemo, useState } from 'react'
import { Bell } from 'lucide-react'
import { PerformanceCard } from '@/components/performance-card'
import { Button } from '@/components/ui/button'
import { useApp } from '@/lib/store'
import { api } from '@/lib/api'

type Filter = 'ALL' | 'ON_SALE' | 'UPCOMING'

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'ALL', label: '전체' },
  { key: 'ON_SALE', label: '예매중' },
  { key: 'UPCOMING', label: '오픈예정' },
]

const PAGE_SIZE = 3

export default function HomePage() {
  const { version } = useApp()
  const [filter, setFilter] = useState<Filter>('ALL')
  const [page, setPage] = useState(1)

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
      return true
    })
  }, [performances, filter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const handleFilterChange = (f: Filter) => {
    setFilter(f)
    setPage(1)
  }

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
                onClick={() => handleFilterChange(f.key)}
              >
                {f.label}
              </Button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="py-20 text-center text-muted-foreground">해당 조건의 공연이 없습니다.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              {paged.map((p) => (
                <PerformanceCard key={p.id} performance={p} />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={currentPage === 1}
                  onClick={() => setPage(currentPage - 1)}
                >
                  이전
                </Button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                  <Button
                    key={n}
                    size="sm"
                    variant={n === currentPage ? 'default' : 'outline'}
                    onClick={() => setPage(n)}
                  >
                    {n}
                  </Button>
                ))}
                <Button
                  size="sm"
                  variant="outline"
                  disabled={currentPage === totalPages}
                  onClick={() => setPage(currentPage + 1)}
                >
                  다음
                </Button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  )
}
