const PYTHON_AGENT_BASE_URL = process.env.PYTHON_AGENT_BASE_URL || "http://127.0.0.1:8000"

function buildUrl(path: string) {
  return `${PYTHON_AGENT_BASE_URL}${path}`
}

export async function proxyJsonToPythonAgent(path: string, init: RequestInit = {}) {
  const response = await fetch(buildUrl(path), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Python Agent 请求失败: ${response.status} ${text}`)
  }

  return response.json()
}

export async function proxyStreamToPythonAgent(path: string, init: RequestInit = {}) {
  const response = await fetch(buildUrl(path), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Python Agent 流式请求失败: ${response.status} ${text}`)
  }

  return response
}
