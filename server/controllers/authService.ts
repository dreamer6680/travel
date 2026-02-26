import clientPromise from "@/lib/db"
import bcrypt from "bcryptjs"
import { generateToken } from "@/lib/jwt"

export class AuthService {
  /**
   * 用户登录
   */
  async login(email: string, password: string) {
    try {
      const client = await clientPromise
      const db = client.db("trip")
      const collection = db.collection("Users")

      // 查询用户
      const user = await collection.findOne({ email })

      if (!user) {
        return {
          success: false,
          message: "邮箱或密码错误",
        }
      }

      // 验证密码
      // 如果密码是明文（旧数据），先进行兼容处理
      let isPasswordValid = false
      if (user.password.startsWith("$2")) {
        // bcrypt 加密的密码
        isPasswordValid = await bcrypt.compare(password, user.password)
      } else {
        // 明文密码（兼容旧数据）
        isPasswordValid = user.password === password
        // 如果是明文且验证成功，更新为加密密码
        if (isPasswordValid) {
          const hashedPassword = await bcrypt.hash(password, 10)
          await collection.updateOne(
            { _id: user._id },
            { $set: { password: hashedPassword } }
          )
        }
      }

      if (!isPasswordValid) {
        return {
          success: false,
          message: "邮箱或密码错误",
        }
      }

      // 生成 JWT token
      const token = generateToken({
        userId: user.id?.toString() || user._id.toString(),
        email: user.email,
        role: user.role || "user",
      })

      return {
        success: true,
        token,
        user: {
          id: user.id || user._id.toString(),
          name: user.name,
          email: user.email,
          avatar: user.avatar,
          role: user.role || "user",
        },
      }
    } catch (error) {
      console.error("登录错误:", error)
      throw error
    }
  }

  /**
   * 用户注册
   */
  async register(userData: {
    name: string
    email: string
    password: string
    confirmPassword?: string
  }) {
    try {
      const client = await clientPromise
      const db = client.db("trip")
      const collection = db.collection("Users")

      // 数据校验
      if (!userData.email || !userData.password || !userData.name) {
        return {
          success: false,
          message: "姓名、邮箱和密码不能为空",
        }
      }

      // 验证邮箱格式
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(userData.email)) {
        return {
          success: false,
          message: "邮箱格式不正确",
        }
      }

      // 验证密码长度
      if (userData.password.length < 6) {
        return {
          success: false,
          message: "密码长度至少为 6 位",
        }
      }

      // 验证确认密码
      if (userData.confirmPassword && userData.password !== userData.confirmPassword) {
        return {
          success: false,
          message: "两次输入的密码不一致",
        }
      }

      // 检查邮箱是否已存在
      const existingUser = await collection.findOne({ email: userData.email })

      if (existingUser) {
        return {
          success: false,
          message: "该邮箱已被注册",
        }
      }

      // 加密密码
      const hashedPassword = await bcrypt.hash(userData.password, 10)

      // 获取下一个 ID（简单实现，生产环境建议使用更可靠的方法）
      const lastUser = await collection.findOne({}, { sort: { id: -1 } })
      const nextId = lastUser?.id ? Number(lastUser.id) + 1 : 1

      // 创建用户
      const newUser = {
        id: nextId,
        name: userData.name,
        email: userData.email,
        password: hashedPassword,
        avatar: "/placeholder.svg?height=100&width=100",
        phone: "",
        location: "",
        bio: "",
        joinDate: new Date().toISOString(),
        role: "user" as const,
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
            profileVisible: true,
            tripsVisible: true,
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
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      await collection.insertOne(newUser)

      // 生成 token
      const token = generateToken({
        userId: nextId.toString(),
        email: newUser.email,
        role: "user",
      })

      return {
        success: true,
        token,
        user: {
          id: nextId,
          name: newUser.name,
          email: newUser.email,
          avatar: newUser.avatar,
          role: "user",
        },
      }
    } catch (error) {
      console.error("注册错误:", error)
      throw error
    }
  }

  /**
   * 验证 Token 并获取用户信息
   */
  async verifyTokenAndGetUser(token: string) {
    try {
      const { verifyToken } = await import("@/lib/jwt")
      const payload = verifyToken(token)

      if (!payload) {
        return {
          success: false,
          message: "Token 无效或已过期",
        }
      }

      const client = await clientPromise
      const db = client.db("trip")
      const collection = db.collection("Users")

      // 尝试通过 id 或 _id 查找用户
      let user = null
      try {
        const userIdNum = Number(payload.userId)
        if (!isNaN(userIdNum)) {
          user = await collection.findOne({ id: userIdNum })
        }
      } catch (e) {
        // 忽略数字转换错误
      }
      
      if (!user) {
        user = await collection.findOne({ email: payload.email })
      }

      if (!user) {
        return {
          success: false,
          message: "用户不存在",
        }
      }

      return {
        success: true,
        user: {
          id: user.id || user._id.toString(),
          name: user.name,
          email: user.email,
          avatar: user.avatar,
          role: user.role || "user",
        },
      }
    } catch (error) {
      console.error("Token 验证错误:", error)
      return {
        success: false,
        message: "Token 验证失败",
      }
    }
  }
}
