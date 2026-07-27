import { useAuthStore } from '../stores/authStore';

const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8000/api/v1';

async function refreshAccessToken(): Promise<string | null> {
  const { refreshToken, setAuth, clearAuth } = useAuthStore.getState();
  if (!refreshToken) return null;
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) { clearAuth(); return null; }
    const data = await res.json();
    setAuth(data.access_token, refreshToken, useAuthStore.getState().user);
    return data.access_token;
  } catch { clearAuth(); return null; }
}

async function request<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<{ success: boolean; data?: T; error?: string }> {
  try {
    const token = useAuthStore.getState().accessToken;
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    let res = await fetch(`${API_BASE}${path}`, { ...options, headers });

    if (res.status === 401 && token) {
      const newToken = await refreshAccessToken();
      if (newToken) {
        headers['Authorization'] = `Bearer ${newToken}`;
        res = await fetch(`${API_BASE}${path}`, { ...options, headers });
      }
    }

    if (!res.ok) {
      try {
        const err = await res.json();
        return { success: false, error: err.detail || err.message || `Error ${res.status}` };
      } catch {
        return { success: false, error: `HTTP ${res.status}` };
      }
    }

    if (res.status === 204) return { success: true };
    const data = await res.json();
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error' };
  }
}

export const api = {
  // Auth
  getTestCredentials: () =>
    request<{ email: string; username: string; password: string }>('/auth/test-credentials'),
  login: (username: string, password: string) =>
    request<{ access_token: string; refresh_token: string; token_type: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  register: (data: { email: string; username: string; password: string; full_name: string }) =>
    request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  getMe: () => request('/auth/me'),
  changePassword: (old_password: string, new_password: string) =>
    request('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ old_password, new_password }),
    }),

  // Folders
  createFolder: (data: { name: string; description?: string; parent_id?: string; color?: string; icon?: string }) =>
    request('/folders/', { method: 'POST', body: JSON.stringify(data) }),
  listFolders: (parentId?: string, page = 1, pageSize = 50) => {
    const params = new URLSearchParams({ page: page.toString(), page_size: pageSize.toString() });
    if (parentId) params.append('parent_id', parentId);
    return request(`/folders/?${params}`);
  },
  getFolderTree: () => request('/folders/tree'),
  getFolder: (id: string) => request(`/folders/${id}`),
  updateFolder: (id: string, data: { name?: string; description?: string; color?: string; icon?: string }) =>
    request(`/folders/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteFolder: (id: string, recursive = false) =>
    request(`/folders/${id}?recursive=${recursive}`, { method: 'DELETE' }),
  moveFolder: (id: string, parentId?: string) => {
    const params = new URLSearchParams();
    if (parentId) params.append('parent_id', parentId);
    return request(`/folders/${id}/move?${params}`, { method: 'PUT' });
  },

  // Files
  uploadFile: (file: File, folderId?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    if (folderId) formData.append('folder_id', folderId);
    return request('/files/upload', { method: 'POST', body: formData });
  },
  listFiles: (page = 1, pageSize = 20, folderId?: string) => {
    const params = new URLSearchParams({ page: page.toString(), page_size: pageSize.toString() });
    if (folderId) params.append('folder_id', folderId);
    return request(`/files?${params}`);
  },
  getFile: (id: string) => request(`/files/${id}`),
  deleteFile: (id: string) => request(`/files/${id}`, { method: 'DELETE' }),
  processFile: (id: string) => request(`/files/process/${id}`, { method: 'POST' }),

  // Syllabus
  listSyllabi: (examName?: string, year?: number, page = 1, pageSize = 20) => {
    const params = new URLSearchParams();
    if (examName) params.append('exam_name', examName);
    if (year) params.append('year', year.toString());
    params.append('page', page.toString());
    params.append('page_size', pageSize.toString());
    return request(`/syllabus?${params}`);
  },
  getSyllabus: (id: string) => request(`/syllabus/${id}`),
  listExamPatterns: (examName?: string, page = 1, pageSize = 20) => {
    const params = new URLSearchParams();
    if (examName) params.append('exam_name', examName);
    params.append('page', page.toString());
    params.append('page_size', pageSize.toString());
    return request(`/syllabus/exam-patterns?${params}`);
  },

  // Questions
  generatePaper: (data: any) =>
    request('/questions/generate', { method: 'POST', body: JSON.stringify(data) }),
  syllabusGenerate: (data: { text: string; exam_name?: string; question_count?: number; language?: string; difficulty?: string }) =>
    request('/questions/syllabus-generate', { method: 'POST', body: JSON.stringify(data) }),
  uploadAndGenerate: (file: File, exam_name?: string, question_count?: number, language?: string, difficulty?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    if (exam_name) formData.append('exam_name', exam_name);
    if (question_count) formData.append('question_count', question_count.toString());
    if (language) formData.append('language', language);
    if (difficulty) formData.append('difficulty', difficulty);
    return request('/questions/upload-and-generate', { method: 'POST', body: formData });
  },
  listPapers: (page = 1, pageSize = 20) =>
    request(`/questions/papers?page=${page}&page_size=${pageSize}`),
  getPaper: (id: string) => request(`/questions/papers/${id}`),
  deletePaper: (id: string) => request(`/questions/papers/${id}`, { method: 'DELETE' }),
  searchQuestionBank: (params: Record<string, any>) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null) query.append(k, v.toString()); });
    return request(`/questions/question-bank?${query}`);
  },

  // Search
  globalSearch: (q: string, entityType?: string, page = 1, pageSize = 20) => {
    const params = new URLSearchParams({ q, page: page.toString(), page_size: pageSize.toString() });
    if (entityType) params.append('entity_type', entityType);
    return request(`/search?${params}`);
  },

  // PDF Reader
  createNote: (data: any) => request('/pdf-reader/notes', { method: 'POST', body: JSON.stringify(data) }),
  listNotes: (fileId: string) => request(`/pdf-reader/notes/${fileId}`),
  deleteNote: (id: string) => request(`/pdf-reader/notes/${id}`, { method: 'DELETE' }),
  archiveNote: (id: string) => request(`/pdf-reader/notes/${id}/archive`, { method: 'PUT' }),
  createBookmark: (data: any) => request('/pdf-reader/bookmarks', { method: 'POST', body: JSON.stringify(data) }),
  listBookmarks: (fileId: string) => request(`/pdf-reader/bookmarks/${fileId}`),
  deleteBookmark: (id: string) => request(`/pdf-reader/bookmarks/${id}`, { method: 'DELETE' }),
  createAnnotation: (data: any) => request('/pdf-reader/annotations', { method: 'POST', body: JSON.stringify(data) }),
  listAnnotations: (fileId: string) => request(`/pdf-reader/annotations/${fileId}`),
  deleteAnnotation: (id: string) => request(`/pdf-reader/annotations/${id}`, { method: 'DELETE' }),

  // Admin
  getDashboard: () => request('/admin/dashboard'),
  listUsers: (page = 1, pageSize = 20) => request(`/admin/users?page=${page}&page_size=${pageSize}`),
  updateUser: (id: string, data: any) => request(`/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  getAuditLogs: (page = 1, pageSize = 20) => request(`/admin/audit-logs?page=${page}&page_size=${pageSize}`),
  getSettings: () => request('/admin/settings'),
  listJobs: (page = 1, pageSize = 20) => request(`/admin/jobs?page=${page}&page_size=${pageSize}`),

  // Profile / Token Tracking
  getTokenUsage: (days = 30) => request(`/profile/tokens?days=${days}`),
  getQuota: () => request('/profile/quota'),
  checkQuota: (requiredTokens = 0) => request(`/profile/check-quota?required_tokens=${requiredTokens}`),

  // Tasks / Phased Generation
  createTaskPlan: (data: { syllabus_text: string; exam_name?: string; language?: string; difficulty?: string; total_questions?: number; questions_per_phase?: number }) =>
    request('/tasks/create-plan', { method: 'POST', body: JSON.stringify(data) }),
  approveTaskPlan: (taskId: string, approve: boolean, reason?: string) =>
    request(`/tasks/${taskId}/approve`, { method: 'POST', body: JSON.stringify({ approve, reason: reason || '' }) }),
  startTaskUrl: (taskId: string) => `${API_BASE}/tasks/${taskId}/start`,
  autoResumeTasks: () => request('/tasks/auto-resume', { method: 'POST' }),
  getTaskStatus: (taskId: string) => request(`/tasks/${taskId}/status`),
  listTasks: (page = 1, pageSize = 20) => request(`/tasks/?page=${page}&page_size=${pageSize}`),

  // Health
  health: () => fetch(`${API_BASE.replace('/api/v1', '/api/health')}`).then(r => r.json()),
};
