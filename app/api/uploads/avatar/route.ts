import { randomUUID } from "crypto"
import { NextResponse } from "next/server"
import { Client as MinioClient } from "minio"
import { authenticateRequest } from "@/server/middleware/auth.middleware"

export const runtime = "nodejs"

const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || "127.0.0.1"
const MINIO_PORT = Number(process.env.MINIO_PORT || "9000")
const MINIO_USE_SSL = process.env.MINIO_USE_SSL === "true"
const MINIO_ACCESS_KEY = process.env.MINIO_ROOT_USER || "admin"
const MINIO_SECRET_KEY = process.env.MINIO_ROOT_PASSWORD || "12345678"
const MINIO_BUCKET = process.env.MINIO_BUCKET || "travel-assets"
const MINIO_PUBLIC_BASE_URL =
  process.env.NEXT_PUBLIC_MINIO_PUBLIC_BASE_URL ||
  `${MINIO_USE_SSL ? "https" : "http"}://${MINIO_ENDPOINT}:${MINIO_PORT}/${MINIO_BUCKET}`
const MAX_SIZE_BYTES = 5 * 1024 * 1024
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])

const minioClient = new MinioClient({
  endPoint: MINIO_ENDPOINT,
  port: MINIO_PORT,
  useSSL: MINIO_USE_SSL,
  accessKey: MINIO_ACCESS_KEY,
  secretKey: MINIO_SECRET_KEY,
})

async function ensureBucket() {
  const exists = await minioClient.bucketExists(MINIO_BUCKET)
  if (!exists) {
    await minioClient.makeBucket(MINIO_BUCKET)
    await minioClient.setBucketPolicy(
      MINIO_BUCKET,
      JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Principal: { AWS: ["*"] },
            Action: ["s3:GetObject"],
            Resource: [`arn:aws:s3:::${MINIO_BUCKET}/*`],
          },
        ],
      })
    )
  }
}

/** POST /api/uploads/avatar — 上传用户头像 */
export async function POST(request: Request) {
  try {
    const authResult = await authenticateRequest(request as any)
    if (!authResult.authenticated) return authResult.response!

    const userId = authResult.user?.id ?? authResult.payload?.userId
    if (!userId) {
      return NextResponse.json({ error: "无法获取用户信息" }, { status: 401 })
    }

    await ensureBucket()

    const formData = await request.formData()
    const file = formData.get("file")

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "缺少文件 file" }, { status: 400 })
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: "仅支持 jpg / png / webp" }, { status: 400 })
    }
    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json({ error: "图片不能超过 5MB" }, { status: 400 })
    }

    const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg"
    const safeUserId = String(userId).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64)
    const objectName = `avatars/${safeUserId}/${randomUUID()}.${ext}`
    const buffer = Buffer.from(await file.arrayBuffer())

    await minioClient.putObject(MINIO_BUCKET, objectName, buffer, buffer.length, {
      "Content-Type": file.type,
    })

    const url = `${MINIO_PUBLIC_BASE_URL}/${objectName}`
    return NextResponse.json({ url })
  } catch (error) {
    console.error("上传头像失败:", error)
    return NextResponse.json({ error: "上传失败" }, { status: 500 })
  }
}
