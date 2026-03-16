/**
 * 携程酒店 API：getAdHotels 热门/达人推荐酒店
 * 需配置环境变量 CTRIP_PHANTOM_TOKEN（请求头 phantom-token），可选 CTRIP_COOKIE
 * 若接口 403/401 请从浏览器重新复制 token 与 cookie
 */

/** 房型简要信息（来自 roomInfo[].summary + priceInfo + bedInfo） */
export interface CtripRoomInfo {
  roomName: string
  roomId?: string
  price?: number
  priceDisplay?: string
  deleteDisplayPrice?: string
  bedSummary?: string
}

export interface CtripHotelItem {
  hotelId: string
  hotelName: string
  enName?: string
  star: number
  starType: number
  hotelImage: string
  detailUrl: string
  score: string
  commentNumber: string
  commentDescription: string
  fullRating: string
  price: string
  priceDelete: string
  soldOut: boolean
  position: string
  cityId: number
  cityName?: string
  /** 详细地址 */
  address?: string
  /** 位置描述，如 "近外滩 · 陆家嘴" */
  positionDesc?: string
  /** 商圈/区域名 */
  zoneNames?: string[]
  /** 纬度（BD09） */
  latitude?: number
  /** 经度（BD09） */
  longitude?: number
  coordinateType?: string
  /** 房型列表（首条为最低价房型） */
  roomInfo?: CtripRoomInfo[]
}

export interface CtripHotelsResponse {
  data?: {
    adList?: Array<{
      position: string
      title: string
      hotels: Array<{
        base: {
          hotelName: string
          star: number
          starType: number
          hotelId: string
          hotelImage: string
          detailUrl: string
        }
        comment: {
          score: string
          number: string
          description: string
          fullRating: string
        }
        money: {
          price: string
          priceDelete: string
          soldOut: boolean
        }
      }>
    }>
  }
  ResponseStatus?: { Ack: string }
}

const GET_AD_HOTELS_URL = "https://m.ctrip.com/restapi/soa2/34951/getAdHotels"
const FETCH_HOTEL_LIST_URL = "https://m.ctrip.com/restapi/soa2/34951/fetchHotelList"

function getCtripHeaders(phantomToken: string, cookie: string): Record<string, string> {
  const headers: Record<string, string> = {
    accept: "application/json",
    "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
    "content-type": "application/json",
    origin: "https://hotels.ctrip.com",
    referer: "https://hotels.ctrip.com/",
    "sec-ch-ua": '"Chromium";v="130", "Google Chrome";v="130", "Not?A_Brand";v="99"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-site",
    "user-agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    "x-ctx-country": "CN",
    "x-ctx-currency": "CNY",
    "x-ctx-locale": "zh-CN",
  }
  if (phantomToken) headers["phantom-token"] = phantomToken
  if (cookie) headers["cookie"] = cookie
  return headers
}

function getDefaultHead(cityId: number, checkIn?: string, checkOut?: string) {
  const cid = "1762097326536.3902IvJwJuDt"
  return {
    platform: "PC",
    cver: "0",
    cid,
    bu: "HBU",
    group: "ctrip",
    aid: "4902",
    sid: "22921635",
    ouid: "",
    locale: "zh-CN",
    timezone: "8",
    currency: "CNY",
    pageId: "10650171192",
    vid: cid,
    guid: "",
    isSSR: false,
    extension: [
      { name: "cityId", value: String(cityId) },
      { name: "checkIn", value: checkIn || "2026/03/16" },
      { name: "checkOut", value: checkOut || "2026/03/17" },
      { name: "region", value: "CN" },
    ],
  }
}

/**
 * 请求携程 getAdHotels，返回去重后的酒店列表
 */
