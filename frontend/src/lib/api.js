const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export function getToken() {
  return localStorage.getItem('attendai_token')
}

export function setToken(token) {
  if (token) localStorage.setItem('attendai_token', token)
  else localStorage.removeItem('attendai_token')
}

export async function api(path, options = {}) {
  const headers = new Headers(options.headers || {})
  const token = getToken()

  if (token) headers.set('Authorization', `Bearer ${token}`)

  const isForm = options.body instanceof FormData
  if (!isForm && options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  })

  if (!response.ok) {
    let detail = 'Request failed'
    try {
      const data = await response.json()
      detail = data.detail || detail
    } catch {}
    throw new Error(detail)
  }

  const type = response.headers.get('content-type') || ''
  if (type.includes('application/json')) return response.json()
  return response
}

export { API_URL }
