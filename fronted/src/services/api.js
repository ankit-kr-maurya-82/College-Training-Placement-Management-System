import axios from 'axios'

const baseURL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1').replace(/\/$/, '')

// This backend returns bearer tokens in JSON and does not use cookie sessions.
export const client = axios.create({ baseURL, timeout: 15000, headers: { Accept: 'application/json' } })

client.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('placement-token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

client.interceptors.response.use((response) => response, (error) => {
  if (!error.response) return Promise.reject(new Error('Cannot reach the placement server. Check the API URL and that the backend is running.'))
  if (error.response.status === 401) {
    sessionStorage.removeItem('placement-token')
    window.dispatchEvent(new Event('placement:unauthorized'))
  }
  const message = error.response.data?.message || `Request failed (${error.response.status})`
  const requestError = new Error(message)
  requestError.status = error.response.status
  return Promise.reject(requestError)
})

export const api = {
  get: async (path, config) => (await client.get(path, config)).data,
  post: async (path, body, config) => (await client.post(path, body, config)).data,
  put: async (path, body, config) => (await client.put(path, body, config)).data,
  patch: async (path, body, config) => (await client.patch(path, body, config)).data,
  delete: async (path, config) => (await client.delete(path, config)).data,
}
