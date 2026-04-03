export type TripStatus = "draft" | "planning" | "confirmed" | "completed"

export interface Attraction {
  id: number
  name: string
  location: string
  rating: number
  type: string
  description: string
  imageUrl?: string
}

interface TripActivity {
  time: string
  title: string
  type: string
  description: string
}

interface TripDay {
  day: number
  title: string
  activities: TripActivity[]
}

interface TripRecommendation {
  name: string
  type: string
}

interface TripPracticalItem {
  name: string
  cost: number
  icon: string
}

interface TripPracticalInfo {
  transportation: TripPracticalItem[]
  accommodation: TripPracticalItem[]
  tips: string[]
}

export interface TripRecord {
  id: string
  title: string
  destination: string
  startDate: string
  endDate: string
  travelers: number
  budget: number
  status: TripStatus
  travelStyle: string
  highlights: string[]
  createdAt: string
  updatedAt: string
  days: TripDay[]
  recommendations: TripRecommendation[]
  practicalInfo: TripPracticalInfo
}

export interface UserProfile {
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

interface TripInput {
  destination: string
  startDate: string
  endDate?: string
  travelers: number
  budget: number
  travelStyle: string
  interests?: string
  title?: string
  status?: TripStatus
  createdAt?: string
  updatedAt?: string
  id?: string
}

interface TravelStore {
  trips: TripRecord[]
  userProfile: UserProfile
}

interface DestinationSeed {
  key: string
  aliases: string[]
  highlights: string[]
  activities: Array<Omit<TripActivity, "time">>
  recommendations: TripRecommendation[]
  practicalInfo: TripPracticalInfo
}

const DAY_IN_MS = 24 * 60 * 60 * 1000
const TIME_SLOTS = ["09:00 - 11:00", "11:30 - 13:00", "14:00 - 16:30", "18:00 - 20:00"]

const popularAttractions: Attraction[] = [
  {
    id: 1,
    name: "东京塔",
    location: "东京, 日本",
    rating: 4.7,
    type: "观景台",
    description: "东京的标志性建筑，可俯瞰整个城市",
    imageUrl: "/placeholder.svg?height=200&width=300",
  },
  {
    id: 2,
    name: "巴黎铁塔",
    location: "巴黎, 法国",
    rating: 4.8,
    type: "观景台",
    description: "法国最著名的地标建筑",
    imageUrl: "/placeholder.svg?height=200&width=300",
  },
  {
    id: 3,
    name: "大峡谷",
    location: "亚利桑那, 美国",
    rating: 4.9,
    type: "自然景观",
    description: "世界七大自然奇观之一",
    imageUrl: "/placeholder.svg?height=200&width=300",
  },
  {
    id: 4,
    name: "故宫",
    location: "北京, 中国",
    rating: 4.8,
    type: "历史建筑",
    description: "中国明清两代的皇家宫殿",
    imageUrl: "/placeholder.svg?height=200&width=300",
  },
  {
    id: 5,
    name: "大英博物馆",
    location: "伦敦, 英国",
    rating: 4.7,
    type: "博物馆",
    description: "世界上历史最悠久的博物馆之一",
    imageUrl: "/placeholder.svg?height=200&width=300",
  },
  {
    id: 6,
    name: "悉尼歌剧院",
    location: "悉尼, 澳大利亚",
    rating: 4.6,
    type: "建筑",
    description: "世界著名的表演艺术中心",
    imageUrl: "/placeholder.svg?height=200&width=300",
  },
]

const hiddenGemAttractions: Attraction[] = [
  {
    id: 7,
    name: "中目黑樱花道",
    location: "东京, 日本",
    rating: 4.5,
    type: "自然景观",
    description: "春季樱花盛开的绝美步道",
    imageUrl: "/placeholder.svg?height=200&width=300",
  },
  {
    id: 8,
    name: "蒙马特高地",
    location: "巴黎, 法国",
    rating: 4.4,
    type: "文化区",
    description: "艺术家聚集的浪漫街区",
    imageUrl: "/placeholder.svg?height=200&width=300",
  },
  {
    id: 9,
    name: "798艺术区",
    location: "北京, 中国",
    rating: 4.3,
    type: "艺术区",
    description: "当代艺术和创意产业聚集地",
    imageUrl: "/placeholder.svg?height=200&width=300",
  },
  {
    id: 10,
    name: "布鲁克林高线公园",
    location: "纽约, 美国",
    rating: 4.4,
    type: "公园",
    description: "废弃铁路改造的空中花园",
    imageUrl: "/placeholder.svg?height=200&width=300",
  },
  {
    id: 11,
    name: "诺丁山",
    location: "伦敦, 英国",
    rating: 4.2,
    type: "街区",
    description: "色彩缤纷的维多利亚式房屋街区",
    imageUrl: "/placeholder.svg?height=200&width=300",
  },
  {
    id: 12,
    name: "邦迪海滩",
    location: "悉尼, 澳大利亚",
    rating: 4.6,
    type: "海滩",
    description: "世界著名的冲浪海滩",
    imageUrl: "/placeholder.svg?height=200&width=300",
  },
]

const aiRecommendationFallbacks: Attraction[] = [
  {
    id: 13,
    name: "teamLab Borderless",
    location: "东京, 日本",
    rating: 4.8,
    type: "艺术展览",
    description: "沉浸式数字艺术空间，适合摄影和夜间体验",
    imageUrl: "/placeholder.svg?height=200&width=300",
  },
  {
    id: 14,
    name: "塞纳河左岸书店区",
    location: "巴黎, 法国",
    rating: 4.5,
    type: "文化区",
    description: "适合慢逛和收集独立书店的小众街区",
    imageUrl: "/placeholder.svg?height=200&width=300",
  },
  {
    id: 15,
    name: "高线公园日落步道",
    location: "纽约, 美国",
    rating: 4.6,
    type: "公园",
    description: "傍晚时段视野和氛围都很出色，适合轻松散步",
    imageUrl: "/placeholder.svg?height=200&width=300",
  },
  {
    id: 16,
    name: "岚山竹林清晨路线",
    location: "京都, 日本",
    rating: 4.7,
    type: "自然景观",
    description: "避开高峰时段后体验更好，适合半日文化路线",
    imageUrl: "/placeholder.svg?height=200&width=300",
  },
]

const destinationSeeds: DestinationSeed[] = [
  {
    key: "东京",
    aliases: ["东京", "tokyo"],
    highlights: ["东京塔", "浅草寺", "teamLab", "筑地市场", "银座"],
    activities: [
      {
        title: "浅草寺",
        type: "景点",
        description: "东京最古老的寺庙之一，适合体验传统街区和寺院氛围。",
      },
      {
        title: "午餐：筑地市场",
        type: "餐厅",
        description: "集中品尝寿司、海鲜饭和地道日式小吃。",
      },
      {
        title: "teamLab Borderless",
        type: "景点",
        description: "沉浸式数字艺术体验，适合拍照和互动打卡。",
      },
      {
        title: "银座夜间漫步",
        type: "购物",
        description: "适合安排精品购物、甜品和夜景散步。",
      },
      {
        title: "明治神宫",
        type: "景点",
        description: "闹市中的静谧神社，适合半日轻松路线。",
      },
      {
        title: "涩谷十字路口",
        type: "景点",
        description: "体验东京都市节奏，并串联周边商圈探索。",
      },
    ],
    recommendations: [
      { name: "六本木之丘", type: "观景" },
      { name: "代官山", type: "街区" },
      { name: "吉卜力美术馆", type: "博物馆" },
      { name: "东京迪士尼", type: "主题公园" },
    ],
    practicalInfo: {
      transportation: [
        { name: "Suica 或 PASMO 卡", cost: 800, icon: "Train" },
        { name: "机场至市区快线", cost: 3000, icon: "Train" },
      ],
      accommodation: [
        { name: "新宿格兰贝尔酒店", cost: 1200, icon: "Hotel" },
        { name: "涩谷东急酒店", cost: 1500, icon: "Hotel" },
      ],
      tips: [
        "东京公共交通密集，建议优先使用地铁和 JR 线路。",
        "热门展馆和餐厅建议至少提前 3 到 7 天预约。",
        "便利店补给效率很高，适合临时购买早餐和饮品。",
      ],
    },
  },
  {
    key: "巴黎",
    aliases: ["巴黎", "paris"],
    highlights: ["埃菲尔铁塔", "卢浮宫", "凯旋门", "蒙马特高地", "塞纳河"],
    activities: [
      {
        title: "卢浮宫",
        type: "景点",
        description: "建议提早入场，优先规划想看的馆藏和路线。",
      },
      {
        title: "午餐：左岸咖啡馆",
        type: "餐厅",
        description: "适合体验经典法式简餐和街区氛围。",
      },
      {
        title: "埃菲尔铁塔",
        type: "景点",
        description: "白天和夜景体验不同，建议至少安排一个固定时段。",
      },
      {
        title: "塞纳河夜游",
        type: "景点",
        description: "适合放慢节奏，串联主要地标夜景。",
      },
      {
        title: "蒙马特高地",
        type: "景点",
        description: "适合徒步和感受巴黎艺术街区。",
      },
      {
        title: "香榭丽舍大道",
        type: "购物",
        description: "可安排购物、甜点和凯旋门周边打卡。",
      },
    ],
    recommendations: [
      { name: "奥赛博物馆", type: "博物馆" },
      { name: "玛黑区", type: "街区" },
      { name: "凡尔赛宫", type: "历史建筑" },
      { name: "巴黎歌剧院", type: "建筑" },
    ],
    practicalInfo: {
      transportation: [
        { name: "巴黎地铁周卡", cost: 220, icon: "Train" },
        { name: "机场巴士", cost: 130, icon: "Train" },
      ],
      accommodation: [
        { name: "拉丁区精品酒店", cost: 1500, icon: "Hotel" },
        { name: "歌剧院附近公寓", cost: 1800, icon: "Hotel" },
      ],
      tips: [
        "热门博物馆建议使用线上预约免排队。",
        "巴黎步行体验很好，许多街区适合慢逛串联。",
        "注意保管随身物品，游客区需格外留意安全。",
      ],
    },
  },
  {
    key: "纽约",
    aliases: ["纽约", "new york"],
    highlights: ["自由女神像", "中央公园", "时代广场", "布鲁克林大桥", "高线公园"],
    activities: [
      {
        title: "中央公园晨间散步",
        type: "景点",
        description: "适合作为高密度城市行程中的放松时段。",
      },
      {
        title: "午餐：切尔西市场",
        type: "餐厅",
        description: "可以快速体验多种美食和本地热门店铺。",
      },
      {
        title: "高线公园",
        type: "景点",
        description: "适合和哈德逊河区域一起安排半日路线。",
      },
      {
        title: "百老汇周边夜游",
        type: "购物",
        description: "可结合时代广场和剧院区夜间活动安排。",
      },
      {
        title: "大都会艺术博物馆",
        type: "景点",
        description: "馆藏丰富，建议提前选定重点展区。",
      },
      {
        title: "布鲁克林大桥步行",
        type: "景点",
        description: "日落前后景观最佳，适合拍照和串联 DUMBO 区域。",
      },
    ],
    recommendations: [
      { name: "DUMBO", type: "街区" },
      { name: "MoMA", type: "博物馆" },
      { name: "SoHo", type: "购物" },
      { name: "洛克菲勒中心", type: "观景" },
    ],
    practicalInfo: {
      transportation: [
        { name: "7 日地铁卡", cost: 260, icon: "Train" },
        { name: "机场快线", cost: 120, icon: "Train" },
      ],
      accommodation: [
        { name: "曼哈顿中城商务酒店", cost: 2200, icon: "Hotel" },
        { name: "布鲁克林精品酒店", cost: 1800, icon: "Hotel" },
      ],
      tips: [
        "纽约步行量较大，建议准备舒适的鞋子。",
        "热门观景台适合错峰预订，日落场次非常抢手。",
        "不同街区节奏差异明显，建议按区域集中安排行程。",
      ],
    },
  },
  {
    key: "京都",
    aliases: ["京都", "kyoto"],
    highlights: ["清水寺", "金阁寺", "伏见稻荷大社", "岚山", "祇园"],
    activities: [
      {
        title: "清水寺",
        type: "景点",
        description: "适合与二年坂、三年坂步行路线组合体验。",
      },
      {
        title: "午餐：町家料理",
        type: "餐厅",
        description: "体验京都风格定食和安静街区氛围。",
      },
      {
        title: "伏见稻荷大社",
        type: "景点",
        description: "建议尽量安排清晨时段，体验更安静。",
      },
      {
        title: "祇园夜间散步",
        type: "购物",
        description: "适合安排和风甜点、伴手礼与夜景漫游。",
      },
      {
        title: "岚山竹林",
        type: "景点",
        description: "适合搭配天龙寺和渡月桥安排半日路线。",
      },
      {
        title: "金阁寺",
        type: "景点",
        description: "经典文化地标，适合轻量拍照和参观安排。",
      },
    ],
    recommendations: [
      { name: "锦市场", type: "美食" },
      { name: "哲学之道", type: "步行路线" },
      { name: "平安神宫", type: "文化景点" },
      { name: "宇治半日游", type: "周边" },
    ],
    practicalInfo: {
      transportation: [
        { name: "京都巴士一日券", cost: 45, icon: "Train" },
        { name: "关西机场特急", cost: 750, icon: "Train" },
      ],
      accommodation: [
        { name: "祇园町家民宿", cost: 1100, icon: "Hotel" },
        { name: "京都站附近酒店", cost: 900, icon: "Hotel" },
      ],
      tips: [
        "寺社较多，安排上建议每天留出步行和休息时间。",
        "早晚时段景区体验明显更好，白天游客会更多。",
        "京都公交较繁忙，跨区域移动可结合地铁与步行。",
      ],
    },
  },
]

const defaultDestinationSeed: DestinationSeed = {
  key: "默认",
  aliases: [],
  highlights: ["城市漫步", "当地美食", "经典景点", "特色街区", "夜景体验"],
  activities: [
    {
      title: "城市地标探索",
      type: "景点",
      description: "优先体验当地最具代表性的地标和核心区域。",
    },
    {
      title: "午餐：本地特色餐厅",
      type: "餐厅",
      description: "安排一顿具有本地风味的主餐，提升旅行记忆点。",
    },
    {
      title: "特色街区漫步",
      type: "景点",
      description: "适合结合咖啡馆、小店和文化空间慢慢体验。",
    },
    {
      title: "夜间城市观景",
      type: "购物",
      description: "安排轻松的夜景或夜市路线，平衡整天节奏。",
    },
  ],
  recommendations: [
    { name: "本地市场", type: "生活体验" },
    { name: "人气观景点", type: "景点" },
    { name: "文化展馆", type: "文化" },
    { name: "特色街区", type: "街区" },
  ],
  practicalInfo: {
    transportation: [
      { name: "城市交通通票", cost: 100, icon: "Train" },
      { name: "机场接驳", cost: 200, icon: "Train" },
    ],
    accommodation: [
      { name: "市中心舒适型酒店", cost: 900, icon: "Hotel" },
      { name: "交通便利公寓", cost: 750, icon: "Hotel" },
    ],
    tips: [
      "建议第一天以熟悉交通和周边环境为主。",
      "核心景点尽量错峰，体验会更轻松。",
      "保留一些机动时间，方便根据天气灵活调整。",
    ],
  },
}

const initialUserProfile: UserProfile = {
  id: "user1",
  name: "张三",
  email: "zhangsan@example.com",
  avatar: "/placeholder.svg?height=100&width=100",
  phone: "+86 138 0013 8000",
  location: "北京, 中国",
  bio: "热爱旅行的探索者，喜欢发现世界各地的美景和文化。",
  joinDate: "2024-01-15T00:00:00Z",
  preferences: {
    budget: 10000,
    travelStyle: "balanced",
    favoriteDestinations: ["东京", "巴黎", "纽约"],
    interests: ["文化", "美食", "购物", "自然"],
    seasons: ["春季", "秋季"],
    accommodationType: "hotel",
    transportationPreference: "public",
  },
  settings: {
    notifications: {
      email: true,
      push: true,
      sms: false,
    },
    privacy: {
      profileVisible: true,
      tripsVisible: false,
    },
    language: "zh-CN",
    currency: "CNY",
  },
  stats: {
    totalTrips: 12,
    countriesVisited: 8,
    totalDistance: 45000,
    favoriteDestination: "东京",
  },
}

declare global {
  // eslint-disable-next-line no-var
  var __travelStore: TravelStore | undefined
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function resolveDate(dateValue?: string) {
  const date = dateValue ? new Date(dateValue) : new Date()
  return Number.isNaN(date.getTime()) ? new Date() : date
}

function formatDate(dateValue: Date) {
  return dateValue.toISOString().split("T")[0]
}

function normalizeEndDate(startDate: string, endDate?: string) {
  const start = resolveDate(startDate)
  const end = resolveDate(endDate ?? startDate)

  if (end.getTime() < start.getTime()) {
    return formatDate(start)
  }

  return formatDate(end)
}

function getTripDurationInDays(startDate: string, endDate: string) {
  const start = resolveDate(startDate)
  const end = resolveDate(endDate)
  const diffInDays = Math.round((end.getTime() - start.getTime()) / DAY_IN_MS)
  return Math.max(1, diffInDays + 1)
}

function resolveDestinationSeed(destination: string) {
  const normalizedDestination = destination.toLowerCase()

  return (
    destinationSeeds.find((seed) =>
      seed.aliases.some((alias) => normalizedDestination.includes(alias.toLowerCase())),
    ) ?? defaultDestinationSeed
  )
}

function buildTripDays(seed: DestinationSeed, duration: number): TripDay[] {
  const dayCount = Math.max(1, Math.min(duration, 7))

  return Array.from({ length: dayCount }, (_, dayIndex) => {
    const activities = TIME_SLOTS.map((time, slotIndex) => {
      const activity = seed.activities[(dayIndex * TIME_SLOTS.length + slotIndex) % seed.activities.length]

      return {
        time,
        title: activity.title,
        type: activity.type,
        description: activity.description,
      }
    })

    return {
      day: dayIndex + 1,
      title: `${activities[0].title} · ${activities[1].title}`,
      activities,
    }
  })
}

function createTripRecord(input: TripInput): TripRecord {
  const createdAt = input.createdAt ?? new Date().toISOString()
  const normalizedEndDate = normalizeEndDate(input.startDate, input.endDate)
  const duration = getTripDurationInDays(input.startDate, normalizedEndDate)
  const destination = input.destination.trim()
  const seed = resolveDestinationSeed(destination)
  const days = buildTripDays(seed, duration)

  return {
    id: input.id ?? crypto.randomUUID(),
    title: input.title ?? `${destination} ${duration} 日游`,
    destination,
    startDate: formatDate(resolveDate(input.startDate)),
    endDate: normalizedEndDate,
    travelers: Math.max(1, input.travelers || 1),
    budget: Math.max(0, input.budget || 0),
    status: input.status ?? "draft",
    travelStyle: input.travelStyle || "balanced",
    highlights: seed.highlights.slice(0, 5),
    createdAt,
    updatedAt: input.updatedAt ?? createdAt,
    days,
    recommendations: clone(seed.recommendations),
    practicalInfo: clone(seed.practicalInfo),
  }
}

function createInitialStore(): TravelStore {
  return {
    trips: [
      createTripRecord({
        id: "trip1",
        title: "东京 6 日游",
        destination: "东京, 日本",
        startDate: "2025-07-15",
        endDate: "2025-07-20",
        travelers: 2,
        budget: 12500,
        status: "confirmed",
        travelStyle: "balanced",
        createdAt: "2025-01-01T00:00:00Z",
        updatedAt: "2025-01-02T00:00:00Z",
      }),
      createTripRecord({
        id: "trip2",
        title: "巴黎浪漫之旅",
        destination: "巴黎, 法国",
        startDate: "2025-09-10",
        endDate: "2025-09-17",
        travelers: 2,
        budget: 15000,
        status: "draft",
        travelStyle: "cultural",
        createdAt: "2025-01-03T00:00:00Z",
        updatedAt: "2025-01-03T00:00:00Z",
      }),
      createTripRecord({
        id: "trip3",
        title: "纽约城市探索",
        destination: "纽约, 美国",
        startDate: "2024-12-01",
        endDate: "2024-12-07",
        travelers: 1,
        budget: 18000,
        status: "completed",
        travelStyle: "balanced",
        createdAt: "2024-11-01T00:00:00Z",
        updatedAt: "2024-12-08T00:00:00Z",
      }),
      createTripRecord({
        id: "trip4",
        title: "京都文化体验",
        destination: "京都, 日本",
        startDate: "2025-04-01",
        endDate: "2025-04-05",
        travelers: 3,
        budget: 8000,
        status: "planning",
        travelStyle: "cultural",
        createdAt: "2025-01-05T00:00:00Z",
        updatedAt: "2025-01-06T00:00:00Z",
      }),
    ],
    userProfile: clone(initialUserProfile),
  }
}

function getStore() {
  if (!globalThis.__travelStore) {
    globalThis.__travelStore = createInitialStore()
  }

  return globalThis.__travelStore
}

export function getTrips() {
  return clone(getStore().trips)
}

export function getTripById(id: string) {
  const trip = getStore().trips.find((item) => item.id === id)
  return trip ? clone(trip) : null
}

export function createTrip(input: TripInput) {
  const trip = createTripRecord(input)
  getStore().trips.unshift(trip)
  return clone(trip)
}

export function updateTrip(id: string, updates: Partial<TripRecord>) {
  const store = getStore()
  const index = store.trips.findIndex((trip) => trip.id === id)

  if (index === -1) {
    return null
  }

  const current = store.trips[index]
  const nextTrip = createTripRecord({
    id: current.id,
    title: typeof updates.title === "string" ? updates.title : current.title,
    destination: typeof updates.destination === "string" ? updates.destination : current.destination,
    startDate: typeof updates.startDate === "string" ? updates.startDate : current.startDate,
    endDate: typeof updates.endDate === "string" ? updates.endDate : current.endDate,
    travelers: typeof updates.travelers === "number" ? updates.travelers : current.travelers,
    budget: typeof updates.budget === "number" ? updates.budget : current.budget,
    travelStyle: typeof updates.travelStyle === "string" ? updates.travelStyle : current.travelStyle,
    status: updates.status ?? current.status,
    createdAt: current.createdAt,
    updatedAt: new Date().toISOString(),
  })

  store.trips[index] = nextTrip
  return clone(nextTrip)
}

export function deleteTrip(id: string) {
  const store = getStore()
  const initialLength = store.trips.length
  store.trips = store.trips.filter((trip) => trip.id !== id)
  return store.trips.length !== initialLength
}

export function getUserProfile() {
  return clone(getStore().userProfile)
}

export function updateUserProfile(updates: Partial<UserProfile>) {
  const store = getStore()
  const current = store.userProfile

  store.userProfile = {
    ...current,
    ...updates,
    preferences: updates.preferences
      ? {
          ...current.preferences,
          ...updates.preferences,
        }
      : current.preferences,
    settings: updates.settings
      ? {
          ...current.settings,
          ...updates.settings,
          notifications: updates.settings.notifications
            ? {
                ...current.settings.notifications,
                ...updates.settings.notifications,
              }
            : current.settings.notifications,
          privacy: updates.settings.privacy
            ? {
                ...current.settings.privacy,
                ...updates.settings.privacy,
              }
            : current.settings.privacy,
        }
      : current.settings,
  }

  return clone(store.userProfile)
}

export function getPopularAttractions() {
  return clone(popularAttractions)
}

export function getHiddenGemAttractions() {
  return clone(hiddenGemAttractions)
}

export function getAIRecommendationFallbacks() {
  return clone(aiRecommendationFallbacks)
}

export function getAllAttractions() {
  return [...getPopularAttractions(), ...getHiddenGemAttractions(), ...getAIRecommendationFallbacks()]
}

export function searchAttractions(query: string, type?: string) {
  const normalizedQuery = query.trim().toLowerCase()
  const normalizedType = type?.trim()

  return getAllAttractions().filter((attraction) => {
    const matchesQuery =
      normalizedQuery.length === 0 ||
      attraction.name.toLowerCase().includes(normalizedQuery) ||
      attraction.location.toLowerCase().includes(normalizedQuery) ||
      attraction.description.toLowerCase().includes(normalizedQuery)

    const matchesType = !normalizedType || normalizedType === "all" || attraction.type === normalizedType

    return matchesQuery && matchesType
  })
}

export function getCities() {
  const cityMap = new Map<string, { id: string; name: string; country: string }>()

  for (const attraction of getAllAttractions()) {
    const [name, country] = attraction.location.split(",").map((item) => item.trim())
    const id = name.toLowerCase()

    if (!cityMap.has(id)) {
      cityMap.set(id, { id, name, country: country ?? "" })
    }
  }

  return Array.from(cityMap.values())
}

export function getAttractionsByCityId(cityId?: string) {
  if (!cityId) {
    return getAllAttractions()
  }

  const normalizedCityId = cityId.toLowerCase()
  return getAllAttractions().filter((attraction) => attraction.location.toLowerCase().startsWith(normalizedCityId))
}

export function getAttractionById(id: string) {
  const attractionId = Number(id)
  if (Number.isNaN(attractionId)) {
    return null
  }

  return getAllAttractions().find((attraction) => attraction.id === attractionId) ?? null
}
