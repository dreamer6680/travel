import clientPromise from "./db"
import type { TripActivityKind } from "./types/trip"

interface Recomendation {
  id: number
  name: string
  location: string
  rating: number
  type: string
  description: string
  imageUrl: string
  likes: number
}

interface User {
  id: number
  name: string
  email: string
  password: string
  avatar: string
  phone: string
  location: string
  bio: string
  joinDate: string
  role: "user" | "admin"
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

interface Trip {
  id: number
  title: string
  userId: string
  destination: string
  startDate: string
  endDate: string
  budget: number
  travelers: number
  travelStyle: string
  status: "draft" | "planning" | "confirmed" | "completed"
  highlights: string[]
  days: {
    day: number
    title: string
    activities: {
      time: string
      type: TripActivityKind
      title?: string
      description?: string
      location?: string
      ref?: { attractionId?: string; hotelId?: string; restaurantId?: string }
    }[]
  }[]
  recommendations: {
    name: string
    type: string
  }[]
  practicalInfo: {
    transportation: { name: string; cost: number; icon: string }[]
    accommodation: { name: string; cost: number; icon: string }[]
    tips: string[]
  }
  createdAt: string
  updatedAt: string
}

interface TravelBlog {
  id: number
  userId: string
  tripId?: string
  title: string
  content: string
  images: string[]
  destination: string
  tags: string[]
  likes: number
  likedBy: string[]
  comments: {
    id: string
    userId: string
    userName: string
    userAvatar: string
    content: string
    createdAt: string
  }[]
  status: "draft" | "published"
  createdAt: string
  updatedAt: string
}

export async function initDatabase() {
  try {
    const client = await clientPromise
    const db = client.db("trip")

    const attractions = db.collection<Recomendation>("Recomendations")
    const users = db.collection<User>("Users")
    const trips = db.collection<Trip>("Trips")
    const blogs = db.collection<TravelBlog>("TravelBlogs")

    // 清空现有数据
    await attractions.deleteMany({})
    await users.deleteMany({})
    await trips.deleteMany({})
    await blogs.deleteMany({})

    const initialTrips: Trip[] = [
      {
        id: 1,
        userId: "user1",
        title: "东京 5 日游",
        destination: "东京",
        startDate: "2025-07-15",
        endDate: "2025-07-20",
        travelers: 2,
        budget: 12500,
        travelStyle: "balanced",
        status: "confirmed",
        highlights: ["东京塔", "浅草寺", "teamLab", "筑地市场", "银座"],
        days: [
          {
            day: 1,
            title: "浅草 & 晴空塔",
            activities: [
              {
                time: "09:00 - 11:00",
                title: "浅草寺",
                type: "recommendation",
                description: "东京最古老的寺庙，体验传统日本文化。可以在仲见世通购买纪念品和品尝小吃。",
              },
              {
                time: "11:30 - 13:00",
                title: "午餐：浅草寿司",
                type: "restaurant",
                description: "品尝正宗的日本寿司，位于浅草寺附近的人气餐厅。",
              },
              {
                time: "14:00 - 16:00",
                title: "东京晴空塔",
                type: "recommendation",
                description: "登上东京最高的观景台，俯瞰整个东京城市风光。",
              },
              {
                time: "16:30 - 18:30",
                title: "晴空塔购物中心",
                type: "others",
                description: "在日本最大的购物中心之一享受购物体验。",
              },
              {
                time: "19:00 - 21:00",
                title: "晚餐：隅田川旁餐厅",
                type: "restaurant",
                description: "在隅田川旁享用晚餐，欣赏晴空塔的夜景。",
              },
            ],
          },
        ],
        recommendations: [
          { name: "明治神宫", type: "文化景点" },
          { name: "六本木之丘", type: "购物 & 观景" },
          { name: "吉卜力美术馆", type: "博物馆" },
          { name: "东京迪士尼", type: "主题公园" },
          { name: "代官山", type: "时尚街区" },
          { name: "日本科学未来馆", type: "博物馆" },
        ],
        practicalInfo: {
          transportation: [
            { name: "地铁通行证", cost: 800, icon: "Train" },
            { name: "机场至市区", cost: 3000, icon: "Train" },
          ],
          accommodation: [
            { name: "新宿格兰贝尔酒店", cost: 1200, icon: "Hotel" },
            { name: "涩谷东急酒店", cost: 1500, icon: "Hotel" },
          ],
          tips: [
            "日本使用日元，建议提前兑换或在机场兑换",
            "大多数商店接受信用卡，但小店和部分餐厅可能只接受现金",
            "公共场所提供免费 WiFi，也可以租借随身 WiFi",
            "东京夏季炎热潮湿，建议携带防晒用品和轻便衣物",
            "日本非常注重垃圾分类，请遵循当地规定",
          ],
        },
        createdAt: "2025-01-01T00:00:00Z",
        updatedAt: "2025-01-02T00:00:00Z",
      },
      {
        id: 2,
        userId: "user1",
        destination: "巴黎",
        title: "巴黎 5 日游",
        startDate: "2025-09-10",
        endDate: "2025-09-17",
        travelers: 2,
        budget: 15000,
        travelStyle: "cultural",
        status: "draft",
        highlights: ["埃菲尔铁塔", "卢浮宫", "凯旋门", "蒙马特高地", "塞纳河"],
        days: [],
        recommendations: [],
        practicalInfo: {
          transportation: [],
          accommodation: [],
          tips: [],
        },
        createdAt: "2025-01-03T00:00:00Z",
        updatedAt: "2025-01-03T00:00:00Z",
      },
      {
        id: 3,
        userId: "user1",
        title: "北京 5 日游",
        destination: "北京",
        startDate: "2025-08-10",
        endDate: "2025-08-15",
        travelers: 2,
        budget: 8000,
        travelStyle: "cultural",
        status: "confirmed",
        highlights: ["故宫", "长城", "颐和园"],
        // 演示数据：正式环境由 Agent 生成；days 可为 ref-only，需与 PG 向量库 id 一致
        days: [],
        recommendations: [
          { name: "天坛", type: "文化景点" },
          { name: "国家大剧院", type: "文化场馆" },
          { name: "北海公园", type: "公园" },
        ],
        practicalInfo: {
          transportation: [
            { name: "北京地铁一卡通", cost: 150, icon: "Train" },
            { name: "机场快轨", cost: 300, icon: "Train" },
          ],
          accommodation: [
            { name: "北京王府井希尔顿酒店", cost: 1200, icon: "Hotel" },
            { name: "北京和平饭店", cost: 900, icon: "Hotel" },
          ],
          tips: [
            "北京夏季炎热，注意防晒和补水",
            "部分景点需提前预约门票",
            "市内推荐地铁与共享单车",
          ],
        },
        createdAt: "2025-05-01T00:00:00Z",
        updatedAt: "2025-05-02T00:00:00Z",
      },
      
    ]

    await trips.insertMany(initialTrips)

    const initialUsers: User[] = [
      {
        id: 1,
        name: "张三",
        email: "zhangsan@example.com",
        password: "123456",
        avatar: "/placeholder.svg?height=100&width=100",
        phone: "+86 138 0013 8000",
        location: "北京, 中国",
        bio: "热爱旅行的探索者，喜欢发现世界各地的美景和文化。",
        joinDate: "2024-01-15T00:00:00Z",
        role: "user",
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
      },
      {
        id: 2,
        name: "管理员",
        email: "admin@example.com",
        password: "admin123",
        avatar: "/placeholder.svg?height=100&width=100",
        phone: "+86 138 0000 0000",
        location: "北京, 中国",
        bio: "系统管理员",
        joinDate: "2024-01-01T00:00:00Z",
        role: "admin",
        preferences: {
          budget: 0,
          travelStyle: "balanced",
          favoriteDestinations: [],
          interests: [],
          seasons: [],
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
            profileVisible: false,
            tripsVisible: false,
          },
          language: "zh-CN",
          currency: "CNY",
        },
        stats: {
          totalTrips: 0,
          countriesVisited: 0,
          totalDistance: 0,
          favoriteDestination: "",
        },
      },
    ]

    await users.insertMany(initialUsers)

    // const initialData: Recomendation[] = [
    //   {
    //     id: 1,
    //     name: "东京塔",
    //     location: "东京, 日本",
    //     rating: 4.7,
    //     type: "观景台",
    //     description: "东京的标志性建筑，可俯瞰整个城市",
    //     imageUrl: "/placeholder.svg?height=200&width=300",
    //     likes: 0,
    //   },
    //   {
    //     id: 2,
    //     name: "巴黎铁塔",
    //     location: "巴黎, 法国",
    //     rating: 4.8,
    //     type: "观景台",
    //     description: "法国最著名的地标建筑",
    //     imageUrl: "/placeholder.svg?height=200&width=300",
    //     likes: 0,
    //   },
    //   {
    //     id: 3,
    //     name: "大峡谷",
    //     location: "亚利桑那, 美国",
    //     rating: 4.9,
    //     type: "自然景观",
    //     description: "世界七大自然奇观之一",
    //     imageUrl: "/placeholder.svg?height=200&width=300",
    //     likes: 0,
    //   },
    //   {
    //     id: 4,
    //     name: "故宫",
    //     location: "北京, 中国",
    //     rating: 4.8,
    //     type: "历史建筑",
    //     description: "中国明清两代的皇家宫殿",
    //     imageUrl: "/placeholder.svg?height=200&width=300",
    //     likes: 0,
    //   },
    //   {
    //     id: 5,
    //     name: "大英博物馆",
    //     location: "伦敦, 英国",
    //     rating: 4.7,
    //     type: "博物馆",
    //     description: "世界上历史最悠久的博物馆之一",
    //     imageUrl: "/placeholder.svg?height=200&width=300",
    //     likes: 0,
    //   },
    //   {
    //     id: 6,
    //     name: "悉尼歌剧院",
    //     location: "悉尼, 澳大利亚",
    //     rating: 4.6,
    //     type: "建筑",
    //     description: "世界著名的表演艺术中心",
    //     imageUrl: "/placeholder.svg?height=200&width=300",
    //     likes: 0,
    //   },
    //   {
    //     id: 7,
    //     name: "中目黑樱花道",
    //     location: "东京, 日本",
    //     rating: 4.5,
    //     type: "自然景观",
    //     description: "春季樱花盛开的绝美步道",
    //     imageUrl: "/placeholder.svg?height=200&width=300",
    //     likes: 0,
    //   },
    //   {
    //     id: 8,
    //     name: "蒙马特高地",
    //     location: "巴黎, 法国",
    //     rating: 4.4,
    //     type: "文化区",
    //     description: "艺术家聚集的浪漫街区",
    //     imageUrl: "/placeholder.svg?height=200&width=300",
    //     likes: 0,
    //   },
    //   {
    //     id: 9,
    //     name: "798艺术区",
    //     location: "北京, 中国",
    //     rating: 4.3,
    //     type: "艺术区",
    //     description: "当代艺术和创意产业聚集地",
    //     imageUrl: "/placeholder.svg?height=200&width=300",
    //     likes: 0,
    //   },
    //   {
    //     id: 10,
    //     name: "布鲁克林高线公园",
    //     location: "纽约, 美国",
    //     rating: 4.4,
    //     type: "公园",
    //     description: "废弃铁路改造的空中花园",
    //     imageUrl: "/placeholder.svg?height=200&width=300",
    //     likes: 0,
    //   },
    //   {
    //     id: 11,
    //     name: "诺丁山",
    //     location: "伦敦, 英国",
    //     rating: 4.2,
    //     type: "街区",
    //     description: "色彩缤纷的维多利亚式房屋街区",
    //     imageUrl: "/placeholder.svg?height=200&width=300",
    //     likes: 0,
    //   },
    //   {
    //     id: 12,
    //     name: "邦迪海滩",
    //     location: "悉尼, 澳大利亚",
    //     rating: 4.6,
    //     type: "海滩",
    //     description: "世界著名的冲浪海滩",
    //     imageUrl: "/placeholder.svg?height=200&width=300",
    //     likes: 0,
    //   },
    //   {
    //     id: 13,
    //     name: "teamLab无界",
    //     location: "东京, 日本",
    //     rating: 4.9,
    //     type: "艺术展览",
    //     description: "沉浸式数字艺术体验",
    //     imageUrl: "/placeholder.svg?height=200&width=300",
    //     likes: 0,
    //   },
    //   {
    //     id: 14,
    //     name: "卢浮宫",
    //     location: "巴黎, 法国",
    //     rating: 4.8,
    //     type: "博物馆",
    //     description: "世界最大的艺术博物馆",
    //     imageUrl: "/placeholder.svg?height=200&width=300",
    //     likes: 0,
    //   },
    //   {
    //     id: 15,
    //     name: "天坛",
    //     location: "北京, 中国",
    //     rating: 4.7,
    //     type: "历史建筑",
    //     description: "明清皇帝祭天的场所",
    //     imageUrl: "/placeholder.svg?height=200&width=300",
    //     likes: 0,
    //   },
    //   {
    //     id: 16,
    //     name: "中央公园",
    //     location: "纽约, 美国",
    //     rating: 4.6,
    //     type: "公园",
    //     description: "曼哈顿的绿色心脏",
    //     imageUrl: "/placeholder.svg?height=200&width=300",
    //     likes: 0,
    //   },
    //   {
    //     id: 17,
    //     name: "泰特现代美术馆",
    //     location: "伦敦, 英国",
    //     rating: 4.5,
    //     type: "博物馆",
    //     description: "世界领先的现代艺术博物馆",
    //     imageUrl: "/placeholder.svg?height=200&width=300",
    //     likes: 0,
    //   },
    //   {
    //     id: 18,
    //     name: "皇家植物园",
    //     location: "悉尼, 澳大利亚",
    //     rating: 4.4,
    //     type: "公园",
    //     description: "澳大利亚最古老的植物园",
    //     imageUrl: "/placeholder.svg?height=200&width=300",
    //     likes: 0,
    //   },
    // ]

    // await attractions.insertMany(initialData)

    const initialBlogs: TravelBlog[] = [
      {
        id: 1,
        userId: "user1",
        tripId: "1",
        title: "东京5日游：传统与现代的完美融合",
        content: `# 东京之旅

这次东京之行真的让我印象深刻！从传统的浅草寺到现代的晴空塔，东京完美地融合了传统与现代。

## 第一天：浅草寺与晴空塔

早上我们首先来到了浅草寺，这里是东京最古老的寺庙。仲见世通的小吃和纪念品让人目不暇接，特别推荐人形烧和雷门饼干。

下午登上了晴空塔，634米的高度让整个东京尽收眼底。夜景更是美得令人窒息！

## 美食体验

东京的美食真的是太棒了！从浅草的传统寿司到银座的高级料理，每一餐都是享受。特别推荐筑地市场的海鲜丼，新鲜到爆炸！

## 购物天堂

银座、涩谷、原宿...每个区域都有不同的购物体验。在涩谷109买了很多可爱的小物件，价格也很合理。

总的来说，这次东京之行超出了我的期待，已经开始计划下次的京都之旅了！`,
        images: [
          "/placeholder.svg?height=400&width=600",
          "/placeholder.svg?height=400&width=600",
          "/placeholder.svg?height=400&width=600",
        ],
        destination: "东京, 日本",
        tags: ["东京", "美食", "购物", "传统文化", "现代都市"],
        likes: 128,
        likedBy: ["user2", "user3", "user4"],
        comments: [
          {
            id: "comment1",
            userId: "user2",
            userName: "李四",
            userAvatar: "/placeholder.svg?height=40&width=40",
            content: "写得太好了！我也想去东京了，请问有什么推荐的住宿吗？",
            createdAt: "2025-01-05T10:30:00Z",
          },
          {
            id: "comment2",
            userId: "user3",
            userName: "王五",
            userAvatar: "/placeholder.svg?height=40&width=40",
            content: "照片拍得真美！晴空塔的夜景确实很震撼",
            createdAt: "2025-01-05T14:20:00Z",
          },
        ],
        status: "published",
        createdAt: "2025-01-05T08:00:00Z",
        updatedAt: "2025-01-05T08:00:00Z",
      },
      {
        id: 2,
        userId: "user1",
        title: "巴黎浪漫之旅规划中",
        content: "正在规划9月的巴黎之行，期待埃菲尔铁塔的日落...",
        images: [],
        destination: "巴黎, 法国",
        tags: ["巴黎", "规划中"],
        likes: 5,
        likedBy: ["user2"],
        comments: [],
        status: "draft",
        createdAt: "2025-01-06T12:00:00Z",
        updatedAt: "2025-01-06T12:00:00Z",
      },
    ]

    await blogs.insertMany(initialBlogs)

    console.log("✅ Database initialized with sample data.")
  } catch (err) {
    console.error("❌ Database initialization failed:", err)
  }
}
