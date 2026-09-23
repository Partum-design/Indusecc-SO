import api from './axiosConfig';

// Autenticación
export const loginUser = (data) => api.post('auth/login', data);
export const registerUser = (data) => api.post('auth/register', data);
export const uploadFile = (data) => api.post('auth/upload', data);
export const getDemoStatus = () => api.get('auth/demo-status');
export const demoLogin = (role) => api.post('auth/demo-login', { role });
export const getPublicStats = () => api.get('public/stats');

// Solicitudes de Registro
export const requestRegistration = (data) => api.post('registration/request', data);
export const getRegistrationRequests = (queryParams = {}) => api.get('registration/requests', { params: queryParams });
export const approveRegistration = (data) => api.post('registration/approve', data);
export const rejectRegistration = (data) => api.post('registration/reject', data);

// Usuarios
export const getUsers = () => api.get('users');
export const getUserDirectory = () => api.get('users/directory');
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
export const getDocumentStats = () => api.get('documents/stats');
export const createUploadUrl = (data) => api.post('documents/upload-url', data);
export const registerDocument = (data) => api.post('documents', data);
export const updateDocument = (id, data) => api.put(`documents/${id}`, data);
export const deleteDocument = (id) => api.delete(`documents/${id}`);
export const getDocumentUrl = (id, download = false) =>
  api.get(`documents/${id}/url`, { params: download ? { download: 1 } : {} });
export const verifyDocument = (id) => api.get(`documents/${id}/verify`);

// Firmas electrónicas
export const getSignatures = (id) => api.get(`documents/${id}/signatures`);
export const requestSignatures = (id, data) => api.post(`documents/${id}/signatures/request`, data);
export const resendSignatureRequest = (id, sigId) => api.post(`documents/${id}/signatures/${sigId}/resend`);
export const cancelSignatureRequest = (id, sigId) => api.delete(`documents/${id}/signatures/${sigId}`);
export const signDocument = (id, data) => api.post(`documents/${id}/sign`, data);

// Notificaciones
export const getNotifications = (queryParams = {}) => api.get('notifications', { params: queryParams });
export const getSentNotifications = () => api.get('notifications/sent');
export const markNotificationRead = (id) => api.patch(`notifications/${id}/read`);
export const markAllNotificationsRead = () => api.post('notifications/read-all');
export const deleteNotification = (id) => api.delete(`notifications/${id}`);
export const clearReadNotifications = () => api.delete('notifications/read');
export const resendNotification = (id) => api.post(`notifications/${id}/resend`);
export const sendNotification = (data) => api.post('notifications/send', data);

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

// Normas ISO (el cumplimiento se calcula solo a partir de documentos y firmas)
export const getComplianceReport = () => api.get('norms/compliance-report');
export const getIsoTree = () => api.get('norms/tree');
export const getClause = (clauseId) => api.get(`norms/clauses/${clauseId}`);
export const exportIsoCsv = (clauseId = 'all') => api.get(`norms/clauses/${clauseId}/export`, { responseType: 'blob' });

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
