"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Save, Eye, Upload, X, Plus, Loader2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useToast } from "@/components/ui/use-toast"
import { blogAPI } from "@/lib/api"

export default function CreateBlogPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [isPreview, setIsPreview] = useState(false)

  const [formData, setFormData] = useState({
    title: "",
    content: "",
    destination: "",
    tags: [] as string[],
    images: [] as string[],
    status: "draft" as "draft" | "published",
  })

  const [newTag, setNewTag] = useState("")
  const [newImageUrl, setNewImageUrl] = useState("")

  const handleSubmit = async (status: "draft" | "published") => {
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
      const response = await blogAPI.createBlog(formData)
      console.log("response", response)

      toast({
        title: status === "published" ? "发布成功" : "保存成功",
        description: status === "published" ? "您的游记已发布" : "游记已保存为草稿",
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

  const addImage = () => {
    if (newImageUrl.trim() && !formData.images.includes(newImageUrl.trim())) {
      setFormData({
        ...formData,
        images: [...formData.images, newImageUrl.trim()],
      })
      setNewImageUrl("")
    }
  }

  const removeImage = (imageToRemove: string) => {
    setFormData({
      ...formData,
      images: formData.images.filter((img) => img !== imageToRemove),
    })
  }

  const formatContent = (content: string) => {
    return content.split("\n").map((line, index) => {
      if (line.startsWith("# ")) {
        return (
          <h1 key={index} className="text-3xl font-bold mt-8 mb-4 first:mt-0">
            {line.substring(2)}
          </h1>
        )
      }
      if (line.startsWith("## ")) {
        return (
          <h2 key={index} className="text-2xl font-semibold mt-6 mb-3">
            {line.substring(3)}
          </h2>
        )
      }
      if (line.startsWith("### ")) {
        return (
          <h3 key={index} className="text-xl font-medium mt-4 mb-2">
            {line.substring(4)}
          </h3>
        )
      }
      if (line.trim() === "") {
        return <br key={index} />
      }
      return (
        <p key={index} className="mb-4 leading-relaxed">
          {line}
        </p>
      )
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
            <Button onClick={() => handleSubmit("published")} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  发布中...
                </>
              ) : (
                "发布游记"
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
                        formatContent(formData.content)
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
                      <Textarea
                        id="content"
                        placeholder="分享您的旅行故事...

支持Markdown格式：
# 一级标题
## 二级标题
### 三级标题

普通段落文本..."
                        value={formData.content}
                        onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                        rows={20}
                        className="font-mono"
                      />
                      <p className="text-sm text-muted-foreground mt-2">支持Markdown格式，使用#创建标题</p>
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

            {/* 图片管理 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">图片</CardTitle>
                <CardDescription>添加旅行照片让游记更生动</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      placeholder="图片URL"
                      value={newImageUrl}
                      onChange={(e) => setNewImageUrl(e.target.value)}
                      onKeyPress={(e) => e.key === "Enter" && addImage()}
                    />
                    <Button size="sm" onClick={addImage}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {formData.images.map((image, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={image || "/placeholder.svg"}
                          alt={`图片 ${index + 1}`}
                          className="w-full h-24 object-cover rounded"
                        />
                        <Button
                          size="sm"
                          variant="destructive"
                          className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => removeImage(image)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  {formData.images.length === 0 && (
                    <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center">
                      <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">暂无图片</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* 发布设置 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">发布设置</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <Label>状态</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value: "draft" | "published") => setFormData({ ...formData, status: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">草稿</SelectItem>
                        <SelectItem value="published">发布</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
