// @ts-ignore - OpenAI 类型定义
import OpenAI from "openai"

// 默认模型
const DEFAULT_MODEL = "gpt-4o-mini"
const DEFAULT_TEMPERATURE = 0.7

// 延迟初始化 OpenAI 客户端
let openaiInstance: OpenAI | null = null

function getOpenAIClient(): OpenAI {
  if (!openaiInstance) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error(
        "OPENAI_API_KEY 环境变量未设置。请在 .env.local 文件中添加：\n" +
        "OPENAI_API_KEY=your-api-key-here"
      )
    }
    openaiInstance = new OpenAI({
      apiKey,
    })
  }
  return openaiInstance
}

export interface EnhancedUserInput {
  destination: string
  startDate: string
  endDate: string
  travelers: number
  budget: number
  travelStyle: string
  interests: string[]
  enhancedDescription: string
  structuredRequirements: {
    mustVisit?: string[]
    preferredTypes?: string[]
    budgetRange?: { min: number; max: number }
    timePreferences?: string[]
  }
}

/**
 * 完善和结构化用户输入
 */
export async function enhanceUserInput(
  rawInput: {
    destination?: string
    startDate?: string
    endDate?: string
    travelers?: number
    budget?: number
    travelStyle?: string
    interests?: string
  }
): Promise<EnhancedUserInput> {
  try {
    const openai = getOpenAIClient()
    const prompt = `你是一位专业的旅行规划助手。请分析用户的旅行需求，完善和结构化以下信息：

用户原始输入：
- 目的地: ${rawInput.destination || "未指定"}
- 出发日期: ${rawInput.startDate || "未指定"}
- 结束日期: ${rawInput.endDate || "未指定"}
- 旅行人数: ${rawInput.travelers || "未指定"}
- 预算: ${rawInput.budget || "未指定"} 元
- 旅行风格: ${rawInput.travelStyle || "未指定"}
- 兴趣偏好: ${rawInput.interests || "未指定"}

请返回一个 JSON 对象，包含以下字段：
{
  "destination": "明确的目的地名称",
  "startDate": "YYYY-MM-DD 格式的日期",
  "endDate": "YYYY-MM-DD 格式的日期",
  "travelers": 数字,
  "budget": 数字,
  "travelStyle": "balanced/cultural/adventure/relaxed/budget/luxury 之一",
  "interests": ["兴趣1", "兴趣2", ...],
  "enhancedDescription": "完善后的详细描述，包含所有关键信息",
  "structuredRequirements": {
    "mustVisit": ["必去景点1", "必去景点2"],
    "preferredTypes": ["偏好类型1", "偏好类型2"],
    "budgetRange": {"min": 最小预算, "max": 最大预算},
    "timePreferences": ["上午", "下午", "晚上"]
  }
}

要求：
1. 如果用户输入不完整，请根据上下文合理推断
2. 将兴趣偏好解析为数组
3. 确保日期格式正确
4. enhancedDescription 应该是一个完整的、结构化的描述，用于后续的向量搜索
5. 只返回 JSON，不要包含其他文字说明`

    const response = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [
        {
          role: "system",
          content:
            "你是一位专业的旅行规划助手，擅长分析和完善用户的旅行需求。请始终返回有效的 JSON 格式。",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: DEFAULT_TEMPERATURE,
      response_format: { type: "json_object" },
    })

    const content = response.choices[0].message.content
    if (!content) {
      throw new Error("OpenAI 返回空内容")
    }

    const enhanced = JSON.parse(content) as EnhancedUserInput

    // 验证和补充必要字段
    if (!enhanced.destination && rawInput.destination) {
      enhanced.destination = rawInput.destination
    }
    if (!enhanced.startDate && rawInput.startDate) {
      enhanced.startDate = rawInput.startDate
    }
    if (!enhanced.endDate && rawInput.endDate) {
      enhanced.endDate = rawInput.endDate
    }
    if (!enhanced.travelers && rawInput.travelers) {
      enhanced.travelers = rawInput.travelers
    }
    if (!enhanced.budget && rawInput.budget) {
      enhanced.budget = rawInput.budget
    }
    if (!enhanced.travelStyle && rawInput.travelStyle) {
      enhanced.travelStyle = rawInput.travelStyle || "balanced"
    }
    if (!enhanced.interests || enhanced.interests.length === 0) {
      enhanced.interests = rawInput.interests
        ? rawInput.interests.split(/[,，、]/).map((s) => s.trim())
        : []
    }

    return enhanced
  } catch (error: any) {
    console.error("完善用户输入失败:", error)
    
    // 检查是否是 API key 问题或配额错误
    const isAPIKeyError = 
      error?.status === 401 ||
      error?.code === 'invalid_api_key' ||
      error?.code === 'authentication_error' ||
      error?.message?.includes('401') ||
      error?.message?.includes('Incorrect API key') ||
      error?.message?.includes('Invalid API key') ||
      error?.message?.includes('authentication') ||
      !process.env.OPENAI_API_KEY
    
    const isQuotaError = 
      error?.status === 429 || 
      error?.code === 'insufficient_quota' ||
      error?.message?.includes('429') ||
      error?.message?.includes('quota')
    
    if (isAPIKeyError) {
      console.warn("⚠️  OpenAI API Key 无效或未设置，使用原始输入")
    } else if (isQuotaError) {
      console.warn("⚠️  OpenAI API 配额超限，使用原始输入")
    }
    
    // 降级方案：返回原始输入的结构化版本
    return {
      destination: rawInput.destination || "",
      startDate: rawInput.startDate || "",
      endDate: rawInput.endDate || "",
      travelers: rawInput.travelers || 2,
      budget: rawInput.budget || 10000,
      travelStyle: rawInput.travelStyle || "balanced",
      interests: rawInput.interests
        ? rawInput.interests.split(/[,，、]/).map((s) => s.trim())
        : [],
      enhancedDescription: `${rawInput.destination || ""} ${rawInput.travelStyle || ""} ${rawInput.interests || ""}`,
      structuredRequirements: {},
    }
  }
}

