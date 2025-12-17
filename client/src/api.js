import axios from 'axios';

// Use Vite env var VITE_API_URL if provided, fallback to localhost:4001
const BASE = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL
  : 'http://localhost:4001';

const API = axios.create({ baseURL: BASE });

API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default API;
