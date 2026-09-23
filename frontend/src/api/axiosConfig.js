import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL || '/api/';

const api = axios.create({ baseURL });

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Los tokens de acceso duran 1 hora: al recibir un 401 se intenta renovar la sesión con el
// refreshToken (una sola vez, compartida por todas las peticiones en vuelo) y se repite la petición.
let refreshing = null;

const refreshSession = () => {
  if (!refreshing) {
    const refreshToken = localStorage.getItem('refreshToken');
    // Cliente aparte, sin interceptores, para no entrar en un bucle.
    refreshing = axios
      .post(`${baseURL}auth/refresh`, { refreshToken })
      .then((res) => {
        localStorage.setItem('token', res.data.token);
        if (res.data.refreshToken) localStorage.setItem('refreshToken', res.data.refreshToken);
        return res.data.token;
      })
      .finally(() => { refreshing = null; });
  }
  return refreshing;
};

const endSession = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
  if (!window.location.pathname.includes('/login')) {
    window.location.href = '/login';
  }
};

const isAuthCall = (url = '') => /auth\/(login|demo-login|refresh|forgot-password|reset-password)/.test(url);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { response, config } = error;

    if (response && response.status === 401 && config && !config._retried && !isAuthCall(config.url)) {
      if (localStorage.getItem('refreshToken')) {
        try {
          await refreshSession();
          config._retried = true;
          return api(config);
        } catch {
          // la renovación falló: se cierra la sesión abajo
        }
      }
      console.warn('[Auth] Sesión expirada o inválida. Cerrando sesión…');
      endSession();
    }

    if (response) {
      console.error(`[API Error] ${response.status}: ${response.data?.message || error.message}`);
    } else if (error.request) {
      console.error('[API Error] No se pudo contactar al servidor. Verifica que el backend esté en ' + api.defaults.baseURL);
    }

    return Promise.reject(error);
  }
);

export default api;