/**
 * 生成完整行程
 */
export async function generateTripItinerary(
  enhancedInput: EnhancedUserInput,
  matchedAttractions: Array<{
    name: string
    location: string
    type: string
    description: string
    rating: number
  }>,
  routePlan?: {
    optimizedOrder: number[]
    distances: number[]
    durations: number[]
  }
): Promise<any> {
  try {
    const openai = getOpenAIClient()
    const attractionsList = matchedAttractions
      .map(
        (attr, idx) =>
          `${idx + 1}. ${attr.name} (${attr.type}) - ${attr.description} (评分: ${attr.rating})`
      )
      .join("\n")

    const routeInfo = routePlan
      ? `\n路线优化信息：
- 优化后的景点顺序: ${routePlan.optimizedOrder.join(" → ")}
- 总距离: ${routePlan.distances.reduce((a, b) => a + b, 0).toFixed(2)} 公里
- 总时间: ${routePlan.durations.reduce((a, b) => a + b, 0).toFixed(0)} 分钟`
      : ""

    const prompt = `你是一位专业的旅游行程设计师，请根据以下信息生成一份详细而实用的旅游行程规划。

用户需求：
- 目的地: ${enhancedInput.destination}
- 出发日期: ${enhancedInput.startDate}
- 结束日期: ${enhancedInput.endDate}
- 旅行人数: ${enhancedInput.travelers} 人
- 预算: ${enhancedInput.budget} 元
- 旅行风格: ${enhancedInput.travelStyle}
- 兴趣偏好: ${enhancedInput.interests.join(", ")}

匹配的景点列表：
${attractionsList}${routeInfo}

请生成一份详细的行程规划，使用以下 JSON 格式：

{
  "title": "行程标题",
  "destination": "${enhancedInput.destination}",
  "startDate": "${enhancedInput.startDate}",
  "endDate": "${enhancedInput.endDate}",
  "travelers": ${enhancedInput.travelers},
  "budget": ${enhancedInput.budget},
  "travelStyle": "${enhancedInput.travelStyle}",
  "status": "confirmed",
  "highlights": ["亮点1", "亮点2", "亮点3", "亮点4"],
  "days": [
    {
      "day": 1,
      "title": "第一天标题",
      "activities": [
        {
          "time": "09:00 - 11:00",
          "title": "活动名称",
          "type": "景点/餐厅/购物/休闲",
          "description": "详细描述",
          "location": "具体位置",
          "estimatedCost": 100
        }
      ]
    }
  ],
  "recommendations": [
    {"name": "推荐1", "type": "类型"}
  ],
  "practicalInfo": {
    "transportation": [
      {"name": "交通方式", "cost": 100, "icon": "Train"}
    ],
    "accommodation": [
      {"name": "住宿", "cost": 500, "icon": "Hotel"}
    ],
    "tips": ["提示1", "提示2", "提示3"]
  }
}

要求：
1. 根据匹配的景点列表安排行程，优先使用这些景点
2. 如果提供了路线优化信息，请按照优化后的顺序安排
3. 每天至少安排 2-3 个活动
4. 考虑交通时间和距离
5. 预算要合理分配
6. 活动类型要多样化
7. 只返回 JSON，不要包含其他文字`

    const response = await openai.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [
        {
          role: "system",
          content:
            "你是一位专业的旅游行程设计师，擅长根据用户需求和景点信息生成详细实用的行程规划。请始终返回有效的 JSON 格式。",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: DEFAULT_TEMPERATURE,
      response_format: { type: "json_object" },
    })

    const content = response.choices[0].message.content
    if (!content) {
      throw new Error("OpenAI 返回空内容")
    }

    // 清理 JSON（移除可能的 markdown 代码块）
    const cleanContent = content
      .replace(/^```json\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim()

    const itinerary = JSON.parse(cleanContent)

    // 添加元数据
    return {
      ...itinerary,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      matchedAttractionsCount: matchedAttractions.length,
    }
  } catch (error: any) {
    console.error("生成行程失败:", error)
    
    // 检查是否是 API key 问题
    const isAPIKeyError = 
      error?.status === 401 ||
      error?.code === 'invalid_api_key' ||
      error?.code === 'authentication_error' ||
      error?.message?.includes('401') ||
      error?.message?.includes('Incorrect API key') ||
      error?.message?.includes('Invalid API key') ||
      error?.message?.includes('authentication') ||
      !process.env.OPENAI_API_KEY
    
    // 检查是否是配额错误
    const isQuotaError = 
      error?.status === 429 || 
      error?.code === 'insufficient_quota' ||
      error?.message?.includes('429') ||
      error?.message?.includes('quota')
    
    if (isAPIKeyError) {
      throw new Error(
        `OpenAI API Key 无效: ${error?.message || "请检查您的 API Key 配置"}\n` +
        `建议：\n` +
        `1. 检查 .env.local 中的 OPENAI_API_KEY 是否正确\n` +
        `2. 或使用 Ollama 本地模型（设置 USE_VECTOR_WORKFLOW=false）`
      )
    }
    
    if (isQuotaError) {
      throw new Error(
        `OpenAI API 配额超限: ${error?.message || "请检查您的账户配额和账单设置"}\n` +
        `建议：\n` +
        `1. 检查 OpenAI 账户余额\n` +
        `2. 升级账户计划\n` +
        `3. 或使用 Ollama 本地模型（设置 USE_VECTOR_WORKFLOW=false）`
      )
    }
    
    throw error
  }
}

/**
 * 重试机制包装
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: Error | null = null

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      if (i < maxRetries - 1) {
        console.log(`重试 ${i + 1}/${maxRetries - 1}...`)
        await new Promise((resolve) => setTimeout(resolve, delay * (i + 1)))
      }
    }
  }

  throw lastError || new Error("未知错误")
}
