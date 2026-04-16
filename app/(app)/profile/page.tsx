"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
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
import { User, Camera, Calendar, Globe, Bell, Shield, Loader2, Save, MapPin, Upload } from "lucide-react"
import { userAPI, blogAPI } from "@/lib/api"
import { useToast } from "@/components/ui/use-toast"
import { useUserStore, type UserPreferences } from "@/lib/store/user-store"

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
    notifications: { email: boolean; push: boolean; sms: boolean }
    privacy: { profileVisible: boolean; tripsVisible: boolean }
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
  const { user, preferences, isLoading: storeLoading, fetchPreferences, updatePreferences: updateStorePreferences, updateUser } = useUserStore()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        setIsLoading(true)
        const data = await userAPI.getProfile()
        if (mounted) {
          setProfile(data)
          if (data.preferences) useUserStore.getState().setPreferences(data.preferences)
        }
      } catch {
        if (mounted) toast({ title: "获取用户资料失败", variant: "destructive" })
      } finally {
        if (mounted) setIsLoading(false)
      }
    }
    if (!useUserStore.getState().preferences) fetchPreferences()
    load()
    return () => { mounted = false }
  }, [])

  const handleSaveProfile = async (updatedData: Partial<UserProfile>) => {
    if (!profile) return
    try {
      setIsSaving(true)
      if (updatedData.preferences) {
        await updateStorePreferences(updatedData.preferences)
        setProfile({ ...profile, preferences: updatedData.preferences })
      } else {
        await userAPI.updateProfile(updatedData)
        const next = { ...profile, ...updatedData }
        setProfile(next)
        // 同步到 store 的用户信息
        if (updatedData.name || updatedData.avatar) {
          updateUser({ name: updatedData.name, avatar: updatedData.avatar })
        }
      }
      toast({ title: "保存成功", description: "您的资料已更新" })
    } catch {
      toast({ title: "保存失败", description: "请稍后再试", variant: "destructive" })
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading || storeLoading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-3" />
          <p className="text-muted-foreground">正在加载用户资料...</p>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-destructive">加载失败</CardTitle></CardHeader>
        <CardContent><p>无法加载用户资料，请稍后再试。</p></CardContent>
      </Card>
    )
  }

  return (
    <div className="max-w-3xl mx-auto">
      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid grid-cols-4">
          <TabsTrigger value="profile">基本信息</TabsTrigger>
          <TabsTrigger value="preferences">旅行偏好</TabsTrigger>
          <TabsTrigger value="notifications">通知设置</TabsTrigger>
          <TabsTrigger value="privacy">隐私安全</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <div className="space-y-6">
            <ProfileInfoCard
              profile={profile}
              onSave={handleSaveProfile}
              isSaving={isSaving}
              onAvatarChange={(url) => setProfile({ ...profile, avatar: url })}
            />
            <StatsCard stats={profile.stats} />
          </div>
        </TabsContent>

        <TabsContent value="preferences">
          <PreferencesCard
            preferences={preferences ?? profile.preferences}
            onSave={(p) => handleSaveProfile({ preferences: p })}
            isSaving={isSaving}
          />
        </TabsContent>

        <TabsContent value="notifications">
          <NotificationsCard
            settings={profile.settings}
            onSave={(s) => handleSaveProfile({ settings: s })}
            isSaving={isSaving}
          />
        </TabsContent>

        <TabsContent value="privacy">
          <PrivacyCard
            settings={profile.settings}
            onSave={(s) => handleSaveProfile({ settings: s })}
            isSaving={isSaving}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ── ProfileInfoCard ──────────────────────────────────────────────────────────

function ProfileInfoCard({
  profile,
  onSave,
  isSaving,
  onAvatarChange,
}: {
  profile: UserProfile
  onSave: (data: Partial<UserProfile>) => void
  isSaving: boolean
  onAvatarChange: (url: string) => void
}) {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [avatarPreview, setAvatarPreview] = useState(profile.avatar)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [formData, setFormData] = useState({
    name: profile.name,
    email: profile.email,
    phone: profile.phone ?? "",
    location: profile.location ?? "",
    bio: profile.bio ?? "",
  })

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 立即显示本地预览
    const objectUrl = URL.createObjectURL(file)
    setAvatarPreview(objectUrl)

    try {
      setIsUploadingAvatar(true)
      const { url } = await blogAPI.uploadAvatar(file)
      setAvatarPreview(url)
      onAvatarChange(url)
      // 同时保存到服务器
      await onSave({ avatar: url })
    } catch (err: any) {
      toast({ title: "头像上传失败", description: err.message, variant: "destructive" })
      setAvatarPreview(profile.avatar)
    } finally {
      setIsUploadingAvatar(false)
      URL.revokeObjectURL(objectUrl)
      // 重置 input 以允许重复选同一文件
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
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
          {/* 头像上传 */}
          <div className="flex items-center gap-6">
            <div className="relative">
              <Avatar className="h-24 w-24 ring-2 ring-border">
                <AvatarImage src={avatarPreview || profile.avatar} alt={profile.name} />
                <AvatarFallback className="text-2xl">
                  {profile.name?.charAt(0)?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {isUploadingAvatar && (
                <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
                  <Loader2 className="h-6 w-6 text-white animate-spin" />
                </div>
              )}
            </div>
            <div className="space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleAvatarFileChange}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isUploadingAvatar}
                onClick={() => fileInputRef.current?.click()}
              >
                {isUploadingAvatar ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />上传中...</>
                ) : (
                  <><Upload className="h-4 w-4 mr-2" />更换头像</>
                )}
              </Button>
              <p className="text-xs text-muted-foreground">JPG / PNG / WebP，最大 5 MB</p>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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
                disabled
                className="bg-muted"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">手机号</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+86 138 0000 0000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">所在地</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="北京, 中国"
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
            <span>加入时间：{new Date(profile.joinDate).toLocaleDateString("zh-CN", { year: "numeric", month: "long" })}</span>
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={isSaving || isUploadingAvatar}>
            {isSaving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />保存中...</> : <><Save className="h-4 w-4 mr-2" />保存更改</>}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}

// ── StatsCard ────────────────────────────────────────────────────────────────

function StatsCard({ stats }: { stats: UserProfile["stats"] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Globe className="h-5 w-5" />旅行统计</CardTitle>
        <CardDescription>您的旅行足迹</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { value: stats.totalTrips, label: "总行程数", color: "text-blue-600" },
            { value: stats.countriesVisited, label: "访问国家", color: "text-green-600" },
            { value: stats.totalDistance.toLocaleString(), label: "总里程 (km)", color: "text-purple-600" },
            { value: stats.favoriteDestination, label: "最爱目的地", color: "text-orange-600" },
          ].map(({ value, label, color }) => (
            <div key={label}>
              <div className={`text-2xl font-bold ${color}`}>{value}</div>
              <div className="text-sm text-muted-foreground mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// ── PreferencesCard ──────────────────────────────────────────────────────────

function PreferencesCard({
  preferences,
  onSave,
  isSaving,
}: {
  preferences: UserProfile["preferences"] | null
  onSave: (p: UserPreferences) => void
  isSaving: boolean
}) {
  const [formData, setFormData] = useState<UserPreferences>({
    budget: preferences?.budget ?? 10000,
    travelStyle: preferences?.travelStyle ?? "balanced",
    favoriteDestinations: preferences?.favoriteDestinations ?? [],
    interests: preferences?.interests ?? [],
    seasons: preferences?.seasons ?? [],
    accommodationType: preferences?.accommodationType ?? "hotel",
    transportationPreference: preferences?.transportationPreference ?? "mixed",
  })

  useEffect(() => {
    if (preferences) {
      setFormData({
        budget: preferences.budget ?? 10000,
        travelStyle: preferences.travelStyle ?? "balanced",
        favoriteDestinations: preferences.favoriteDestinations ?? [],
        interests: preferences.interests ?? [],
        seasons: preferences.seasons ?? [],
        accommodationType: preferences.accommodationType ?? "hotel",
        transportationPreference: preferences.transportationPreference ?? "mixed",
      })
    }
  }, [preferences])

  const toggleList = (key: "interests" | "seasons", val: string, checked: boolean) => {
    setFormData((prev) => ({
      ...prev,
      [key]: checked ? [...prev[key], val] : prev[key].filter((v) => v !== val),
    }))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5" />旅行偏好</CardTitle>
        <CardDescription>设置偏好以获得更好的推荐</CardDescription>
      </CardHeader>
      <form onSubmit={(e) => { e.preventDefault(); onSave(formData) }}>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label>预算范围（人民币 / 人）</Label>
            <Slider value={[formData.budget ?? 10000]} min={1000} max={20000} step={500}
              onValueChange={([v]) => setFormData({ ...formData, budget: v })} />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>¥1,000</span>
              <span className="font-medium text-foreground">¥{(formData.budget ?? 10000).toLocaleString()}</span>
              <span>¥20,000</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>旅行风格</Label>
              <Select value={formData.travelStyle} onValueChange={(v) => setFormData({ ...formData, travelStyle: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[["relaxed","休闲放松"],["balanced","平衡兼顾"],["intensive","密集行程"],["adventure","探险冒险"],["cultural","文化体验"]].map(([v,l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>住宿偏好</Label>
              <Select value={formData.accommodationType} onValueChange={(v) => setFormData({ ...formData, accommodationType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[["hotel","酒店"],["hostel","青年旅社"],["airbnb","民宿"],["resort","度假村"],["camping","露营"]].map(([v,l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>交通偏好</Label>
              <Select value={formData.transportationPreference} onValueChange={(v) => setFormData({ ...formData, transportationPreference: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[["public","公共交通"],["rental","租车"],["taxi","网约车"],["walking","步行"],["cycling","骑行"]].map(([v,l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>兴趣爱好</Label>
            <div className="grid grid-cols-3 md:grid-cols-5 gap-3 pt-1">
              {["文化","美食","购物","自然","历史","艺术","运动","摄影","音乐"].map((v) => (
                <div key={v} className="flex items-center gap-2">
                  <Checkbox id={`int-${v}`} checked={formData.interests.includes(v)}
                    onCheckedChange={(c) => toggleList("interests", v, !!c)} />
                  <label htmlFor={`int-${v}`} className="text-sm">{v}</label>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>喜好季节</Label>
            <div className="flex gap-6 pt-1">
              {["春季","夏季","秋季","冬季"].map((v) => (
                <div key={v} className="flex items-center gap-2">
                  <Checkbox id={`s-${v}`} checked={formData.seasons.includes(v)}
                    onCheckedChange={(c) => toggleList("seasons", v, !!c)} />
                  <label htmlFor={`s-${v}`} className="text-sm">{v}</label>
                </div>
              ))}
            </div>
          </div>

          {formData.favoriteDestinations.length > 0 && (
            <div className="space-y-2">
              <Label>喜好目的地</Label>
              <div className="flex flex-wrap gap-2">
                {formData.favoriteDestinations.map((d) => (
                  <Badge key={d} variant="secondary">{d}</Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={isSaving}>
            {isSaving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />保存中...</> : <><Save className="h-4 w-4 mr-2" />保存偏好</>}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}

// ── NotificationsCard ────────────────────────────────────────────────────────

function NotificationsCard({ settings, onSave, isSaving }: { settings: UserProfile["settings"]; onSave: (s: UserProfile["settings"]) => void; isSaving: boolean }) {
  const [formData, setFormData] = useState(settings)
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5" />通知设置</CardTitle>
        <CardDescription>管理您接收通知的方式</CardDescription>
      </CardHeader>
      <form onSubmit={(e) => { e.preventDefault(); onSave(formData) }}>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            {[
              { key: "email" as const, label: "邮件通知", desc: "接收行程更新和推荐邮件" },
              { key: "push" as const, label: "推送通知", desc: "接收应用内推送通知" },
              { key: "sms" as const, label: "短信通知", desc: "接收重要行程提醒短信" },
            ].map(({ key, label, desc }) => (
              <div key={key} className="flex items-center justify-between">
                <div><p className="text-sm font-medium">{label}</p><p className="text-xs text-muted-foreground">{desc}</p></div>
                <Switch checked={formData.notifications[key]}
                  onCheckedChange={(c) => setFormData({ ...formData, notifications: { ...formData.notifications, [key]: c } })} />
              </div>
            ))}
          </div>
          <Separator />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>语言设置</Label>
              <Select value={formData.language} onValueChange={(v) => setFormData({ ...formData, language: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
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
              <Select value={formData.currency} onValueChange={(v) => setFormData({ ...formData, currency: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
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
            {isSaving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />保存中...</> : <><Save className="h-4 w-4 mr-2" />保存设置</>}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}

// ── PrivacyCard ──────────────────────────────────────────────────────────────

function PrivacyCard({ settings, onSave, isSaving }: { settings: UserProfile["settings"]; onSave: (s: UserProfile["settings"]) => void; isSaving: boolean }) {
  const [formData, setFormData] = useState(settings)
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" />隐私安全</CardTitle>
        <CardDescription>管理您的隐私和安全设置</CardDescription>
      </CardHeader>
      <form onSubmit={(e) => { e.preventDefault(); onSave(formData) }}>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            {[
              { key: "profileVisible" as const, label: "公开个人资料", desc: "允许其他用户查看您的个人资料" },
              { key: "tripsVisible" as const, label: "公开行程", desc: "允许其他用户查看您的行程" },
            ].map(({ key, label, desc }) => (
              <div key={key} className="flex items-center justify-between">
                <div><p className="text-sm font-medium">{label}</p><p className="text-xs text-muted-foreground">{desc}</p></div>
                <Switch checked={formData.privacy[key]}
                  onCheckedChange={(c) => setFormData({ ...formData, privacy: { ...formData.privacy, [key]: c } })} />
              </div>
            ))}
          </div>
          <Separator />
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">账号安全</h3>
            <div className="space-y-2">
              <Button type="button" variant="outline" className="w-full justify-start text-sm">修改密码</Button>
              <Button type="button" variant="outline" className="w-full justify-start text-sm">两步验证</Button>
            </div>
          </div>
          <Separator />
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">数据管理</h3>
            <Button type="button" variant="outline" className="w-full justify-start text-sm">导出我的数据</Button>
            <Button type="button" variant="destructive" className="w-full justify-start text-sm">删除账号</Button>
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={isSaving}>
            {isSaving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />保存中...</> : <><Save className="h-4 w-4 mr-2" />保存设置</>}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
