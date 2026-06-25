import axios from 'axios';

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4100';

export const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('taskflow_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('taskflow_token');
      localStorage.removeItem('taskflow_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);
