'use client'

import { use, useMemo } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, CalendarDays, Clock, MapPin, User } from 'lucide-react'
import { BookingPanel } from '@/components/booking-panel'
import { PerformanceStatusBadge } from '@/components/status-badges'
import { useApp } from '@/lib/store'
import { api } from '@/lib/api'
import { formatDate, formatDateTime } from '@/lib/domain'

export default function PerformanceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const { version, performancesLoaded } = useApp()

  const performance = useMemo(() => {
    void version
    return api.getPerformance(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, version])

  // 숫자 ID(실제 performance-service 공연)는 앱 시작 시 비동기로 불러오므로,
  // 그 fetch가 끝나기 전엔 "없는 공연"으로 단정하지 않고 기다린다 — 안 그러면
  // 직접 URL 진입/새로고침 시 실제로 존재하는 공연도 404로 잘못 처리된다.
  if (!performance) {
    if (/^\d+$/.test(id) && !performancesLoaded) {
      return null
    }
    return notFound()
  }

  const hall = api.listHalls().find((h) => h.id === performance.hallId)

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <Link
        href="/"
        className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        공연 목록
      </Link>

      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        {/* 좌측: 정보 */}
        <div>
          <div className="flex flex-col gap-6 sm:flex-row">
            <div className="relative aspect-[3/4] w-full shrink-0 overflow-hidden rounded-xl border border-border bg-muted sm:w-56">
              <Image
                src={performance.posterUrl || '/placeholder.svg'}
                alt={`${performance.title} 포스터`}
                fill
                sizes="224px"
                className="object-cover"
              />
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground">
                  {performance.category}
                </span>
                <PerformanceStatusBadge status={performance.status} />
              </div>
              <h1 className="text-2xl font-bold leading-tight text-balance md:text-3xl">
                {performance.title}
              </h1>
              <dl className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="size-4 shrink-0" />
                  <span>
                    {hall?.name} · {hall?.location}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CalendarDays className="size-4 shrink-0" />
                  <span>
                    {formatDate(performance.startDate)} ~ {formatDate(performance.endDate)}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="size-4 shrink-0" />
                  <span>러닝타임 {performance.runtime}분</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <User className="size-4 shrink-0" />
                  <span>티켓 오픈 {formatDateTime(performance.ticketOpenAt)}</span>
                </div>
              </dl>
            </div>
          </div>

          <div className="mt-8">
            <h2 className="mb-3 text-lg font-bold">공연 소개</h2>
            <p className="whitespace-pre-line text-pretty leading-relaxed text-muted-foreground">
              {performance.description}
            </p>
          </div>
        </div>

        {/* 우측: 예매 패널 */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <BookingPanel performance={performance} />
        </div>
      </div>
    </div>
  )
}
