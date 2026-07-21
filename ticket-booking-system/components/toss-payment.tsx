'use client'

import { useState } from 'react'
import { Loader2, ShieldCheck, CreditCard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatKRW } from '@/lib/domain'
import { cn } from '@/lib/utils'

const METHODS = [
  { key: '토스페이', label: '토스페이' },
  { key: '신용/체크카드', label: '카드' },
  { key: '계좌이체', label: '계좌이체' },
  { key: '휴대폰결제', label: '휴대폰' },
]

/**
 * 토스 PG 결제 위젯 시뮬레이션.
 * 실제 연동 시 이 컴포넌트를 토스 결제창(@tosspayments/payment-sdk) 호출로 교체합니다.
 */
export function TossPayment({
  amount,
  onApproved,
  submitLabel = '결제하기',
}: {
  amount: number
  onApproved: (method: string) => void
  submitLabel?: string
}) {
  const [method, setMethod] = useState(METHODS[0].key)
  const [processing, setProcessing] = useState(false)

  function handlePay() {
    setProcessing(true)
    // PG 결제 승인 지연 시뮬레이션
    setTimeout(() => {
      setProcessing(false)
      onApproved(method)
    }, 1200)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/50 px-3 py-2 text-xs text-muted-foreground">
        <ShieldCheck className="size-4 text-success" />
        토스페이먼츠로 안전하게 결제됩니다 (테스트 결제)
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">결제 수단</p>
        <div className="grid grid-cols-2 gap-2">
          {METHODS.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setMethod(m.key)}
              className={cn(
                'rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors',
                method === m.key
                  ? 'border-primary bg-primary/5 text-foreground'
                  : 'border-border text-muted-foreground hover:border-primary/40',
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-border pt-3">
        <span className="text-sm text-muted-foreground">최종 결제금액</span>
        <span className="text-lg font-bold">{formatKRW(amount)}</span>
      </div>

      <Button className="w-full" size="lg" onClick={handlePay} disabled={processing}>
        {processing ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            결제 승인 중...
          </>
        ) : (
          <>
            <CreditCard className="size-4" />
            {formatKRW(amount)} {submitLabel}
          </>
        )}
      </Button>
    </div>
  )
}
