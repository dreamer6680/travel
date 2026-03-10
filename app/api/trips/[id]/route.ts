import { NextResponse } from "next/server"

// 生成完整的行程数据
function generateTripData(tripId: string, destination?: string) {
  const dest = destination || "东京"
  
  // 根据目的地生成不同的行程
  const tripTemplates: Record<string, any> = {
    "东京": {
      highlights: ["东京塔", "浅草寺", "teamLab", "筑地市场", "银座"],
      days: [
        {
          day: 1,
          title: "浅草 & 晴空塔",
          activities: [
            { time: "09:00 - 11:00", title: "浅草寺", type: "景点", description: "东京最古老的寺庙，体验传统日本文化。可以在仲见世通购买纪念品和品尝小吃。" },
            { time: "11:30 - 13:00", title: "午餐：浅草寿司", type: "餐厅", description: "品尝正宗的日本寿司，位于浅草寺附近的人气餐厅。" },
            { time: "14:00 - 16:00", title: "东京晴空塔", type: "景点", description: "登上东京最高的观景台，俯瞰整个东京城市风光。" },
            { time: "16:30 - 18:30", title: "晴空塔购物中心", type: "购物", description: "在日本最大的购物中心之一享受购物体验。" },
            { time: "19:00 - 21:00", title: "晚餐：隅田川旁餐厅", type: "餐厅", description: "在隅田川旁享用晚餐，欣赏晴空塔的夜景。" },
          ],
        },
        {
          day: 2,
          title: "涩谷 & 原宿",
          activities: [
            { time: "09:00 - 10:30", title: "明治神宫", type: "景点", description: "位于原宿的宁静神社，被森林环绕的都市绿洲。" },
            { time: "11:00 - 12:30", title: "竹下通", type: "购物", description: "原宿的时尚中心，充满年轻人潮流文化的街道。" },
            { time: "13:00 - 14:30", title: "午餐：原宿可丽饼", type: "餐厅", description: "品尝日本著名的可丽饼，多种口味可选。" },
            { time: "15:00 - 17:00", title: "涩谷十字路口", type: "景点", description: "世界最繁忙的十字路口，体验东京的都市脉搏。" },
            { time: "17:30 - 19:00", title: "SHIBUYA SKY", type: "景点", description: "登上涩谷最高观景台，360 度全景视野。" },
            { time: "19:30 - 21:00", title: "晚餐：涩谷居酒屋", type: "餐厅", description: "体验地道的日本居酒屋文化。" },
          ],
        },
        {
          day: 3,
          title: "银座 & 筑地",
          activities: [
            { time: "08:00 - 10:00", title: "筑地市场", type: "景点", description: "东京的厨房，品尝新鲜的海鲜和美食。" },
            { time: "10:30 - 12:00", title: "银座购物", type: "购物", description: "高端购物区，聚集了世界顶级品牌。" },
            { time: "12:30 - 14:00", title: "午餐：银座天妇罗", type: "餐厅", description: "品尝米其林级别的天妇罗料理。" },
            { time: "14:30 - 16:30", title: "歌舞伎座", type: "景点", description: "欣赏传统日本歌舞伎表演。" },
            { time: "17:00 - 19:00", title: "有乐町", type: "购物", description: "逛逛有乐町的百货公司和地下美食街。" },
            { time: "19:30 - 21:00", title: "晚餐：银座高级寿司", type: "餐厅", description: "体验顶级寿司师傅的手艺。" },
          ],
        },
        {
          day: 4,
          title: "秋叶原 & 上野",
          activities: [
            { time: "09:00 - 11:00", title: "上野公园", type: "景点", description: "东京最大的公园，内有多个博物馆和动物园。" },
            { time: "11:30 - 13:00", title: "东京国立博物馆", type: "景点", description: "日本最古老的博物馆，收藏丰富文物。" },
            { time: "13:30 - 15:00", title: "午餐：上野拉面", type: "餐厅", description: "品尝上野地区著名的拉面店。" },
            { time: "15:30 - 18:00", title: "秋叶原电器街", type: "购物", description: "动漫、电子产品、手办的天堂。" },
            { time: "18:30 - 20:00", title: "女仆咖啡厅体验", type: "娱乐", description: "体验独特的秋叶原女仆咖啡厅文化。" },
            { time: "20:00 - 21:30", title: "晚餐：秋叶原烤肉", type: "餐厅", description: "享受正宗的日本烤肉。" },
          ],
        },
        {
          day: 5,
          title: "台场 & teamLab",
          activities: [
            { time: "09:30 - 11:30", title: "teamLab Planets", type: "景点", description: "沉浸式数字艺术博物馆，光与影的奇幻世界。" },
            { time: "12:00 - 13:30", title: "午餐：丰洲市场", type: "餐厅", description: "在丰洲市场品尝新鲜寿司。" },
            { time: "14:00 - 16:00", title: "台场海滨公园", type: "景点", description: "欣赏彩虹大桥和自由女神像。" },
            { time: "16:30 - 18:30", title: "台场购物广场", type: "购物", description: "大型购物中心，有各种娱乐设施。" },
            { time: "19:00 - 21:00", title: "晚餐：台场观景餐厅", type: "餐厅", description: "边欣赏东京湾夜景边享用美食。" },
          ],
        },
        {
          day: 6,
          title: "东京塔 & 返程",
          activities: [
            { time: "09:00 - 11:00", title: "东京塔", type: "景点", description: "东京的地标建筑，登顶俯瞰全城。" },
            { time: "11:30 - 13:00", title: "增上寺", type: "景点", description: "位于东京塔旁的古老寺庙。" },
            { time: "13:30 - 15:00", title: "午餐：芝公园附近", type: "餐厅", description: "在芝公园附近享用最后的午餐。" },
            { time: "15:30 - 17:00", title: "最后购物", type: "购物", description: "在返程前购买伴手礼和纪念品。" },
            { time: "17:30 - 19:00", title: "告别晚餐", type: "餐厅", description: "在东京的最后一顿美食。" },
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
    },
    "巴黎": {
      highlights: ["埃菲尔铁塔", "卢浮宫", "凯旋门", "蒙马特高地", "塞纳河"],
      days: [
        {
          day: 1,
          title: "埃菲尔铁塔 & 塞纳河",
          activities: [
            { time: "09:00 - 11:00", title: "埃菲尔铁塔", type: "景点", description: "巴黎的象征，登顶欣赏全城美景。" },
            { time: "11:30 - 13:00", title: "午餐：铁塔附近法餐厅", type: "餐厅", description: "品尝正宗法式料理。" },
            { time: "14:00 - 16:00", title: "塞纳河游船", type: "景点", description: "乘船游览塞纳河两岸风光。" },
            { time: "16:30 - 18:00", title: "特罗卡德罗花园", type: "景点", description: "拍摄埃菲尔铁塔的最佳位置。" },
            { time: "19:00 - 21:00", title: "晚餐：塞纳河畔", type: "餐厅", description: "在河边餐厅享用浪漫晚餐。" },
          ],
        },
        {
          day: 2,
          title: "卢浮宫 & 巴黎圣母院",
          activities: [
            { time: "09:00 - 12:00", title: "卢浮宫", type: "景点", description: "世界最大博物馆，欣赏蒙娜丽莎等名作。" },
            { time: "12:30 - 14:00", title: "午餐：玛黑区", type: "餐厅", description: "在时尚玛黑区享用午餐。" },
            { time: "14:30 - 16:00", title: "巴黎圣母院", type: "景点", description: "哥特式建筑杰作。" },
            { time: "16:30 - 18:00", title: "拉丁区", type: "景点", description: "漫步古老街区，感受学术氛围。" },
            { time: "19:00 - 21:00", title: "晚餐：拉丁区小酒馆", type: "餐厅", description: "体验传统法式小酒馆。" },
          ],
        },
        {
          day: 3,
          title: "凯旋门 & 香榭丽舍",
          activities: [
            { time: "09:00 - 10:30", title: "凯旋门", type: "景点", description: "登顶俯瞰香榭丽舍大道。" },
            { time: "11:00 - 13:00", title: "香榭丽舍大道", type: "购物", description: "世界著名购物街。" },
            { time: "13:30 - 15:00", title: "午餐：香街咖啡厅", type: "餐厅", description: "在大道旁的咖啡厅用餐。" },
            { time: "15:30 - 17:00", title: "老佛爷百货", type: "购物", description: "巴黎著名百货公司。" },
            { time: "19:00 - 21:00", title: "晚餐：红磨坊附近", type: "餐厅", description: "体验巴黎夜生活。" },
          ],
        },
        {
          day: 4,
          title: "蒙马特高地",
          activities: [
            { time: "09:00 - 11:00", title: "圣心大教堂", type: "景点", description: "白色圆顶教堂，俯瞰巴黎全景。" },
            { time: "11:30 - 13:00", title: "小丘广场", type: "景点", description: "艺术家聚集地，可画肖像。" },
            { time: "13:30 - 15:00", title: "午餐：蒙马特餐厅", type: "餐厅", description: "山坡上的特色餐厅。" },
            { time: "15:30 - 17:00", title: "爱墙", type: "景点", description: "用 250 种语言写满'我爱你'的墙。" },
            { time: "19:00 - 21:00", title: "晚餐：蒙马特酒馆", type: "餐厅", description: "感受波西米亚风情。" },
          ],
        },
        {
          day: 5,
          title: "凡尔赛宫",
          activities: [
            { time: "09:00 - 12:00", title: "凡尔赛宫", type: "景点", description: "法国最宏伟的宫殿。" },
            { time: "12:30 - 14:00", title: "午餐：凡尔赛镇", type: "餐厅", description: "宫殿附近的小镇餐厅。" },
            { time: "14:30 - 17:00", title: "凡尔赛花园", type: "景点", description: "漫步皇家花园。" },
            { time: "19:00 - 21:00", title: "晚餐：返回巴黎市区", type: "餐厅", description: "市区高级法餐。" },
          ],
        },
        {
          day: 6,
          title: "玛黑区 & 返程",
          activities: [
            { time: "09:00 - 11:00", title: "孚日广场", type: "景点", description: "巴黎最古老的广场。" },
            { time: "11:30 - 13:00", title: "玛黑区购物", type: "购物", description: "设计师小店和古董店。" },
            { time: "13:30 - 15:00", title: "午餐：玛黑区", type: "餐厅", description: "时尚街区的美食。" },
            { time: "15:30 - 17:00", title: "最后购物", type: "购物", description: "购买伴手礼。" },
            { time: "19:00 - 21:00", title: "告别晚餐", type: "餐厅", description: "塞纳河畔告别宴。" },
          ],
        },
      ],
      recommendations: [
        { name: "奥赛博物馆", type: "博物馆" },
        { name: "巴黎地下墓穴", type: "历史遗迹" },
        { name: "圣礼拜堂", type: "教堂" },
        { name: "蓬皮杜中心", type: "现代艺术" },
        { name: "先贤祠", type: "历史遗迹" },
      ],
      practicalInfo: {
        transportation: [
          { name: "地铁周票", cost: 30, icon: "Train" },
          { name: "戴高乐机场快线", cost: 15, icon: "Train" },
        ],
        accommodation: [
          { name: "玛黑区精品酒店", cost: 200, icon: "Hotel" },
          { name: "拉丁区酒店", cost: 180, icon: "Hotel" },
        ],
        tips: [
          "巴黎地铁发达，建议购买周票",
          "大部分博物馆周一闭馆",
          "餐厅通常需要预约",
          "注意保管财物，警惕扒手",
          "学习基本法语问候会很受欢迎",
        ],
      },
    },
  }

  // 如果没有匹配的目的地，使用东京模板
  const template = tripTemplates[dest] || tripTemplates["东京"]

  return {
    id: tripId,
    destination: dest,
    startDate: "2025-07-15",
    endDate: "2025-07-20",
    travelers: 2,
    budget: 12500,
    travelStyle: "balanced",
    highlights: template.highlights,
    days: template.days,
    recommendations: template.recommendations,
    practicalInfo: template.practicalInfo,
  }
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const tripId = params.id
  
  // 获取 URL 参数中的目的地（可选）
  const { searchParams } = new URL(request.url)
  const destination = searchParams.get("destination")

  const trip = generateTripData(tripId, destination || undefined)

  return NextResponse.json(trip)
}
