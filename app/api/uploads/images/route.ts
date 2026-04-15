import { randomUUID } from "crypto"
import { NextResponse } from "next/server"
import { Client as MinioClient } from "minio"

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
const MAX_UPLOAD_SIZE_MB = Number(process.env.MAX_UPLOAD_IMAGE_SIZE_MB || "5")
const MAX_UPLOAD_SIZE_BYTES = MAX_UPLOAD_SIZE_MB * 1024 * 1024
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])

const minioClient = new MinioClient({
  endPoint: MINIO_ENDPOINT,
  port: MINIO_PORT,
  useSSL: MINIO_USE_SSL,
  accessKey: MINIO_ACCESS_KEY,
  secretKey: MINIO_SECRET_KEY,
})

let bucketReady: Promise<void> | null = null

async function ensureBucketReady() {
  if (bucketReady) return bucketReady

  bucketReady = (async () => {
    const exists = await minioClient.bucketExists(MINIO_BUCKET)
    if (!exists) {
      await minioClient.makeBucket(MINIO_BUCKET)
    }

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
  })()

  return bucketReady
}

function getSafeExt(fileName: string) {
  const idx = fileName.lastIndexOf(".")
  if (idx < 0) return "bin"
  return fileName.slice(idx + 1).toLowerCase().replace(/[^a-z0-9]/g, "") || "bin"
}

function sanitizeBlogId(rawBlogId: string) {
  return rawBlogId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) || "unknown"
}

export async function POST(request: Request) {
  try {
    await ensureBucketReady()

    const formData = await request.formData()
    const file = formData.get("file")
    const blogIdRaw = String(formData.get("blogId") || "")

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "缺少文件 file" }, { status: 400 })
    }
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      return NextResponse.json({ error: "仅支持 jpg / png / webp" }, { status: 400 })
    }
    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      return NextResponse.json({ error: `图片不能超过 ${MAX_UPLOAD_SIZE_MB}MB` }, { status: 400 })
    }

    const ext = getSafeExt(file.name || "")
    const blogId = sanitizeBlogId(blogIdRaw)
    const objectName = `blogs/${blogId}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${ext}`
    const fileBuffer = Buffer.from(await file.arrayBuffer())

    await minioClient.putObject(MINIO_BUCKET, objectName, fileBuffer, fileBuffer.length, {
      "Content-Type": file.type || "application/octet-stream",
    })

    const url = `${MINIO_PUBLIC_BASE_URL}/${objectName}`
    return NextResponse.json({ url })
  } catch (error) {
    console.error("上传图片到 MinIO 失败:", error)
    return NextResponse.json({ error: "上传失败" }, { status: 500 })
  }
}
