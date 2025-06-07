import clientPromise from "./db";

interface Recomendation {
  id: number;
  name: string;
  location: string;
  rating: number;
  type: string;
  description: string;
  imageUrl: string;
}

interface User {
  id: number;
  name: string;
  email: string;
  password: string;
  avatar: string;
  phone: string;
  location: string;
  bio: string;
  joinDate: string;
  preferences: {
    budget: number;
    travelStyle: string;
    favoriteDestinations: string[];
    interests: string[];
    seasons: string[];
    accommodationType: string;
    transportationPreference: string;
  };
  settings: {
    notifications: {
      email: boolean;
      push: boolean;
      sms: boolean;
    };
    privacy: {
      profileVisible: boolean;
      tripsVisible: boolean;
    };
    language: string;
    currency: string;
  };
  stats: {
    totalTrips: number;
    countriesVisited: number;
    totalDistance: number;
    favoriteDestination: string;
  };
}

interface Trip {
  id: number;
  userId: string;
  destination: string;
  startDate: string;
  endDate: string;
  budget: number;
  travelers: number;
  travelStyle: string;
  highlights: string[];
  days: {
    day: number;
    title: string;
    activities: {
      time: string;
      title: string;
      type: string;
      description: string;
    }[];
  }[];
  recommendations: {
    name: string;
    type: string;
  }[];
  practicalInfo: {
    transportation: { name: string; cost: number; icon: string }[];
    accommodation: { name: string; cost: number; icon: string }[];
    tips: string[];
  };
  createdAt: string;
  updatedAt: string;
}

export async function initDatabase() {
  try {
    const client = await clientPromise;
    const db = client.db("trip");

    const attractions = db.collection<Recomendation>("Recomendations");
    const users = db.collection<User>("Users");
    const trips = db.collection<Trip>("Trips");

    const initialTrips: Trip[] = [
        {
            id: 1,
            userId: "user1",
            destination: "东京",
            startDate: "2025-07-15",
            endDate: "2025-07-20",
            travelers: 2,
            budget: 12500,
            travelStyle: "balanced",
            highlights: ["东京塔", "浅草寺", "teamLab", "筑地市场", "银座"],
            days: [
              {
                day: 1,
                title: "浅草 & 晴空塔",
                activities: [
                  {
                    time: "09:00 - 11:00",
                    title: "浅草寺",
                    type: "景点",
                    description: "东京最古老的寺庙，体验传统日本文化。可以在仲见世通购买纪念品和品尝小吃。",
                  },
                  {
                    time: "11:30 - 13:00",
                    title: "午餐：浅草寿司",
                    type: "餐厅",
                    description: "品尝正宗的日本寿司，位于浅草寺附近的人气餐厅。",
                  },
                  {
                    time: "14:00 - 16:00",
                    title: "东京晴空塔",
                    type: "景点",
                    description: "登上东京最高的观景台，俯瞰整个东京城市风光。",
                  },
                  {
                    time: "16:30 - 18:30",
                    title: "晴空塔购物中心",
                    type: "购物",
                    description: "在日本最大的购物中心之一享受购物体验。",
                  },
                  {
                    time: "19:00 - 21:00",
                    title: "晚餐：隅田川旁餐厅",
                    type: "餐厅",
                    description: "在隅田川旁享用晚餐，欣赏晴空塔的夜景。",
                  },
                ],
              },
              // 其他天的行程...
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
        
    ];

    await trips.insertMany(initialTrips);
    console.log("✅ Database initialized with sample data.");

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
    ];

    await users.insertMany(initialUsers);
    console.log("✅ Database initialized with sample data.");

    const initialData: Recomendation[] = [
          {
            id: 13,
            name: "teamLab无界",
            location: "东京, 日本",
            rating: 4.9,
            type: "艺术展览",
            description: "沉浸式数字艺术体验",
            imageUrl: "/placeholder.svg?height=200&width=300",
          },
          {
            id: 14,
            name: "卢浮宫",
            location: "巴黎, 法国",
            rating: 4.8,
            type: "博物馆",
            description: "世界最大的艺术博物馆",
            imageUrl: "/placeholder.svg?height=200&width=300",
          },
          {
            id: 15,
            name: "天坛",
            location: "北京, 中国",
            rating: 4.7,
            type: "历史建筑",
            description: "明清皇帝祭天的场所",
            imageUrl: "/placeholder.svg?height=200&width=300",
          },
          {
            id: 16,
            name: "中央公园",
            location: "纽约, 美国",
            rating: 4.6,
            type: "公园",
            description: "曼哈顿的绿色心脏",
            imageUrl: "/placeholder.svg?height=200&width=300",
          },
          {
            id: 17,
            name: "泰特现代美术馆",
            location: "伦敦, 英国",
            rating: 4.5,
            type: "博物馆",
            description: "世界领先的现代艺术博物馆",
            imageUrl: "/placeholder.svg?height=200&width=300",
          },
          {
            id: 18,
            name: "皇家植物园",
            location: "悉尼, 澳大利亚",
            rating: 4.4,
            type: "公园",
            description: "澳大利亚最古老的植物园",
            imageUrl: "/placeholder.svg?height=200&width=300",
          },
    ];

    await attractions.insertMany(initialData);
    console.log("✅ Database initialized with sample data.");
  } catch (err) {
    console.error("❌ Database initialization failed:", err);
  }
}

initDatabase();
