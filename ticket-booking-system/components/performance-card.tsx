'use client'

import Link from 'next/link'
import Image from 'next/image'
import { CalendarDays, MapPin, Clock } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { PerformanceStatusBadge } from '@/components/status-badges'
import { formatDate, formatKRW } from '@/lib/domain'
import { api } from '@/lib/api'
import type { Performance } from '@/lib/types'

export function PerformanceCard({ performance }: { performance: Performance }) {
  const hall = api.listHalls().find((h) => h.id === performance.hallId)
  const prices = api.listZonePrices(performance.id)
  const minPrice = prices.length > 0 ? Math.min(...prices.map((p) => p.price)) : 0

  return (
    <Link href={`/performances/${performance.id}`} className="group block">
      <Card className="overflow-hidden p-0 transition-shadow hover:shadow-lg">
        <div className="relative aspect-[3/4] overflow-hidden bg-muted">
          <Image
            src={performance.posterUrl || '/placeholder.svg'}
            alt={`${performance.title} 포스터`}
            fill
            sizes="(max-width: 768px) 50vw, 25vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <div className="absolute left-2 top-2">
            <PerformanceStatusBadge status={performance.status} />
          </div>
        </div>
        <CardContent className="space-y-2 p-4">
          <p className="text-xs font-medium text-muted-foreground">{performance.category}</p>
          <h3 className="line-clamp-2 font-semibold leading-snug text-balance">
            {performance.title}
          </h3>
          <div className="space-y-1 text-xs text-muted-foreground">
            <p className="flex items-center gap-1.5">
              <MapPin className="size-3.5 shrink-0" />
              {hall?.name ?? '미정'}
            </p>
            <p className="flex items-center gap-1.5">
              <CalendarDays className="size-3.5 shrink-0" />
              {formatDate(performance.startDate)} ~ {formatDate(performance.endDate)}
            </p>
            <p className="flex items-center gap-1.5">
              <Clock className="size-3.5 shrink-0" />
              {performance.runtime}분
            </p>
          </div>
          {minPrice > 0 && (
            <p className="pt-1 text-sm font-semibold">
              {formatKRW(minPrice)}
              <span className="font-normal text-muted-foreground"> ~</span>
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}
