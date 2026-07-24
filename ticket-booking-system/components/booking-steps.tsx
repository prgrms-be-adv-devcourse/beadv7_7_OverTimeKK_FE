import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

/** 멜론티켓 스타일 예매 단계 표시줄 (STEP1 좌석선택 > STEP2 가격선택 > STEP3 결제) */
export function BookingSteps({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs font-medium">
      {steps.map((label, idx) => (
        <div key={label} className="flex items-center gap-1.5">
          <span
            className={cn(
              'rounded-full px-2.5 py-1',
              idx === current
                ? 'bg-primary text-primary-foreground'
                : idx < current
                  ? 'bg-success/15 text-success'
                  : 'bg-muted text-muted-foreground',
            )}
          >
            STEP{idx + 1} {label}
          </span>
          {idx < steps.length - 1 && <ChevronRight className="size-3.5 text-muted-foreground" />}
        </div>
      ))}
    </div>
  )
}
