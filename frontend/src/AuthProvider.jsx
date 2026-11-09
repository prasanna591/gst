import { useEffect, useState } from "react";
import { AuthContext } from "./authContext";
import api from "./api";

const KEY = "gst_token";

function setAuthHeader(token) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(() => Boolean(localStorage.getItem(KEY)));

  function logout() {
    localStorage.removeItem(KEY);
    setAuthHeader(null);
    setUser(null);
  }

  // On page load: restore the session if a saved token is still valid
  useEffect(() => {
    const token = localStorage.getItem(KEY);
    if (!token) return;
    setAuthHeader(token);
    api
      .get("/api/auth/me")
      .then((res) => setUser(res.data))
      .catch(() => logout())
      .finally(() => setChecking(false));
  }, []);

  // If the token expires, send the person back to the login page
  useEffect(() => {
    const id = api.interceptors.response.use(
      (res) => res,
      (err) => {
        const url = err.config?.url || "";
        if (err.response?.status === 401 && !url.includes("/api/auth/login")) {
          logout();
        }
        return Promise.reject(err);
      }
    );
    return () => api.interceptors.response.eject(id);
  }, []);

  async function login(email, password) {
    const res = await api.post("/api/auth/login", { email, password });
    localStorage.setItem(KEY, res.data.access_token);
    setAuthHeader(res.data.access_token);
    setUser(res.data.user);
  }

  return (
    <AuthContext.Provider value={{ user, checking, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}