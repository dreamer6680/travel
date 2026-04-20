import { create } from "zustand"
import { type TripDetailResponse, type EnrichedDay } from "@/lib/types/trip"

export type LoadedTrip = TripDetailResponse

interface TripStore {
  /** 按 tripId 缓存，避免重复 fetch */
  cache: Record<string, LoadedTrip>
  currentTripId: string | null
  isLoading: boolean
  error: string | null

  /** 获取当前行程（从缓存取） */
  currentTrip: () => LoadedTrip | null

  /**
   * 拉取行程。已缓存且 force=false 时直接返回缓存，
   * 否则调 GET /api/trips/:id 并写入缓存。
   */
  fetchTrip: (id: string, force?: boolean) => Promise<void>

  /** 本地乐观更新单个活动（用于用户修改行程时即时刷新 UI） */
  updateActivity: (
    tripId: string,
    dayIndex: number,
    actIndex: number,
    patch: Partial<EnrichedDay["activities"][number]>
  ) => void

  /** 使缓存失效（用于确认行程或替换景点后强制刷新） */
  invalidate: (tripId: string) => void

  setCurrentTripId: (id: string | null) => void
}

export const useTripStore = create<TripStore>((set, get) => ({
  cache: {},
  currentTripId: null,
  isLoading: false,
  error: null,

  currentTrip: () => {
    const { currentTripId, cache } = get()
    return currentTripId ? (cache[currentTripId] ?? null) : null
  },

  fetchTrip: async (id, force = false) => {
    const { cache } = get()
    if (!force && cache[id]) {
      set({ currentTripId: id })
      return
    }

    set({ isLoading: true, error: null, currentTripId: id })
    try {
      const res = await fetch(`/api/trips/${id}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: LoadedTrip = await res.json()
      set((s) => ({
        cache: { ...s.cache, [id]: data },
        isLoading: false,
      }))
    } catch (e: any) {
      set({ isLoading: false, error: e?.message ?? "获取行程失败" })
    }
  },

  updateActivity: (tripId, dayIndex, actIndex, patch) => {
    set((s) => {
      const trip = s.cache[tripId]
      if (!trip) return s
      const days = trip.days.map((d, di) => {
        if (di !== dayIndex) return d
        return {
          ...d,
          activities: d.activities.map((a, ai) =>
            ai === actIndex ? { ...a, ...patch } : a
          ),
        }
      })
      return { cache: { ...s.cache, [tripId]: { ...trip, days } } }
    })
  },

  invalidate: (tripId) => {
    set((s) => {
      const { [tripId]: _, ...rest } = s.cache
      return { cache: rest }
    })
  },

  setCurrentTripId: (id) => set({ currentTripId: id }),
}))
