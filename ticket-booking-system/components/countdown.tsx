'use client'

import { useEffect, useState } from 'react'

function diffParts(target: number) {
  const total = Math.max(0, target - Date.now())
  const sec = Math.floor(total / 1000)
  return {
    total,
    days: Math.floor(sec / 86400),
    hours: Math.floor((sec % 86400) / 3600),
    minutes: Math.floor((sec % 3600) / 60),
    seconds: sec % 60,
  }
}

interface CountdownProps {
  /** 목표 시각 (ms epoch) */
  target: number
  /** 0 이 되면 호출 */
  onComplete?: () => void
  className?: string
}

/** 티켓 오픈까지 남은 시간 (일/시/분/초) */
export function Countdown({ target, onComplete, className }: CountdownProps) {
  const [parts, setParts] = useState(() => diffParts(target))

  useEffect(() => {
    const id = setInterval(() => {
      const next = diffParts(target)
      setParts(next)
      if (next.total <= 0) {
        clearInterval(id)
        onComplete?.()
      }
    }, 1000)
    return () => clearInterval(id)
  }, [target, onComplete])

  const cell = (value: number, label: string) => (
    <div className="flex flex-col items-center">
      <span className="min-w-10 rounded-md bg-primary/10 px-2 py-1.5 text-center text-lg font-bold tabular-nums text-primary">
        {String(value).padStart(2, '0')}
      </span>
      <span className="mt-1 text-[10px] text-muted-foreground">{label}</span>
    </div>
  )

  return (
    <div className={className}>
      <div className="flex items-center gap-1.5">
        {parts.days > 0 && cell(parts.days, '일')}
        {cell(parts.hours, '시')}
        {cell(parts.minutes, '분')}
        {cell(parts.seconds, '초')}
      </div>
    </div>
  )
}

/** 우선예매 결제 마감용 컴팩트 타이머 (mm:ss) */
export function PaymentTimer({
  target,
  onExpire,
  className,
}: {
  target: number
  onExpire?: () => void
  className?: string
}) {
  const [remaining, setRemaining] = useState(() => Math.max(0, target - Date.now()))

  useEffect(() => {
    const id = setInterval(() => {
      const next = Math.max(0, target - Date.now())
      setRemaining(next)
      if (next <= 0) {
        clearInterval(id)
        onExpire?.()
      }
    }, 250)
    return () => clearInterval(id)
  }, [target, onExpire])

  const sec = Math.ceil(remaining / 1000)
  const mm = String(Math.floor(sec / 60)).padStart(2, '0')
  const ss = String(sec % 60).padStart(2, '0')
  const urgent = remaining <= 60_000

  return (
    <span
      className={`tabular-nums font-bold ${urgent ? 'text-destructive' : 'text-warning-foreground'} ${className ?? ''}`}
    >
      {mm}:{ss}
    </span>
  )
}
