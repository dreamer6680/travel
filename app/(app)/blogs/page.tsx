"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Heart,
  MessageCircle,
  Share2,
  Search,
  Filter,
  Calendar,
  MapPin,
  Eye,
  Plus,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { useToast } from "@/components/ui/use-toast";
import { blogAPI } from "@/lib/api";

interface Blog {
  id: string;
  userId: string;
  title: string;
  content: string;
  images?: string[];
  destination: string;
  tags?: string[];
  likes: number;
  likedBy?: string[];
  comments?: {
    id: string;
    userId: string;
    userName: string;
    userAvatar: string;
    content: string;
    createdAt: string;
  }[];
  author?: {
    name: string;
    avatar: string;
  };
  status: "draft" | "published";
  createdAt: string;
  updatedAt: string;
}

/** Strip HTML tags and return plain-text preview */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export default function BlogsPage() {
  const { toast } = useToast();
  const [blogs, setBlogs] = useState<Blog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState("all");

  useEffect(() => {
    fetchBlogs();
  }, []);

  const fetchBlogs = async () => {
    try {
      setIsLoading(true);
      const data = await blogAPI.getBlogs();
      setBlogs(data);
    } catch (error) {
      toast({
        title: "加载失败",
        description: "无法加载游记，请稍后再试",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLike = async (blogId: string) => {
    setBlogs(
      blogs.map((blog) => {
        if (blog.id !== blogId) return blog;
        const likedBy = blog.likedBy ?? [];
        const isLiked = likedBy.includes("currentUser");
        return {
          ...blog,
          likes: isLiked ? blog.likes - 1 : blog.likes + 1,
          likedBy: isLiked
            ? likedBy.filter((id) => id !== "currentUser")
            : [...likedBy, "currentUser"],
        };
      })
    );
  };

  // 获取所有标签
  const allTags = Array.from(
    new Set(blogs.flatMap((blog) => blog.tags ?? []))
  );

  // 筛选游记
  const filteredBlogs = blogs.filter((blog) => {
    const tags = blog.tags ?? [];
    const plainContent = stripHtml(blog.content);
    const matchesSearch =
      blog.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (blog.destination ?? "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      plainContent.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTag = selectedTag === "all" || tags.includes(selectedTag);
    return matchesSearch && matchesTag && blog.status === "published";
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const truncateContent = (content: string, maxLength = 150) => {
    const plain = stripHtml(content);
    if (plain.length <= maxLength) return plain;
    return plain.substring(0, maxLength) + "...";
  };

  if (isLoading) {
    return (
      <div className="w-full py-8 flex justify-center items-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-lg">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full py-8">
      <div className="max-w-6xl mx-auto">
        {/* 页面头部 */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold">旅行游记</h1>
            <p className="text-muted-foreground">
              分享您的旅行故事，发现他人的精彩旅程
            </p>
          </div>
          <Button asChild>
            <Link href="/blogs/create">
              <Plus className="h-4 w-4 mr-2" />
              写游记
            </Link>
          </Button>
        </div>

        {/* 搜索和筛选 */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索游记、目的地..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={selectedTag === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedTag("all")}
            >
              全部
            </Button>
            {allTags.slice(0, 6).map((tag) => (
              <Button
                key={tag}
                variant={selectedTag === tag ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedTag(tag)}
              >
                {tag}
              </Button>
            ))}
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* 游记列表 */}
        {filteredBlogs.length === 0 ? (
          <div className="text-center py-12">
            <MessageCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">暂无游记</h3>
            <p className="text-muted-foreground mb-4">
              还没有找到符合条件的游记
            </p>
            <Button asChild>
              <Link href="/blogs/create">
                <Plus className="h-4 w-4 mr-2" />
                写第一篇游记
              </Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {filteredBlogs.map((blog) => {
              const tags = blog.tags ?? [];
              const images = blog.images ?? [];
              const likedBy = blog.likedBy ?? [];
              const comments = blog.comments ?? [];
              return (
                <Card
                  key={blog.id}
                  className="overflow-hidden hover:shadow-lg transition-shadow"
                >
                  {/* 游记图片 */}
                  {images.length > 0 && (
                    <div className="h-48 bg-muted flex items-center justify-center overflow-hidden">
                      <img
                        src={images[0]}
                        alt={blog.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <CardTitle className="text-xl mb-2 line-clamp-2">
                          <Link
                            href={`/blogs/${blog.id}`}
                            className="hover:text-primary"
                          >
                            {blog.title}
                          </Link>
                        </CardTitle>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          {blog.destination && (
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {blog.destination}
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(blog.createdAt)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-0">
                    {/* 作者信息 */}
                    <div className="flex items-center gap-2 mb-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={blog.author?.avatar ?? "/placeholder.svg"} />
                        <AvatarFallback>
                          {blog.author?.name?.charAt(0) ?? "?"}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium">
                        {blog.author?.name ?? "匿名作者"}
                      </span>
                    </div>

                    {/* 游记内容预览 */}
                    <p className="text-muted-foreground mb-4 line-clamp-3">
                      {truncateContent(blog.content)}
                    </p>

                    {/* 标签 */}
                    {tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-4">
                        {tags.slice(0, 3).map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                        {tags.length > 3 && (
                          <Badge variant="secondary" className="text-xs">
                            +{tags.length - 3}
                          </Badge>
                        )}
                      </div>
                    )}

                    <Separator className="mb-4" />

                    {/* 互动按钮 */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleLike(blog.id)}
                          className={
                            likedBy.includes("currentUser") ? "text-red-500" : ""
                          }
                        >
                          <Heart
                            className={`h-4 w-4 mr-1 ${
                              likedBy.includes("currentUser") ? "fill-current" : ""
                            }`}
                          />
                          {blog.likes}
                        </Button>
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/blogs/${blog.id}`}>
                            <MessageCircle className="h-4 w-4 mr-1" />
                            {comments.length}
                          </Link>
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Share2 className="h-4 w-4 mr-1" />
                          分享
                        </Button>
                      </div>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/blogs/${blog.id}`}>
                          <Eye className="h-4 w-4 mr-1" />
                          阅读全文
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
