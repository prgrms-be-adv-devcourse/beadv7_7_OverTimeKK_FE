'use client'

import { useEffect, useState } from 'react'
import { Bell } from 'lucide-react'
import { PerformanceCard } from '@/components/performance-card'
import { Button } from '@/components/ui/button'
import { performanceApi } from '@/lib/performance-api'
import type { RealPerformanceListItem } from '@/lib/performance-api'

export default function HomePage() {
  const [page, setPage] = useState(1)
  const [pageCount, setPageCount] = useState(1)
  const [performances, setPerformances] = useState<RealPerformanceListItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    performanceApi
      .listPaged(page)
      .then((result) => {
        if (cancelled) return
        setPerformances(result.performances)
        setPageCount(Math.max(1, result.pageCount))
      })
      .catch(() => {
        if (!cancelled) {
          setPerformances([])
          setPageCount(1)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [page])

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
        </div>

        {loading ? (
          <p className="py-20 text-center text-muted-foreground">불러오는 중...</p>
        ) : performances.length === 0 ? (
          <p className="py-20 text-center text-muted-foreground">해당 조건의 공연이 없습니다.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              {performances.map((p) => (
                <PerformanceCard key={p.performanceId} performance={p} />
              ))}
            </div>

            {pageCount > 1 && (
              <div className="mt-8 flex items-center justify-center gap-1.5">
                <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(page - 1)}>
                  이전
                </Button>
                {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
                  <Button
                    key={n}
                    size="sm"
                    variant={n === page ? 'default' : 'outline'}
                    onClick={() => setPage(n)}
                  >
                    {n}
                  </Button>
                ))}
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page === pageCount}
                  onClick={() => setPage(page + 1)}
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
