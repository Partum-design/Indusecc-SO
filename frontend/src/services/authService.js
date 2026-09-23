import { loginUser, requestRegistration, getRegistrationRequests, approveRegistration, rejectRegistration } from '../api/api'

/**
 * Servicio centralizado de autenticación
 */
const authService = {
    /**
     * Login — devuelve { user, token }
     */
    async login(email, password) {
        const res = await loginUser({ email, password })
        const data = res.data?.data || res.data
        if (data?.token) {
            localStorage.setItem('token', data.token)
            if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken)
            localStorage.setItem('user', JSON.stringify(data.user))
        }
        return data
    },

    /**
     * Logout — limpia localStorage
     */
    logout() {
        localStorage.removeItem('token')
        localStorage.removeItem('refreshToken')
        localStorage.removeItem('user')
    },

    /**
     * Solicitar registro (flujo de aprobación)
     */
    async requestRegistration(userData) {
        const res = await requestRegistration(userData)
        return res.data
    },

    /**
     * Obtener solicitudes de registro pendientes (admin)
     */
    async getRegistrationRequests(params) {
        const res = await getRegistrationRequests(params)
        return res.data?.data || res.data
    },

    /**
     * Aprobar solicitud de registro (admin)
     */
    async approveRegistration(requestData) {
        const res = await approveRegistration(requestData)
        return res.data
    },

    /**
     * Rechazar solicitud de registro (admin)
     */
    async rejectRegistration(requestData) {
        const res = await rejectRegistration(requestData)
        return res.data
    },

    /**
     * Obtener usuario actual de localStorage
     */
    getCurrentUser() {
        const userStr = localStorage.getItem('user')
        return userStr ? JSON.parse(userStr) : null
    },

    /**
     * Verificar si el usuario está autenticado
     */
    isAuthenticated() {
        return !!localStorage.getItem('token')
    },

    /**
     * Obtener token actual
     */
    getToken() {
        return localStorage.getItem('token')
    },
}

export default authService
