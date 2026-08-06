'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { UserPlus } from 'lucide-react'
import { useApp } from '@/lib/store'
import { userErrorMessage } from '@/lib/user-api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

function validateCommon(username: string, email: string, password: string) {
  if (!username.trim()) return '아이디를 입력해 주세요.'
  if (!email.trim()) return '이메일을 입력해 주세요.'
  if (password.length < 8) return '비밀번호는 8자 이상이어야 합니다.'
  return null
}

export default function SignUpPage() {
  const router = useRouter()
  const { signUpIndividual, signUpBusiness } = useApp()

  const [individual, setIndividual] = useState({ username: '', email: '', password: '' })
  const [business, setBusiness] = useState({
    username: '',
    email: '',
    password: '',
    businessName: '',
    businessNumber: '',
  })
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmitIndividual(event: FormEvent) {
    event.preventDefault()
    const error = validateCommon(individual.username, individual.email, individual.password)
    if (error) {
      alert(error)
      return
    }
    setSubmitting(true)
    try {
      await signUpIndividual(individual)
      router.push('/')
    } catch (e) {
      alert(userErrorMessage(e, '회원가입에 실패했습니다. 백엔드 서버 상태를 확인해 주세요.'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSubmitBusiness(event: FormEvent) {
    event.preventDefault()
    const error = validateCommon(business.username, business.email, business.password)
    if (error) {
      alert(error)
      return
    }
    if (!business.businessName.trim() || !business.businessNumber.trim()) {
      alert('사업자명과 사업자번호를 입력해 주세요.')
      return
    }
    setSubmitting(true)
    try {
      await signUpBusiness(business)
      router.push('/')
    } catch (e) {
      alert(userErrorMessage(e, '회원가입에 실패했습니다. 백엔드 서버 상태를 확인해 주세요.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="mb-6 flex items-center gap-2">
          <UserPlus className="size-5 text-primary" />
          <h1 className="text-xl font-bold">회원가입</h1>
        </div>

        <Tabs defaultValue="individual">
          <TabsList className="w-full">
            <TabsTrigger value="individual" className="flex-1">
              개인
            </TabsTrigger>
            <TabsTrigger value="business" className="flex-1">
              사업자
            </TabsTrigger>
          </TabsList>

          <TabsContent value="individual">
            <form onSubmit={handleSubmitIndividual} className="mt-4 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="ind-username">아이디</Label>
                <Input
                  id="ind-username"
                  autoComplete="username"
                  value={individual.username}
                  onChange={(e) => setIndividual({ ...individual, username: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ind-email">이메일</Label>
                <Input
                  id="ind-email"
                  type="email"
                  autoComplete="email"
                  value={individual.email}
                  onChange={(e) => setIndividual({ ...individual, email: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ind-password">비밀번호</Label>
                <Input
                  id="ind-password"
                  type="password"
                  autoComplete="new-password"
                  value={individual.password}
                  onChange={(e) => setIndividual({ ...individual, password: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">8자 이상 입력해 주세요.</p>
              </div>

              <Button type="submit" size="lg" className="w-full" disabled={submitting}>
                {submitting ? '가입 중...' : '개인 회원가입'}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="business">
            <form onSubmit={handleSubmitBusiness} className="mt-4 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="biz-username">아이디</Label>
                <Input
                  id="biz-username"
                  autoComplete="username"
                  value={business.username}
                  onChange={(e) => setBusiness({ ...business, username: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="biz-email">이메일</Label>
                <Input
                  id="biz-email"
                  type="email"
                  autoComplete="email"
                  value={business.email}
                  onChange={(e) => setBusiness({ ...business, email: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="biz-password">비밀번호</Label>
                <Input
                  id="biz-password"
                  type="password"
                  autoComplete="new-password"
                  value={business.password}
                  onChange={(e) => setBusiness({ ...business, password: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">8자 이상 입력해 주세요.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="biz-name">사업자명</Label>
                <Input
                  id="biz-name"
                  value={business.businessName}
                  onChange={(e) => setBusiness({ ...business, businessName: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="biz-number">사업자번호</Label>
                <Input
                  id="biz-number"
                  value={business.businessNumber}
                  onChange={(e) => setBusiness({ ...business, businessNumber: e.target.value })}
                />
              </div>

              <Button type="submit" size="lg" className="w-full" disabled={submitting}>
                {submitting ? '가입 중...' : '사업자 회원가입'}
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          이미 계정이 있으신가요?{' '}
          <Link href="/login" className="font-medium text-primary hover:underline">
            로그인
          </Link>
        </p>
      </div>
    </div>
  )
}
