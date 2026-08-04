import Link from 'next/link'
import { LogIn } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * 로그인이 필요한 화면에 authUser가 없을 때 보여주는 안내. Button의 asChild가 Base UI에서
 * 지원 안 돼서(CLAUDE.md 참고) Link에 buttonVariants 클래스를 직접 입힌다.
 */
export function LoginRequired({ message = '로그인이 필요합니다.' }: { message?: string }) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16 text-center">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
        <LogIn className="size-5" />
      </div>
      <p className="mt-4 text-sm text-muted-foreground">{message}</p>
      <Link href="/login" className={cn(buttonVariants({ size: 'default' }), 'mt-4')}>
        로그인하기
      </Link>
    </div>
  )
}
