import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { NextRequest, NextResponse } from 'next/server'

const client = new S3Client({
  region: process.env.AWS_REGION || 'ap-northeast-2',
  credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
    ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      }
    : undefined,
})

export async function POST(request: NextRequest) {
  try {
    const { fileName, contentType } = await request.json()
    const bucket = process.env.AWS_S3_BUCKET

    if (!bucket) {
      return NextResponse.json(
        { error: 'AWS_S3_BUCKET 환경 변수가 설정되지 않았습니다.' },
        { status: 500 },
      )
    }

    const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
    const key = `performances/${Date.now()}-${safeFileName}`

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType || 'application/octet-stream',
    })

    const uploadUrl = await getSignedUrl(client, command, { expiresIn: 60 })
    const publicUrl = `https://${bucket}.s3.${process.env.AWS_REGION || 'ap-northeast-2'}.amazonaws.com/${key}`

    return NextResponse.json({ uploadUrl, publicUrl })
  } catch (error) {
    console.error('S3 presigned URL generation failed:', error)
    return NextResponse.json(
      { error: 'S3 presigned URL 생성에 실패했습니다.' },
      { status: 500 },
    )
  }
}
