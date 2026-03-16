import axios from "axios";
import clientPromise from "./db"

interface ScenicSpot {
    id: number
    name: string
    location: string
    rating: number
    type: string
    description: string
    imageUrl: string
    likes: number
    // 经纬度坐标（BD09 坐标系，百度地图坐标系）
    coordinate?: {
      latitude: number
      longitude: number
      coordinateType: string // 'BD09' | 'WGS84' | 'GCJ02'
    }
  }

// 请求接口，提取 poiId 和 poiName
async function fetchPoiData(page: number, districtId: number = 1, coordinate?: { latitude: number; longitude: number; coordinateType?: string }): Promise<ScenicSpot[]> {
    // 生成动态的 traceID
    const cid = '09031018114344642561'
    const timestamp = Date.now()
    const random = Math.floor(Math.random() * 10000000)
    const traceID = `${cid}-${timestamp}-${random}`
    
    const url = `https://m.ctrip.com/restapi/soa2/18109/json/getAttractionList?_fxpcqlniredt=${cid}&x-traceID=${traceID}`
    
    const requestBody: any = {
      head: {
        cid: cid,
        ctok: '',
        cver: '1.0',
        lang: '01',
        sid: '8888',
        syscode: '999',
        auth: '',
        xsid: '',
        extension: [],
      },
      scene: 'online',
      districtId: districtId,
      index: page,
      sortType: 1,
      count: 10,
      filter: {
        filterItems: [],
      },
      returnModuleType: 'product',
    }
    
    // 如果提供了坐标，添加到请求体中
    if (coordinate) {
      requestBody.coordinate = {
        latitude: coordinate.latitude,
        longitude: coordinate.longitude,
        coordinateType: coordinate.coordinateType || 'WGS84',
      }
    }
    
    const response = await axios.post(
      url,
      requestBody,
      {
        headers: {
          'accept': '*/*',
          'accept-language': 'zh-CN,zh;q=0.9',
          'content-type': 'application/json',
          'cookieorigin': 'https://you.ctrip.com',
          'origin': 'https://you.ctrip.com',
          'priority': 'u=1, i',
          'referer': 'https://you.ctrip.com/',
          'sec-ch-ua': '"Google Chrome";v="143", "Chromium";v="143", "Not A(Brand";v="24"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"macOS"',
          'sec-fetch-dest': 'empty',
          'sec-fetch-mode': 'cors',
          'sec-fetch-site': 'same-site',
          'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
          'x-ctx-ubt-pageid': '10650142842',
          'x-ctx-ubt-pvid': '4',
          'x-ctx-ubt-sid': '1',
          'x-ctx-ubt-vid': '1772099505794.b9d14tce9wmZ',
          'x-ctx-wclient-req': '7d384f8f817221074ac422fae544e3c0',
          'Cookie': 'GUID=09031018114344642561; UBT_VID=1772099505794.b9d14tce9wmZ; MKT_CKID=1772099506306.d2osp.23ka; _RGUID=7673647d-d362-4db9-878a-c7baa62307e8; nfes_isSupportWebP=1; _bfa=1.1772099505794.b9d14tce9wmZ.1.1772099531287.1772099555151.1.4.10650142842; _jzqco=%7C%7C%7C%7C1772099506774%7C1.199043078.1772099506313.1772099531485.1772099555467.1772099531485.1772099555467.undefined.0.0.4.4',
        },
      }
    );
  
    const list = response.data?.attractionList || [];
    console.log("list", list)
    return list
      .map((item: any) => item.card)
      .filter((card: any) => card?.poiId && card?.poiName)
      .map((card: any) => ({
        id: card.poiId,
        name: card.poiName,
        type: (Array.isArray(card.tagNameList) && card.tagNameList.length > 0) ? card.tagNameList[0] : '未知类型',
        rating: card.commentScore,
        location: card.districtName,
        description: card.shortFeatures,
        imageUrl: card.coverImageUrl,
        likes: card.commentCount,
        // 提取坐标信息（如果存在）
        coordinate: card.coordinate ? {
          latitude: card.coordinate.latitude,
          longitude: card.coordinate.longitude,
          coordinateType: card.coordinate.coordinateType || 'BD09',
        } : undefined,
      }));
  }
  
  function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  export async function main() {
    const db = (await clientPromise).db("trip");
    const collection = db.collection<ScenicSpot>("Recomendations");
  
    // 可以配置爬取的参数
    const startPage = 1
    const endPage = 10 // 可以调整爬取的页数
    const districtId = 110000 // 地区ID：1=全国，2=上海，110000=北京等
    // 上海的坐标（WGS84坐标系）
    const coordinate = {
      latitude: 31.2304,  // 上海纬度
      longitude: 121.4737, // 上海经度
      coordinateType: "WGS84"
    }
  
    for (let i = startPage; i <= endPage; i++) {
      const start = Date.now();
      const data = await fetchPoiData(i, districtId, coordinate);
      const duration = Date.now() - start;
  
      if (data.length > 0) {
        await collection.insertMany(data);
        console.log(`第${i}页数据已插入，共 ${data.length} 条，耗时 ${duration} ms`);
      } else {
        console.log(`第${i}页无数据，跳过插入，耗时 ${duration} ms`);
      }
  
      // 请求间隔，防止被封，随机延时1~3秒
      if (i < endPage) {
        const waitTime = 1000 + Math.floor(Math.random() * 2000);
        console.log(`等待 ${waitTime} ms 后进行下一页请求`);
        await delay(waitTime);
      }
    }
    
    console.log(`✅ 爬取完成，共处理 ${endPage - startPage + 1} 页`)
  }
  