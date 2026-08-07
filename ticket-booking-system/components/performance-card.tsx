import Link from 'next/link'
import Image from 'next/image'
import { CalendarDays, MapPin } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { formatDate } from '@/lib/domain'
import type { RealPerformanceListItem } from '@/lib/performance-api'

export function PerformanceCard({ performance }: { performance: RealPerformanceListItem }) {
  return (
    <Link href={`/performances/${performance.performanceId}`} className="group block">
      <Card className="overflow-hidden p-0 transition-shadow hover:shadow-lg">
        <div className="relative aspect-[3/4] overflow-hidden bg-muted">
          <Image
            src={performance.postUrl || '/placeholder.svg'}
            alt={`${performance.title} 포스터`}
            fill
            sizes="(max-width: 768px) 50vw, 25vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </div>
        <CardContent className="space-y-2 p-4">
          <h3 className="line-clamp-2 font-semibold leading-snug text-balance">
            {performance.title}
          </h3>
          <div className="space-y-1 text-xs text-muted-foreground">
            <p className="flex items-center gap-1.5">
              <MapPin className="size-3.5 shrink-0" />
              {performance.hallName}
            </p>
            <p className="flex items-center gap-1.5">
              <CalendarDays className="size-3.5 shrink-0" />
              {formatDate(performance.startDate)} ~ {formatDate(performance.endDate)}
            </p>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
