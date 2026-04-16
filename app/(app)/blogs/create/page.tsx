"use client"

import "@wangeditor-next/editor/dist/css/style.css"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Save, Eye, X, Plus, Loader2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useToast } from "@/components/ui/use-toast"
import { blogAPI } from "@/lib/api"
import { useUserStore } from "@/lib/store/user-store"

type WangEditorModule = typeof import("@wangeditor-next/editor-for-react")

export default function CreateBlogPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { user } = useUserStore()
  const [uploadBlogId] = useState(() => `draft-${Math.random().toString(36).slice(2, 10)}`)
  const [isLoading, setIsLoading] = useState(false)
  const [isPreview, setIsPreview] = useState(false)
  const [editor, setEditor] = useState<any>(null)
  const [isClient, setIsClient] = useState(false)
  const [wangModule, setWangModule] = useState<WangEditorModule | null>(null)

  const [formData, setFormData] = useState({
    title: "",
    content: "",
    destination: "",
    tags: [] as string[],
    images: [] as string[],
    status: "draft" as "draft" | "published",
  })

  const [newTag, setNewTag] = useState("")
  const maxUploadSizeMb = 5
  const maxUploadSizeBytes = maxUploadSizeMb * 1024 * 1024
  const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"])
  const toolbarConfig = {}
  const editorConfig: any = {
    placeholder: "请输入游记内容...",
    MENU_CONF: {
      uploadImage: {
        async customUpload(file: File, insertFn: (url: string, alt?: string, href?: string) => void) {
          if (!allowedImageTypes.has(file.type)) {
            toast({
              title: "图片格式不支持",
              description: "仅支持 jpg / png / webp",
              variant: "destructive",
            })
            throw new Error("图片格式不支持")
          }
          if (file.size > maxUploadSizeBytes) {
            toast({
              title: "图片过大",
              description: `单张图片不能超过 ${maxUploadSizeMb}MB`,
              variant: "destructive",
            })
            throw new Error("图片过大")
          }

          const formData = new FormData()
          formData.append("file", file)
          formData.append("blogId", uploadBlogId)

          const res = await fetch("/api/uploads/images", {
            method: "POST",
            body: formData,
          })

          if (!res.ok) {
            const err = await res.json().catch(() => null)
            throw new Error(err?.error || "上传图片失败")
          }

          const data = await res.json()
          if (!data?.url) {
            throw new Error("图片地址无效")
          }

          insertFn(data.url, file.name, data.url)
          toast({
            title: "图片上传成功",
            description: "已插入到正文中",
          })
        },
      },
    },
  }

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    if (!isClient) return

    let isMounted = true
    import("@wangeditor-next/editor-for-react")
      .then((mod) => {
        if (isMounted) {
          setWangModule(mod)
        }
      })
      .catch((error) => {
        console.error("加载富文本编辑器失败", error)
      })

    return () => {
      isMounted = false
    }
  }, [isClient])

  useEffect(() => {
    return () => {
      if (editor == null) return
      editor.destroy()
      setEditor(null)
    }
  }, [editor])

  const handleSubmit = async (submitStatus: "draft" | "pending") => {
    if (!formData.title.trim() || !formData.content.trim()) {
      toast({
        title: "请填写必要信息",
        description: "标题和内容不能为空",
        variant: "destructive",
      })
      return
    }

    try {
      setIsLoading(true)
      const payload = {
        ...formData,
        status: submitStatus,
        userId: user?.id ?? "",
        author: {
          name: user?.name ?? "",
          avatar: user?.avatar ?? "",
        },
      }
      const response = await blogAPI.createBlog(payload)
      console.log("response", response)

      toast({
        title: submitStatus === "pending" ? "已提交审核" : "保存成功",
        description: submitStatus === "pending" ? "游记已提交，等待管理员审核后将公开发布" : "游记已保存为草稿",
      })

      router.push("/blogs")
    } catch (error) {
      toast({
        title: "操作失败",
        description: "请稍后再试",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData({
        ...formData,
        tags: [...formData.tags, newTag.trim()],
      })
      setNewTag("")
    }
  }

  const removeTag = (tagToRemove: string) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter((tag) => tag !== tagToRemove),
    })
  }

  return (
    <div className="w-full py-8">
      <div className="max-w-4xl mx-auto">
        {/* 头部 */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" asChild>
              <Link href="/blogs">
                <ArrowLeft className="h-4 w-4 mr-2" />
                返回
              </Link>
            </Button>
            <h1 className="text-3xl font-bold">写游记</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setIsPreview(!isPreview)}>
              <Eye className="h-4 w-4 mr-2" />
              {isPreview ? "编辑" : "预览"}
            </Button>
            <Button variant="outline" onClick={() => handleSubmit("draft")} disabled={isLoading}>
              <Save className="h-4 w-4 mr-2" />
              保存草稿
            </Button>
            <Button onClick={() => handleSubmit("pending")} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  提交中...
                </>
              ) : (
                "提交审核"
              )}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 主编辑区 */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>{isPreview ? "预览" : "编辑游记"}</CardTitle>
                <CardDescription>{isPreview ? "查看游记的最终效果" : "分享您的旅行故事"}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {isPreview ? (
                  /* 预览模式 */
                  <div>
                    <h1 className="text-3xl font-bold mb-4">{formData.title || "游记标题"}</h1>
                    <div className="flex items-center gap-4 mb-6 text-muted-foreground">
                      <span>目的地: {formData.destination || "未设置"}</span>
                    </div>
                    {formData.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-6">
                        {formData.tags.map((tag) => (
                          <Badge key={tag} variant="secondary">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                    <div className="prose prose-lg max-w-none">
                      {formData.content ? (
                        <div dangerouslySetInnerHTML={{ __html: formData.content }} />
                      ) : (
                        <p className="text-muted-foreground">游记内容将在这里显示...</p>
                      )}
                    </div>
                  </div>
                ) : (
                  /* 编辑模式 */
                  <>
                    <div>
                      <Label htmlFor="title">游记标题 *</Label>
                      <Input
                        id="title"
                        placeholder="给您的游记起个吸引人的标题"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      />
                    </div>

                    <div>
                      <Label htmlFor="destination">目的地</Label>
                      <Input
                        id="destination"
                        placeholder="例如：东京, 日本"
                        value={formData.destination}
                        onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                      />
                    </div>

                    <div>
                      <Label htmlFor="content">游记内容 *</Label>
                      <div className="mt-2 border rounded-md overflow-hidden">
                        {isClient && wangModule ? (
                          <>
                            <wangModule.Toolbar
                              editor={editor}
                              defaultConfig={toolbarConfig}
                              mode="default"
                              style={{ borderBottom: "1px solid #e5e7eb" }}
                            />
                            <wangModule.Editor
                              defaultConfig={editorConfig}
                              value={formData.content}
                              onCreated={setEditor}
                              onChange={(currentEditor) =>
                                setFormData({
                                  ...formData,
                                  content: currentEditor.getHtml(),
                                })
                              }
                              mode="default"
                              style={{ height: "500px", overflowY: "auto" }}
                            />
                          </>
                        ) : (
                          <div className="h-[500px] flex items-center justify-center text-sm text-muted-foreground">
                            编辑器加载中...
                          </div>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-2">支持富文本编辑</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* 侧边栏 */}
          <div className="space-y-6">
            {/* 标签管理 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">标签</CardTitle>
                <CardDescription>添加相关标签帮助其他人发现您的游记</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      placeholder="添加标签"
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyPress={(e) => e.key === "Enter" && addTag()}
                    />
                    <Button size="sm" onClick={addTag}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {formData.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                        {tag}
                        <X className="h-3 w-3 cursor-pointer" onClick={() => removeTag(tag)} />
                      </Badge>
                    ))}
                  </div>
                  {formData.tags.length === 0 && <p className="text-sm text-muted-foreground">暂无标签</p>}
                </div>
              </CardContent>
            </Card>

            {/* 发布说明 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">发布说明</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  点击「提交审核」后，游记将进入审核队列，管理员审核通过后才会公开展示。
                  <br /><br />
                  点击「保存草稿」仅自己可见，随时可继续编辑。
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
