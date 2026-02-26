import clientPromise from "@/lib/db"

export class UserService {
  /**
   * 根据用户 ID 获取用户资料
   */
  async getUserProfile(userId?: string) {
    try {
      const client = await clientPromise
      const db = client.db("trip")
      const collection = db.collection("Users")

      // 如果没有提供 userId，返回默认用户（用于兼容）
      if (!userId) {
        const defaultUser = await collection.findOne({ email: "zhangsan@example.com" })
        if (defaultUser) {
          return this.formatUserProfile(defaultUser)
        }
        // 如果数据库中没有默认用户，返回临时数据
        return {
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
      }

      // 根据 userId 查询用户
      let user = null
      try {
        const userIdNum = Number(userId)
        if (!isNaN(userIdNum)) {
          user = await collection.findOne({ id: userIdNum })
        }
      } catch (e) {
        // 忽略数字转换错误
      }
      
      if (!user) {
        // 尝试通过 _id 查找（如果是 ObjectId 字符串）
        try {
          const { ObjectId } = require("mongodb")
          if (ObjectId.isValid(userId)) {
            user = await collection.findOne({ _id: new ObjectId(userId) })
          }
        } catch (e) {
          // 忽略 ObjectId 转换错误
        }
      }

      if (!user) {
        throw new Error("用户不存在")
      }

      return this.formatUserProfile(user)
    } catch (error) {
      console.error("获取用户资料失败:", error)
      throw error
    }
  }

  /**
   * 格式化用户资料（移除敏感信息）
   */
  private formatUserProfile(user: any) {
    const { password, ...userProfile } = user
    return {
      id: user.id || user._id.toString(),
      name: user.name,
      email: user.email,
      avatar: user.avatar || "/placeholder.svg?height=100&width=100",
      phone: user.phone || "",
      location: user.location || "",
      bio: user.bio || "",
      joinDate: user.joinDate || user.createdAt,
      role: user.role || "user",
      preferences: user.preferences || {
        budget: 0,
        travelStyle: "balanced",
        favoriteDestinations: [],
        interests: [],
        seasons: [],
        accommodationType: "hotel",
        transportationPreference: "public",
      },
      settings: user.settings || {
        notifications: {
          email: true,
          push: true,
          sms: false,
        },
        privacy: {
          profileVisible: true,
          tripsVisible: true,
        },
        language: "zh-CN",
        currency: "CNY",
      },
      stats: user.stats || {
        totalTrips: 0,
        countriesVisited: 0,
        totalDistance: 0,
        favoriteDestination: "",
      },
    }
  }

  /**
   * 更新用户资料
   */
  async updateUserProfile(userId: string, userData: any) {
    try {
      const client = await clientPromise
      const db = client.db("trip")
      const collection = db.collection("Users")

      // 移除不允许直接更新的字段
      const { password, id, email, ...updateData } = userData

      // 构建查询条件
      let query: any = {}
      try {
        const userIdNum = Number(userId)
        if (!isNaN(userIdNum)) {
          query.id = userIdNum
        } else {
          const { ObjectId } = require("mongodb")
          if (ObjectId.isValid(userId)) {
            query._id = new ObjectId(userId)
          } else {
            query.id = userId
          }
        }
      } catch (e) {
        query.id = userId
      }

      const result = await collection.updateOne(
        query,
        {
          $set: {
            ...updateData,
            updatedAt: new Date().toISOString(),
          },
        }
      )

      if (result.matchedCount === 0) {
        throw new Error("用户不存在")
      }

      // 返回更新后的用户信息
      return await this.getUserProfile(userId)
    } catch (error) {
      console.error("更新用户资料失败:", error)
      throw error
    }
  }

  /**
   * 更新用户偏好设置
   */
  async updatePreferences(userId: string, preferences: any) {
    try {
      const client = await clientPromise
      const db = client.db("trip")
      const collection = db.collection("Users")

      // 构建查询条件
      let query: any = {}
      try {
        const userIdNum = Number(userId)
        if (!isNaN(userIdNum)) {
          query.id = userIdNum
        } else {
          const { ObjectId } = require("mongodb")
          if (ObjectId.isValid(userId)) {
            query._id = new ObjectId(userId)
          } else {
            query.id = userId
          }
        }
      } catch (e) {
        query.id = userId
      }

      const result = await collection.updateOne(
        query,
        {
          $set: {
            preferences,
            updatedAt: new Date().toISOString(),
          },
        }
      )

      if (result.matchedCount === 0) {
        throw new Error("用户不存在")
      }

      return { message: "偏好设置更新成功" }
    } catch (error) {
      console.error("更新偏好设置失败:", error)
      throw error
    }
  }
}

