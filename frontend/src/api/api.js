import api from './axiosConfig';

// Autenticación
export const loginUser = (data) => api.post('auth/login', data);
export const registerUser = (data) => api.post('auth/register', data);
export const uploadFile = (data) => api.post('auth/upload', data);

// Solicitudes de Registro
export const requestRegistration = (data) => api.post('registration/request', data);
export const getRegistrationRequests = (queryParams = {}) => api.get('registration/requests', { params: queryParams });
export const approveRegistration = (data) => api.post('registration/approve', data);
export const rejectRegistration = (data) => api.post('registration/reject', data);

// Usuarios
export const getUsers = () => api.get('users');
export const createUser = (data) => api.post('users/create', data);
export const updateUser = (id, data) => api.put(`users/${id}`, data);
export const deleteUser = (id) => api.delete(`users/${id}`);
export const updateUserProfile = (data) => api.put('users/profile', data);

// Auditorías
export const getAudits = (queryParams = {}) => api.get('audits', { params: { limit: 100, ...queryParams } });
export const createAudit = (data) => api.post('audits', data);
export const updateAudit = (id, data) => api.put(`audits/${id}`, data);
export const deleteAudit = (id) => api.delete(`audits/${id}`);

// Hallazgos
export const getFindings = (queryParams = {}) => api.get('findings', { params: { limit: 100, ...queryParams } });
export const createFinding = (data) => api.post('findings', data);
export const updateFinding = (id, data) => api.put(`findings/${id}`, data);
export const deleteFinding = (id) => api.delete(`findings/${id}`);

// Calendarios
export const getCalendars = () => api.get('calendars');
export const createCalendar = (data) => api.post('calendars', data);
export const updateCalendar = (id, data) => api.put(`calendars/${id}`, data);
export const deleteCalendar = (id) => api.delete(`calendars/${id}`);

// Documentos
export const getDocuments = (queryParams = {}) => api.get('documents', { params: queryParams });
export const getDocumentById = (id) => api.get(`documents/${id}`);
export const uploadDocument = (data) => api.post('documents', data, {
  headers: data instanceof FormData ? { 'Content-Type': 'multipart/form-data' } : undefined
});
export const updateDocument = (id, data) => api.put(`documents/${id}`, data);
export const deleteDocument = (id) => api.delete(`documents/${id}`);
export const downloadDocument = (id) => api.get(`documents/${id}/download`, { responseType: 'blob' });
export const viewDocument = (id) => api.get(`documents/${id}/view`, { responseType: 'blob' });

// Roles
export const getRoles = (queryParams = {}) => api.get('roles', { params: queryParams });
export const getRoleById = (id) => api.get(`roles/${id}`);
export const createRole = (data) => api.post('roles', data);
export const updateRole = (id, data) => api.put(`roles/${id}`, data);
export const deleteRole = (id) => api.delete(`roles/${id}`);

// Admin - Configuración
export const getConfiguration = () => api.get('admin/config');
export const updateConfiguration = (settings) => api.put('admin/config', { settings });
export const restoreConfiguration = () => api.post('admin/config/restore');

// Admin - Usuarios
export const resetUserPassword = (userId, newPassword) =>
  api.put(`admin/users/${userId}/password`, { userId, newPassword });

// Admin - Logs
export const getAuditLogs = (queryParams = {}) => api.get('admin/logs', { params: queryParams });
export const purgeLogs = (daysOld) => api.post('admin/logs/purge', { daysOld });

// Admin - Sesiones
export const logoutAllSessions = () => api.post('admin/sessions/logout-all');

// Admin - Sistema
export const clearCache = () => api.post('admin/system/cache/clear');

// Normas ISO
export const getComplianceReport = () => api.get('norms/compliance-report');
export const getNorm = () => api.get('norms/norms');
export const getClause = (clauseId) => api.get(`norms/clauses/${clauseId}`);
export const updateClause = (clauseId, data) => api.put(`norms/clauses/${clauseId}`, data);
export const exportClause = (clauseId) => api.get(`norms/clauses/${clauseId}/export`);

// Riesgos
export const getRisks = () => api.get('risks');
export const createRisk = (data) => api.post('risks', data);
export const updateRisk = (id, data) => api.put(`risks/${id}`, data);
export const deleteRisk = (id) => api.delete(`risks/${id}`);

// Acciones
export const getActions = () => api.get('actions');
export const createAction = (data) => api.post('actions', data);
export const updateAction = (id, data) => api.put(`actions/${id}`, data);
export const deleteAction = (id) => api.delete(`actions/${id}`);

// Métricas
export const getCollaboratorIndicators = () => api.get('metrics/indicators');
export const getComplianceByClause = () => api.get('metrics/compliance/clauses');
export const getProcessIndicators = () => api.get('metrics/process');
export const getUserPerformance = () => api.get('metrics/performance');

// Capacitaciones
export const getUserTrainings = () => api.get('trainings');
export const getUserCertificates = () => api.get('trainings/certificates');
export const updateTrainingProgress = (id, data) => api.put(`trainings/${id}/progress`, data);
export const downloadCertificate = (id) => api.get(`trainings/certificates/${id}/download`);
