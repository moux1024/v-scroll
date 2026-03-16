import { formatError, retryWithBackoff } from './utils.js'

const DEFAULT_TIMEOUT = 5000
const MAX_RETRIES = 3
const API_BASE_URL = 'https://api.example.com'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const fetchData = async (endpoint, options = {}) => {
  const { timeout = DEFAULT_TIMEOUT, retries = MAX_RETRIES } = options
  let lastError

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController()
      const id = setTimeout(() => controller.abort(), timeout)

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        signal: controller.signal,
        ...options
      })

      clearTimeout(id)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      lastError = error

      if (attempt < retries && error.name === 'AbortError') {
        const delay = Math.pow(2, attempt) * 100
        await sleep(delay)
        continue
      }

      throw error
    }
  }

  throw lastError
}

const getUserById = async (userId) => {
  const data = await fetchData(`/users/${userId}`)
  return { id: data.id, name: data.name, email: data.email }
}

const getItemsByCategory = async (category) => {
  const data = await fetchData(`/items?category=${encodeURIComponent(category)}`)
  return data.map((item) => ({
    id: item.id,
    title: item.title,
    price: item.price
  }))
}

export default { fetchData, getUserById, getItemsByCategory }
