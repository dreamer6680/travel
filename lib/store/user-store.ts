import { create } from "zustand"
import { persist } from "zustand/middleware"
import { getToken, removeToken } from "../api/fetch-api"
import { userAPI } from "../api"

export interface User {
  id: string
  name: string
  email: string
  avatar?: string
  role?: string
}

interface UserStore {
  // 用户信息
  user: User | null
  // 登录状态
  isAuthenticated: boolean
  // 是否正在加载
  isLoading: boolean

  // Actions
  setUser: (user: User | null) => void
  setToken: (token: string) => void
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  checkAuth: () => Promise<void>
  updateUser: (userData: Partial<User>) => void
}

export const useUserStore = create<UserStore>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,

      setUser: (user) => {
        set({
          user,
          isAuthenticated: !!user,
        })
      },

      setToken: (token: string) => {
        if (typeof window !== "undefined") {
          localStorage.setItem("token", token)
        }
        // 设置 token 后，尝试获取用户信息
        get().checkAuth()
      },

      login: async (email: string, password: string) => {
        set({ isLoading: true })
        try {
          const result = await userAPI.login(email, password)
          if (result.token && result.user) {
            // 存储 token
            if (typeof window !== "undefined") {
              localStorage.setItem("token", result.token)
            }
            // 设置用户信息
            set({
              user: result.user,
              isAuthenticated: true,
              isLoading: false,
            })
          } else {
            throw new Error(result.error || "登录失败")
          }
        } catch (error) {
          set({ isLoading: false })
          throw error
        }
      },

      logout: () => {
        removeToken()
        set({
          user: null,
          isAuthenticated: false,
        })
        // 跳转到登录页
        if (typeof window !== "undefined") {
          window.location.href = "/login"
        }
      },

      checkAuth: async () => {
        const token = getToken()
        if (!token) {
          set({
            user: null,
            isAuthenticated: false,
          })
          return
        }

        // 如果已有用户信息，直接返回
        if (get().user) {
          set({ isAuthenticated: true })
          return
        }

        // 尝试获取用户信息
        set({ isLoading: true })
        try {
          const user = await userAPI.getProfile()
          set({
            user,
            isAuthenticated: true,
            isLoading: false,
          })
        } catch (error) {
          // 获取用户信息失败，清除 token
          removeToken()
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
          })
        }
      },

      updateUser: (userData: Partial<User>) => {
        const currentUser = get().user
        if (currentUser) {
          set({
            user: {
              ...currentUser,
              ...userData,
            },
          })
        }
      },
    }),
    {
      name: "user-store",
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)
