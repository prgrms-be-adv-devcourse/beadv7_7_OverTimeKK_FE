'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LogIn } from 'lucide-react'
import { useApp } from '@/lib/store'
import { userErrorMessage } from '@/lib/user-api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function LoginPage() {
  const router = useRouter()
  const { loginWithCredentials } = useApp()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!username.trim() || !password.trim()) {
      alert('아이디와 비밀번호를 입력해 주세요.')
      return
    }

    setSubmitting(true)
    try {
      await loginWithCredentials(username, password)
      router.push('/')
    } catch (e) {
      alert(userErrorMessage(e, '로그인에 실패했습니다. 백엔드 서버 상태를 확인해 주세요.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="mb-6 flex items-center gap-2">
          <LogIn className="size-5 text-primary" />
          <h1 className="text-xl font-bold">로그인</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="username">아이디</Label>
            <Input
              id="username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">비밀번호</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <Button type="submit" size="lg" className="w-full" disabled={submitting}>
            {submitting ? '로그인 중...' : '로그인'}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          계정이 없으신가요?{' '}
          <Link href="/signup" className="font-medium text-primary hover:underline">
            회원가입
          </Link>
        </p>
      </div>
    </div>
  )
}
