import axios from "axios";

export const portalApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:4000/api",
});

portalApi.interceptors.request.use((config) => {
  const token = localStorage.getItem("portal_token");
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

portalApi.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("portal_token");
      localStorage.removeItem("portal_employee");
      if (window.location.pathname !== "/portal/login") {
        window.location.href = "/portal/login";
      }
    }
    return Promise.reject(error);
  }
);