export async function fetchCtripAdHotels(
  cityId: number,
  options?: { checkIn?: string; checkOut?: string }
): Promise<CtripHotelItem[]> {
  const phantomToken = process.env.CTRIP_PHANTOM_TOKEN
  const cookie = process.env.CTRIP_COOKIE || ""

  const body = {
    cityId,
    adPositionCodes: ["HTL_LST_002", "HTL_LST_001"],
    head: getDefaultHead(
      cityId,
      options?.checkIn,
      options?.checkOut
    ),
  }

  const headers = getCtripHeaders(phantomToken ?? "", cookie)

  const res = await fetch(GET_AD_HOTELS_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    throw new Error(`携程酒店 API 请求失败: ${res.status} ${await res.text()}`)
  }

  const json = (await res.json()) as CtripHotelsResponse
  if (json.ResponseStatus?.Ack !== "Success") {
    throw new Error("携程酒店 API 返回非 Success")
  }

  const adList = json.data?.adList ?? []
  const seen = new Set<string>()
  const list: CtripHotelItem[] = []

  for (const block of adList) {
    for (const h of block.hotels ?? []) {
      const id = h.base?.hotelId
      if (!id || seen.has(id)) continue
      seen.add(id)
      list.push({
        hotelId: id,
        hotelName: h.base.hotelName || "",
        star: h.base.star ?? 0,
        starType: h.base.starType ?? 0,
        hotelImage: h.base.hotelImage || "",
        detailUrl: h.base.detailUrl || "",
        score: h.comment?.score ?? "",
        commentNumber: h.comment?.number ?? "",
        commentDescription: h.comment?.description ?? "",
        fullRating: h.comment?.fullRating ?? "",
        price: h.money?.price ?? "",
        priceDelete: h.money?.priceDelete ?? "",
        soldOut: h.money?.soldOut ?? false,
        position: block.position || "",
        cityId,
      })
    }
  }

  return list
}

// ---------- fetchHotelList 列表接口（支持分页） ----------

interface FetchHotelListResponse {
  data?: {
    hotelList?: Array<{
      hotelInfo: {
        summary: { hotelId: string }
        nameInfo?: { name?: string; enName?: string }
        hotelStar?: { star?: number; starType?: number }
        hotelImages?: { multiImgs?: Array<{ url?: string }> }
        commentInfo?: {
          commentScore?: string
          commentDescription?: string
          commenterNumber?: string
          fullRating?: string
        }
        positionInfo?: {
          cityId?: number
          cityName?: string
          address?: string
          positionDesc?: string
          zoneNames?: string[]
          mapCoordinate?: Array<{ latitude?: string; longitude?: string; gcoordType?: string }>
        }
      }
      roomInfo?: Array<{
        summary?: { saleRoomName?: string; physicsName?: string; roomId?: string }
        priceInfo?: {
          price?: number
          displayPrice?: string
          deletePrice?: number
          deleteDisplayPrice?: string
        }
        bedInfo?: { contentList?: string[] }
      }>
    }>
    hotelListAddtionInfo?: { isLastPage?: boolean }
  }
  ResponseStatus?: { Ack: string }
}

/**
 * 请求携程 fetchHotelList（列表分页），返回当前页酒店列表，格式与 CtripHotelItem 兼容
 */
