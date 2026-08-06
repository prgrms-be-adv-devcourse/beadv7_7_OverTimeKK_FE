'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { XCircle } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { clearPendingPaymentLedger } from '@/lib/pending-payment'

function PaymentFailInner() {
  const params = useSearchParams()
  const code = params.get('code')
  const message = params.get('message')
  const paymentIdRaw = params.get('paymentId')

  if (paymentIdRaw) {
    clearPendingPaymentLedger(Number(paymentIdRaw))
  }

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-24 text-center">
      <XCircle className="size-12 text-destructive" />
      <h1 className="text-xl font-bold">결제가 취소되었거나 실패했습니다</h1>
      {message && (
        <p className="text-sm text-muted-foreground">
          {message}
          {code && <span className="ml-1 text-xs">({code})</span>}
        </p>
      )}
      <Link href="/" className={buttonVariants({ variant: 'outline' })}>
        홈으로
      </Link>
    </div>
  )
}

export default function PaymentFailPage() {
  return (
    <Suspense fallback={null}>
      <PaymentFailInner />
    </Suspense>
  )
}
