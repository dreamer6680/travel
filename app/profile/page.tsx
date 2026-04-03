"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Checkbox } from "@/components/ui/checkbox"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { User, Camera, MapPin, Calendar, Globe, Bell, Shield, Loader2, Save } from "lucide-react"
import { userAPI } from "@/lib/api"
import { useToast } from "@/components/ui/use-toast"

// 定义用户类型
interface UserProfile {
  id: string
  name: string
  email: string
  avatar: string
  phone: string
  location: string
  bio: string
  joinDate: string
  preferences: {
    budget: number
    travelStyle: string
    favoriteDestinations: string[]
    interests: string[]
    seasons: string[]
    accommodationType: string
    transportationPreference: string
  }
  settings: {
    notifications: {
      email: boolean
      push: boolean
      sms: boolean
    }
    privacy: {
      profileVisible: boolean
      tripsVisible: boolean
    }
    language: string
    currency: string
  }
  stats: {
    totalTrips: number
    countriesVisited: number
    totalDistance: number
    favoriteDestination: string
  }
}

export default function ProfilePage() {
  const { toast } = useToast()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // 获取用户资料
  useEffect(() => {
    async function fetchProfile() {
      try {
        setIsLoading(true)
        const data = await userAPI.getProfile()
        setProfile(data)
      } catch (error) {
        console.error("获取用户资料失败:", error)
        toast({
          title: "获取用户资料失败",
          description: "请稍后再试",
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchProfile()
  }, [toast])

  // 更新用户资料
  const handleSaveProfile = async (updatedData: Partial<UserProfile>) => {
    if (!profile) return

    try {
      setIsSaving(true)
      const savedProfile = await userAPI.updateProfile(updatedData)
      setProfile(savedProfile)
      toast({
        title: "保存成功",
        description: "您的资料已更新",
      })
    } catch (error) {
      console.error("保存用户资料失败:", error)
      toast({
        title: "保存失败",
        description: "请稍后再试",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="container py-8 flex justify-center items-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-lg">正在加载用户资料...</p>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="container py-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-red-500">加载失败</CardTitle>
          </CardHeader>
          <CardContent>
            <p>无法加载用户资料，请稍后再试。</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container py-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">个人设置</h1>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid grid-cols-4">
            <TabsTrigger value="profile">基本信息</TabsTrigger>
            <TabsTrigger value="preferences">旅行偏好</TabsTrigger>
            <TabsTrigger value="notifications">通知设置</TabsTrigger>
            <TabsTrigger value="privacy">隐私安全</TabsTrigger>
          </TabsList>

          {/* 基本信息 */}
          <TabsContent value="profile">
            <div className="space-y-6">
              <ProfileInfoCard profile={profile} onSave={handleSaveProfile} isSaving={isSaving} />
              <StatsCard stats={profile.stats} />
            </div>
          </TabsContent>

          {/* 旅行偏好 */}
          <TabsContent value="preferences">
            <PreferencesCard
              preferences={profile.preferences}
              onSave={(preferences) => handleSaveProfile({ preferences })}
              isSaving={isSaving}
            />
          </TabsContent>

          {/* 通知设置 */}
          <TabsContent value="notifications">
            <NotificationsCard
              settings={profile.settings}
              onSave={(settings) => handleSaveProfile({ settings })}
              isSaving={isSaving}
            />
          </TabsContent>

          {/* 隐私安全 */}
          <TabsContent value="privacy">
            <PrivacyCard
              settings={profile.settings}
              onSave={(settings) => handleSaveProfile({ settings })}
              isSaving={isSaving}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

function ProfileInfoCard({
  profile,
  onSave,
  isSaving,
}: {
  profile: UserProfile
  onSave: (data: Partial<UserProfile>) => void
  isSaving: boolean
}) {
  const [formData, setFormData] = useState({
    name: profile.name,
    email: profile.email,
    phone: profile.phone,
    location: profile.location,
    bio: profile.bio,
  })

  useEffect(() => {
    setFormData({
      name: profile.name,
      email: profile.email,
      phone: profile.phone,
      location: profile.location,
      bio: profile.bio,
    })
  }, [profile])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
  }

  const formatJoinDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("zh-CN", { year: "numeric", month: "long" })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          基本信息
        </CardTitle>
        <CardDescription>管理您的个人资料信息</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-6">
          {/* 头像部分 */}
          <div className="flex items-center gap-6">
            <Avatar className="h-24 w-24">
              <AvatarImage src={profile.avatar || "/placeholder.svg"} alt={profile.name} />
              <AvatarFallback className="text-lg">{profile.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div>
              <Button variant="outline" size="sm">
                <Camera className="h-4 w-4 mr-2" />
                更换头像
              </Button>
              <p className="text-sm text-muted-foreground mt-2">支持 JPG、PNG 格式，最大 5MB</p>
            </div>
          </div>

          <Separator />

          {/* 基本信息表单 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="name">姓名</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">邮箱</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">手机号</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">所在地</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bio">个人简介</Label>
            <Textarea
              id="bio"
              value={formData.bio}
              onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
              rows={3}
              placeholder="介绍一下您自己..."
            />
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>加入时间：{formatJoinDate(profile.joinDate)}</span>
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                保存中...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                保存更改
              </>
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}

function StatsCard({ stats }: { stats: UserProfile["stats"] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          旅行统计
        </CardTitle>
        <CardDescription>您的旅行足迹</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.totalTrips}</div>
            <div className="text-sm text-muted-foreground">总行程数</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{stats.countriesVisited}</div>
            <div className="text-sm text-muted-foreground">访问国家</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">{stats.totalDistance.toLocaleString()}</div>
            <div className="text-sm text-muted-foreground">总里程 (km)</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-orange-600">{stats.favoriteDestination}</div>
            <div className="text-sm text-muted-foreground">最爱目的地</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function PreferencesCard({
  preferences,
  onSave,
  isSaving,
}: {
  preferences: UserProfile["preferences"]
  onSave: (preferences: UserProfile["preferences"]) => void
  isSaving: boolean
}) {
  const [formData, setFormData] = useState(preferences)

  useEffect(() => {
    setFormData(preferences)
  }, [preferences])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
  }

  const handleInterestChange = (interest: string, checked: boolean) => {
    if (checked) {
      setFormData({
        ...formData,
        interests: [...formData.interests, interest],
      })
    } else {
      setFormData({
        ...formData,
        interests: formData.interests.filter((i) => i !== interest),
      })
    }
  }

  const handleSeasonChange = (season: string, checked: boolean) => {
    if (checked) {
      setFormData({
        ...formData,
        seasons: [...formData.seasons, season],
      })
    } else {
      setFormData({
        ...formData,
        seasons: formData.seasons.filter((s) => s !== season),
      })
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          旅行偏好
        </CardTitle>
        <CardDescription>设置您的旅行偏好以获得更好的推荐</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-6">
          {/* 预算设置 */}
          <div className="space-y-2">
            <Label>预算范围 (人民币/人)</Label>
            <div className="pt-2">
              <Slider
                value={[formData.budget]}
                max={20000}
                step={500}
                onValueChange={(value) => setFormData({ ...formData, budget: value[0] })}
              />
              <div className="flex justify-between mt-2">
                <span className="text-sm text-muted-foreground">¥1,000</span>
                <span className="text-sm font-medium">¥{formData.budget.toLocaleString()}</span>
                <span className="text-sm text-muted-foreground">¥20,000</span>
              </div>
            </div>
          </div>

          {/* 旅行风格 */}
          <div className="space-y-2">
            <Label>旅行风格</Label>
            <Select
              value={formData.travelStyle}
              onValueChange={(value) => setFormData({ ...formData, travelStyle: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="relaxed">休闲放松</SelectItem>
                <SelectItem value="balanced">平衡兼顾</SelectItem>
                <SelectItem value="intensive">密集行程</SelectItem>
                <SelectItem value="adventure">探险冒险</SelectItem>
                <SelectItem value="cultural">文化体验</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 兴趣爱好 */}
          <div className="space-y-2">
            <Label>兴趣爱好</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-2">
              {["文化", "美食", "购物", "自然", "历史", "艺术", "运动", "摄影", "音乐"].map((interest) => (
                <div key={interest} className="flex items-center space-x-2">
                  <Checkbox
                    id={interest}
                    checked={formData.interests.includes(interest)}
                    onCheckedChange={(checked) => handleInterestChange(interest, checked as boolean)}
                  />
                  <label htmlFor={interest} className="text-sm font-medium">
                    {interest}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* 喜好季节 */}
          <div className="space-y-2">
            <Label>喜好季节</Label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
              {["春季", "夏季", "秋季", "冬季"].map((season) => (
                <div key={season} className="flex items-center space-x-2">
                  <Checkbox
                    id={season}
                    checked={formData.seasons.includes(season)}
                    onCheckedChange={(checked) => handleSeasonChange(season, checked as boolean)}
                  />
                  <label htmlFor={season} className="text-sm font-medium">
                    {season}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* 住宿偏好 */}
          <div className="space-y-2">
            <Label>住宿偏好</Label>
            <Select
              value={formData.accommodationType}
              onValueChange={(value) => setFormData({ ...formData, accommodationType: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hotel">酒店</SelectItem>
                <SelectItem value="hostel">青年旅社</SelectItem>
                <SelectItem value="airbnb">民宿</SelectItem>
                <SelectItem value="resort">度假村</SelectItem>
                <SelectItem value="camping">露营</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 交通偏好 */}
          <div className="space-y-2">
            <Label>交通偏好</Label>
            <Select
              value={formData.transportationPreference}
              onValueChange={(value) => setFormData({ ...formData, transportationPreference: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">公共交通</SelectItem>
                <SelectItem value="rental">租车</SelectItem>
                <SelectItem value="taxi">出租车/网约车</SelectItem>
                <SelectItem value="walking">步行</SelectItem>
                <SelectItem value="cycling">骑行</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 喜好目的地 */}
          <div className="space-y-2">
            <Label>喜好目的地</Label>
            <div className="flex flex-wrap gap-2">
              {formData.favoriteDestinations.map((destination, index) => (
                <Badge key={index} variant="secondary">
                  {destination}
                </Badge>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">基于您的旅行历史自动生成</p>
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                保存中...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                保存偏好
              </>
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}

function NotificationsCard({
  settings,
  onSave,
  isSaving,
}: {
  settings: UserProfile["settings"]
  onSave: (settings: UserProfile["settings"]) => void
  isSaving: boolean
}) {
  const [formData, setFormData] = useState(settings)

  useEffect(() => {
    setFormData(settings)
  }, [settings])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          通知设置
        </CardTitle>
        <CardDescription>管理您接收通知的方式</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>邮件通知</Label>
                <p className="text-sm text-muted-foreground">接收行程更新和推荐邮件</p>
              </div>
              <Switch
                checked={formData.notifications.email}
                onCheckedChange={(checked) =>
                  setFormData({
                    ...formData,
                    notifications: { ...formData.notifications, email: checked },
                  })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>推送通知</Label>
                <p className="text-sm text-muted-foreground">接收应用内推送通知</p>
              </div>
              <Switch
                checked={formData.notifications.push}
                onCheckedChange={(checked) =>
                  setFormData({
                    ...formData,
                    notifications: { ...formData.notifications, push: checked },
                  })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>短信通知</Label>
                <p className="text-sm text-muted-foreground">接收重要行程提醒短信</p>
              </div>
              <Switch
                checked={formData.notifications.sms}
                onCheckedChange={(checked) =>
                  setFormData({
                    ...formData,
                    notifications: { ...formData.notifications, sms: checked },
                  })
                }
              />
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>语言设置</Label>
              <Select
                value={formData.language}
                onValueChange={(value) => setFormData({ ...formData, language: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="zh-CN">简体中文</SelectItem>
                  <SelectItem value="zh-TW">繁体中文</SelectItem>
                  <SelectItem value="en-US">English</SelectItem>
                  <SelectItem value="ja-JP">日本語</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>货币设置</Label>
              <Select
                value={formData.currency}
                onValueChange={(value) => setFormData({ ...formData, currency: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CNY">人民币 (¥)</SelectItem>
                  <SelectItem value="USD">美元 ($)</SelectItem>
                  <SelectItem value="EUR">欧元 (€)</SelectItem>
                  <SelectItem value="JPY">日元 (¥)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                保存中...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                保存设置
              </>
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}

function PrivacyCard({
  settings,
  onSave,
  isSaving,
}: {
  settings: UserProfile["settings"]
  onSave: (settings: UserProfile["settings"]) => void
  isSaving: boolean
}) {
  const [formData, setFormData] = useState(settings)

  useEffect(() => {
    setFormData(settings)
  }, [settings])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          隐私安全
        </CardTitle>
        <CardDescription>管理您的隐私和安全设置</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>公开个人资料</Label>
                <p className="text-sm text-muted-foreground">允许其他用户查看您的个人资料</p>
              </div>
              <Switch
                checked={formData.privacy.profileVisible}
                onCheckedChange={(checked) =>
                  setFormData({
                    ...formData,
                    privacy: { ...formData.privacy, profileVisible: checked },
                  })
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>公开行程</Label>
                <p className="text-sm text-muted-foreground">允许其他用户查看您的行程</p>
              </div>
              <Switch
                checked={formData.privacy.tripsVisible}
                onCheckedChange={(checked) =>
                  setFormData({
                    ...formData,
                    privacy: { ...formData.privacy, tripsVisible: checked },
                  })
                }
              />
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h3 className="text-lg font-medium">账号安全</h3>
            <div className="space-y-3">
              <Button variant="outline" className="w-full justify-start">
                修改密码
              </Button>
              <Button variant="outline" className="w-full justify-start">
                两步验证
              </Button>
              <Button variant="outline" className="w-full justify-start">
                登录设备管理
              </Button>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h3 className="text-lg font-medium">数据管理</h3>
            <div className="space-y-3">
              <Button variant="outline" className="w-full justify-start">
                导出我的数据
              </Button>
              <Button variant="destructive" className="w-full justify-start">
                删除账号
              </Button>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                保存中...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                保存设置
              </>
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