export async function fetchCtripHotelList(
  cityId: number,
  options?: {
    checkIn?: string
    checkOut?: string
    pageIndex?: number
    pageSize?: number
    sessionId?: string
  }
): Promise<{ hotels: CtripHotelItem[]; isLastPage: boolean }> {
  const phantomToken = process.env.CTRIP_PHANTOM_TOKEN ?? ""
  const cookie = process.env.CTRIP_COOKIE ?? ""
  const checkIn = options?.checkIn ?? "2026/03/16"
  const checkOut = options?.checkOut ?? "2026/03/17"
  const pageIndex = options?.pageIndex ?? 1
  const pageSize = options?.pageSize ?? 10
  const sessionId = options?.sessionId ?? ""

  const body = {
    date: {
      dateType: 1,
      dateInfo: {
        checkInDate: checkIn.replace(/\D/g, "").slice(0, 8),
        checkOutDate: checkOut.replace(/\D/g, "").slice(0, 8),
      },
    },
    destination: {
      type: 1,
      geo: { cityId, countryId: 1 },
      keyword: { word: "" },
    },
    extraFilter: {
      childInfoItems: [],
      ctripMainLandBDCoordinate: true,
      sessionId: sessionId || undefined,
      extendableParams: { tripWalkDriveSwitch: "T", isUgcSentenceB: "" },
    },
    filters: [
      { type: "17", title: " ", value: "1", filterId: "17|1" },
      { type: "80", title: "", value: "2", filterId: "80|2" },
      { filterId: "29|1", type: "29", value: "1|1" },
    ],
    roomQuantity: 1,
    marketInfo: {},
    paging: { pageIndex, pageSize, pageCode: "10650171192" },
    head: getDefaultHead(cityId, checkIn, checkOut),
  }

  const headers = getCtripHeaders(phantomToken, cookie)

  const res = await fetch(FETCH_HOTEL_LIST_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    throw new Error(`携程 fetchHotelList 请求失败: ${res.status} ${await res.text()}`)
  }

  const json = (await res.json()) as FetchHotelListResponse
  if (json.ResponseStatus?.Ack !== "Success") {
    throw new Error("携程 fetchHotelList 返回非 Success")
  }

  const hotelList = json.data?.hotelList ?? []
  const isLastPage = json.data?.hotelListAddtionInfo?.isLastPage ?? false

  const hotels: CtripHotelItem[] = hotelList.map((item) => {
    const info = item.hotelInfo
    const firstRoom = item.roomInfo?.[0]
    const firstPrice = firstRoom?.priceInfo
    const coord = info.positionInfo?.mapCoordinate?.[0]
    const lat = coord?.latitude != null ? parseFloat(String(coord.latitude)) : undefined
    const lng = coord?.longitude != null ? parseFloat(String(coord.longitude)) : undefined
    const rooms: CtripRoomInfo[] = (item.roomInfo ?? []).map((r) => ({
      roomName: r.summary?.saleRoomName ?? r.summary?.physicsName ?? "",
      roomId: r.summary?.roomId,
      price: r.priceInfo?.price,
      priceDisplay: r.priceInfo?.displayPrice,
      deleteDisplayPrice: r.priceInfo?.deleteDisplayPrice,
      bedSummary: r.bedInfo?.contentList?.join("、"),
    }))
    return {
      hotelId: info.summary?.hotelId ?? "",
      hotelName: info.nameInfo?.name ?? "",
      enName: info.nameInfo?.enName,
      star: info.hotelStar?.star ?? 0,
      starType: info.hotelStar?.starType ?? 0,
      hotelImage: info.hotelImages?.multiImgs?.[0]?.url ?? "",
      detailUrl: `/hotels/${info.summary?.hotelId ?? ""}.html`,
      score: info.commentInfo?.commentScore ?? "",
      commentNumber: info.commentInfo?.commenterNumber ?? "",
      commentDescription: info.commentInfo?.commentDescription ?? "",
      fullRating: info.commentInfo?.fullRating ?? "",
      price: firstPrice?.displayPrice ?? (firstPrice?.price != null ? `¥${firstPrice.price}` : ""),
      priceDelete: firstPrice?.deleteDisplayPrice ?? "",
      soldOut: false,
      position: "fetchHotelList",
      cityId: info.positionInfo?.cityId ?? cityId,
      cityName: info.positionInfo?.cityName,
      address: info.positionInfo?.address,
      positionDesc: info.positionInfo?.positionDesc,
      zoneNames: info.positionInfo?.zoneNames?.length ? info.positionInfo.zoneNames : undefined,
      latitude: lat,
      longitude: lng,
      coordinateType: coord?.gcoordType,
      roomInfo: rooms.length ? rooms : undefined,
    }
  })

  return { hotels, isLastPage }
}
