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
  }

// 请求接口，提取 poiId 和 poiName
async function fetchPoiData(page: number): Promise<ScenicSpot[]> {
    const response = await axios.post(
      'https://m.ctrip.com/restapi/soa2/18109/json/getAttractionList?_fxpcqlniredt=09031105115687380845&x-traceID=09031105115687380845-1749438087513-878798',
      {
        head: {
          cid: '09031105115687380845',
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
        districtId: 110000,
        index: page,
        sortType: 1,
        count: 10,
        filter: {
          filterItems: ['4;2'],
        },
        returnModuleType: 'product',
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'cookieorigin': 'https://you.ctrip.com',
          'pragma': 'no-cache',
          'priority': 'u=1, i',
          'x-ctx-ubt-pageid': '10650142842',
          'x-ctx-ubt-pvid': '18',
          'x-ctx-ubt-sid': '2',
          'x-ctx-ubt-vid': '1749395837665.a8b2nUJSa9SO',
          'Cookie': '_RGUID=1074ce84-3d69-4d1b-8802-fbffcf252bfc; _RSG=RqKQzGepq11ylI9F__.2W8; _RDG=287f347b51c9ac273e187e1b48d6c2e5db; GUID=09031105115687380845; UBT_VID=1749395837665.a8b2nUJSa9SO; nfes_isSupportWebP=1; Hm_lvt_a8d6737197d542432f4ff4abc6e06384=1749395934; HMACCOUNT=707CF7D32D90DEE8; MKT_CKID=1749395934276.0hx22.zjq3; MKT_Pagesource=PC; login_type=0; DUID=u=1C4722574E49F8668453246A86B4D4D8&v=0; IsNonUser=F; AHeadUserInfo=VipGrade=10&VipGradeName=%BB%C6%BD%F0%B9%F3%B1%F6&UserName=&NoReadMessageCount=0; _udl=708D70C2B179E2F91CC5ED1C2CCE362D; login_uid=ED0DAA22CD5D6890AD9B5E586135AE06; _PRO_sso_lat_assertion_=7746c985b3583df94c8bf685369f515916aab2823fa53eb50ea8a0b5592be3e082578daf80b5edd4c009a8f778888c05d85ff624271e50dc08ff04c4635b5562509f4960660ba648c8687ad3f99335e82f2a64dc221f778c79045058b93896cf0b61d734cf2b68f88227a451d47ecb2bbf33baa844ea6b057ff92ce99e491545; _PRO_sso_lat_assertion_signature_=23e80335eadd2febae700c3b1797697d05a90937fc87982c6ac6b225197f601e29895bd8e48e91bd805b11dfffceee2a7789a3177bda5085614c9c359663f8654f2cf8e3315ef66647e28e353d081c25658cfb1196bfc2b4474912e584ef392652f3f8137f1ca7fecceb52a00cd93210a33164d1c0acbec13d783ed61e34d899; cticket=D59CC1DFFBBF5B1D6559349D67A7200E6E28E2063F0AE9CF4D1D84506772812B; _RF1=2409%3A8929%3Ae41%3A5d7%3A78f3%3A8c13%3A7e6d%3A46c7; _ga=GA1.1.1624361480.1749437855; Hm_lpvt_a8d6737197d542432f4ff4abc6e06384=1749437855; _ga_5DVRDQD429=GS2.1.s1749437854$o1$g0$t1749437858$j56$l0$h0; _ga_B77BES1Z8Z=GS2.1.s1749437854$o1$g0$t1749437858$j56$l0$h0; _ga_9BZF483VNQ=GS2.1.s1749437854$o1$g0$t1749437858$j56$l0$h0; _bfa=1.1749395837665.a8b2nUJSa9SO.1.1749438006851.1749438075890.2.18.10650142842; Session=smartlinkcode=U130727&smartlinklanguage=zh&SmartLinkKeyWord=&SmartLinkQuary=&SmartLinkHost=; Union=AllianceID=4902&SID=130727&OUID=&createtime=1749438076&Expires=1750042876440; _jzqco=%7C%7C%7C%7C1749395934449%7C1.810459453.1749395934294.1749438007390.1749438076522.1749438007390.1749438076522.undefined.0.0.13.13'
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
      }));
  }
  
  function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  export async function main() {
    const db = (await clientPromise).db("trip");
    const collection = db.collection<ScenicSpot>("Recomendations");
  
    for (let i = 1; i <= 1; i++) {
      const start = Date.now();
      const data = await fetchPoiData(i);
      const duration = Date.now() - start;
  
      if (data.length > 0) {
        await collection.insertMany(data);
        console.log(`第${i}页数据已插入，耗时 ${duration} ms`);
      } else {
        console.log(`第${i}页无数据，跳过插入，耗时 ${duration} ms`);
      }
  
      // 请求间隔，防止被封，随机延时1~3秒
      const waitTime = 1000 + Math.floor(Math.random() * 2000);
      console.log(`等待 ${waitTime} ms 后进行下一页请求`);
      await delay(waitTime);
    }
  }
  