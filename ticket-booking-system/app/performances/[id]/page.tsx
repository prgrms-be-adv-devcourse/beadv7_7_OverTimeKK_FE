import { PerformanceDetailClient } from './performance-detail-client'

export default async function PerformanceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <PerformanceDetailClient id={id} />
}
