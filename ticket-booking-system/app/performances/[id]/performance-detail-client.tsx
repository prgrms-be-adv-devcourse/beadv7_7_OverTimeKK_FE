'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, CalendarDays, Clock, MapPin, User } from 'lucide-react'
import { BookingPanel } from '@/components/booking-panel'
import { PerformanceStatusBadge } from '@/components/status-badges'
import { useApp } from '@/lib/store'
import { api } from '@/lib/api'
import { venueApi } from '@/lib/venue-api'
import { performanceApi, type RealPerformance } from '@/lib/performance-api'
import { formatDate, formatDateTime } from '@/lib/domain'

export function PerformanceDetailClient({ id }: { id: string }) {
  const { version, performancesLoaded } = useApp()

  // performance-service/v2로 등록된 실제 공연은 숫자 ID를 그대로 쓴다(mock은 'p_xxx' 형태)
  const isRealPerformance = /^\d+$/.test(id)

  const performance = useMemo(() => {
    void version
    return api.getPerformance(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, version])

  // 실 공연은 상세 페이지에 필요한 정보(제목/설명/러닝타임/기간/티켓오픈시각/포스터)를
  // GET /api/performances/detail/{id}에서 직접 새로 받아온다. mock db 병합은 앱 시작 시
  // 한 번만 이뤄지는데, 포스터(postUrl)는 발급 후 30분이면 만료되는 presigned URL이라
  // 병합 시점 스냅샷을 그대로 쓰면 안 된다 — 페이지 방문마다 새로 조회해야 한다.
  const [realDetail, setRealDetail] = useState<RealPerformance | null>(null)
  useEffect(() => {
    if (!isRealPerformance) {
      setRealDetail(null)
      return
    }
    let cancelled = false
    setRealDetail(null)
    performanceApi
      .get(Number(id))
      .then((result) => {
        if (!cancelled) setRealDetail(result)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [id, isRealPerformance])

  // 실 공연이고 상세 조회가 끝났으면 그 값으로 화면 표기를 덮어쓴다. status/category/sellerId는
  // 이 API에 없는 필드라 mock(merge) 값을 그대로 유지한다.
  const displayPerformance = useMemo(() => {
    if (!performance || !isRealPerformance || !realDetail) return performance
    return {
      ...performance,
      title: realDetail.title,
      description: realDetail.description,
      runtime: realDetail.runtime,
      startDate: realDetail.startDate,
      endDate: realDetail.endDate,
      ticketOpenAt: realDetail.ticketOpenAt,
      hallId: String(realDetail.hallId),
      posterUrl: realDetail.postUrl,
    }
  }, [performance, isRealPerformance, realDetail])

  // hall 이름 조회("단건 조회" API가 없어 전체 캐시에서 찾음) — hook이라 조건부 return보다
  // 먼저 호출해야 한다.
  const [hallName, setHallName] = useState<string | null>(null)
  useEffect(() => {
    if (!displayPerformance) return
    let cancelled = false
    venueApi
      .hallDirectory()
      .then((directory) => {
        if (!cancelled) setHallName(directory.get(Number(displayPerformance.hallId))?.hallName ?? null)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [displayPerformance])

  // 숫자 ID(실제 performance-service 공연)는 앱 시작 시 비동기로 불러오므로,
  // 그 fetch가 끝나기 전엔 "없는 공연"으로 단정하지 않고 기다린다 — 안 그러면
  // 직접 URL 진입/새로고침 시 실제로 존재하는 공연도 404로 잘못 처리된다.
  if (!performance || !displayPerformance) {
    if (isRealPerformance && !performancesLoaded) {
      return null
    }
    return notFound()
  }

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
                src={displayPerformance.posterUrl || '/placeholder.svg'}
                alt={`${displayPerformance.title} 포스터`}
                fill
                sizes="224px"
                className="object-cover"
              />
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground">
                  {displayPerformance.category}
                </span>
                <PerformanceStatusBadge status={displayPerformance.status} />
              </div>
              <h1 className="text-2xl font-bold leading-tight text-balance md:text-3xl">
                {displayPerformance.title}
              </h1>
              <dl className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="size-4 shrink-0" />
                  <span>
                    {hallName ?? '공연장 정보 불러오는 중...'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CalendarDays className="size-4 shrink-0" />
                  <span>
                    {formatDate(displayPerformance.startDate)} ~ {formatDate(displayPerformance.endDate)}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="size-4 shrink-0" />
                  <span>러닝타임 {displayPerformance.runtime}분</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <User className="size-4 shrink-0" />
                  <span>티켓 오픈 {formatDateTime(displayPerformance.ticketOpenAt)}</span>
                </div>
              </dl>
            </div>
          </div>

          <div className="mt-8">
            <h2 className="mb-3 text-lg font-bold">공연 소개</h2>
            <p className="whitespace-pre-line text-pretty leading-relaxed text-muted-foreground">
              {displayPerformance.description}
            </p>
          </div>
        </div>

        {/* 우측: 예매 패널 */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <BookingPanel performance={displayPerformance} />
        </div>
      </div>
    </div>
  )
}
