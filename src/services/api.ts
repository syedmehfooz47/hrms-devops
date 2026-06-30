import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const api = axios.create({
  baseURL: API_URL,
});

// Request interceptor — attach JWT token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor — handle 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      if (window.location.pathname !== "/auth") {
        window.location.href = "/auth";
      }
    }
    return Promise.reject(error);
  }
);

// ─── Auth ────────────────────────────────────────────────
export const authService = {
  login: async (email: string, password: string) => {
    const { data } = await api.post("/auth/login", { email, password });
    if (data.token) {
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
    }
    return data;
  },

  register: async (name: string, email: string, password: string, role = "employee") => {
    const { data } = await api.post("/auth/register", { name, email, password, role });
    return data;
  },

  getCurrentUser: () => {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  },

  getMe: async () => {
    const { data } = await api.get("/auth/me");
    return data;
  },

  logout: () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  },

  isAuthenticated: () => !!localStorage.getItem("token"),
};

// ─── Employees ───────────────────────────────────────────
export const employeeService = {
  getAll: async (params?: { q?: string; status?: string; page?: number; limit?: number }) => {
    const { data } = await api.get("/employees", { params });
    return data;
  },

  getById: async (id: number | string) => {
    const { data } = await api.get(`/employees/${id}`);
    return data;
  },

  create: async (payload: any) => {
    const { data } = await api.post("/employees", payload);
    return data;
  },

  update: async (id: number | string, payload: any) => {
    const { data } = await api.put(`/employees/${id}`, payload);
    return data;
  },

  delete: async (id: number | string) => {
    const { data } = await api.delete(`/employees/${id}`);
    return data;
  },
};

// ─── Departments ─────────────────────────────────────────
export const departmentService = {
  getAll: async () => {
    const { data } = await api.get("/departments");
    return data;
  },

  getById: async (id: number | string) => {
    const { data } = await api.get(`/departments/${id}`);
    return data;
  },

  create: async (payload: { name: string; description?: string }) => {
    const { data } = await api.post("/departments", payload);
    return data;
  },

  update: async (id: number | string, payload: { name: string; description?: string }) => {
    const { data } = await api.put(`/departments/${id}`, payload);
    return data;
  },

  delete: async (id: number | string) => {
    const { data } = await api.delete(`/departments/${id}`);
    return data;
  },
};

// ─── Attendance ──────────────────────────────────────────
export const attendanceService = {
  getAll: async (params?: { employee_id?: number; date?: string; month?: number; year?: number }) => {
    const { data } = await api.get("/attendance", { params });
    return data;
  },

  getToday: async (employeeId: number | string) => {
    const { data } = await api.get(`/attendance/today/${employeeId}`);
    return data;
  },

  getMonth: async (employeeId: number | string, month: number, year: number) => {
    const { data } = await api.get(`/attendance/month/${employeeId}`, { params: { month, year } });
    return data;
  },

  getTeam: async (date: string) => {
    const { data } = await api.get("/attendance/team", { params: { date } });
    return data;
  },

  checkIn: async (employeeId: number | string) => {
    const { data } = await api.post("/attendance/checkin", { employee_id: employeeId });
    return data;
  },

  checkOut: async (id: number | string) => {
    const { data } = await api.put(`/attendance/checkout/${id}`);
    return data;
  },

  mark: async (payload: { employee_id: number; attendance_date: string; status: string }) => {
    const { data } = await api.post("/attendance", payload);
    return data;
  },

  update: async (id: number | string, payload: any) => {
    const { data } = await api.put(`/attendance/${id}`, payload);
    return data;
  },

  delete: async (id: number | string) => {
    const { data } = await api.delete(`/attendance/${id}`);
    return data;
  },
};

// ─── Leave ───────────────────────────────────────────────
export const leaveService = {
  getAll: async () => {
    const { data } = await api.get("/leave");
    return data;
  },

  getMy: async () => {
    const { data } = await api.get("/leave/my");
    return data;
  },

  getBalances: async (employeeId: number | string, year?: number) => {
    const { data } = await api.get(`/leave/balances/${employeeId}`, { params: { year } });
    return data;
  },

  apply: async (payload: { employee_id: number; leave_type: string; start_date: string; end_date: string; reason?: string }) => {
    const { data } = await api.post("/leave", payload);
    return data;
  },

  approve: async (id: number | string, approver_id: number, approver_note?: string) => {
    const { data } = await api.put(`/leave/${id}/approve`, { approver_id, approver_note });
    return data;
  },

  reject: async (id: number | string, approver_id: number, approver_note?: string) => {
    const { data } = await api.put(`/leave/${id}/reject`, { approver_id, approver_note });
    return data;
  },

  cancel: async (id: number | string) => {
    const { data } = await api.delete(`/leave/${id}`);
    return data;
  },
};

// ─── Payroll ─────────────────────────────────────────────
export const payrollService = {
  getAll: async () => {
    const { data } = await api.get("/payroll");
    return data;
  },

  getMySlips: async (employeeId: number | string) => {
    const { data } = await api.get(`/payroll/slips/${employeeId}`);
    return data;
  },

  create: async (payload: any) => {
    const { data } = await api.post("/payroll", payload);
    return data;
  },

  generate: async (month: number, year: number) => {
    const { data } = await api.post("/payroll/generate", { month, year });
    return data;
  },

  update: async (id: number | string, payload: any) => {
    const { data } = await api.put(`/payroll/${id}`, payload);
    return data;
  },
};

// ─── Recruitment ─────────────────────────────────────────
export const recruitmentService = {
  getJobs: async () => {
    const { data } = await api.get("/recruitment");
    return data;
  },

  createJob: async (payload: any) => {
    const { data } = await api.post("/recruitment", payload);
    return data;
  },

  updateJobStatus: async (id: number | string, status: string) => {
    const { data } = await api.put(`/recruitment/${id}`, { status });
    return data;
  },

  getCandidates: async (jobId?: number | string) => {
    const { data } = await api.get("/recruitment/candidates", { params: { job_id: jobId } });
    return data;
  },

  addCandidate: async (payload: any) => {
    const { data } = await api.post("/recruitment/candidates", payload);
    return data;
  },

  updateCandidateStage: async (id: number | string, stage: string) => {
    const { data } = await api.put(`/recruitment/candidates/${id}`, { stage });
    return data;
  },

  getInterviews: async () => {
    const { data } = await api.get("/recruitment/interviews");
    return data;
  },

  scheduleInterview: async (payload: any) => {
    const { data } = await api.post("/recruitment/interviews", payload);
    return data;
  },

  updateInterviewStatus: async (id: number | string, status: string) => {
    const { data } = await api.put(`/recruitment/interviews/${id}`, { status });
    return data;
  },

  getOnboarding: async (employeeId: number | string) => {
    const { data } = await api.get(`/recruitment/onboarding/${employeeId}`);
    return data;
  },

  assignOnboarding: async (payload: any) => {
    const { data } = await api.post("/recruitment/onboarding", payload);
    return data;
  },

  updateTaskStatus: async (id: number | string, status: string) => {
    const { data } = await api.put(`/recruitment/onboarding/${id}`, { status });
    return data;
  },

  uploadResume: async (id: number | string, file: File) => {
    const formData = new FormData();
    formData.append("resume", file);
    const { data } = await api.post(`/recruitment/candidates/${id}/resume`, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return data;
  },

  triggerScreening: async (id: number | string) => {
    const { data } = await api.post(`/recruitment/candidates/${id}/screen`);
    return data;
  },
};

// ─── Performance ─────────────────────────────────────────
export const performanceService = {
  getMyGoals: async (employeeId: number | string) => {
    const { data } = await api.get(`/performance/goals/${employeeId}`);
    return data;
  },

  createGoal: async (payload: any) => {
    const { data } = await api.post("/performance/goals", payload);
    return data;
  },

  updateGoal: async (id: number | string, payload: any) => {
    const { data } = await api.put(`/performance/goals/${id}`, payload);
    return data;
  },

  getMyReviews: async (employeeId: number | string) => {
    const { data } = await api.get(`/performance/reviews/${employeeId}`);
    return data;
  },

  getTeamReviews: async () => {
    const { data } = await api.get("/performance/reviews");
    return data;
  },

  createReview: async (payload: any) => {
    const { data } = await api.post("/performance/reviews", payload);
    return data;
  },
};

// ─── Documents ───────────────────────────────────────────
export const documentService = {
  getAll: async (employeeId?: number | string) => {
    const { data } = await api.get("/documents", { params: { employee_id: employeeId } });
    return data;
  },

  upload: async (formData: FormData) => {
    const { data } = await api.post("/documents/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },

  download: (id: number | string) => {
    const token = localStorage.getItem("token");
    return `${API_URL}/documents/download/${id}?token=${token}`;
  },

  delete: async (id: number | string) => {
    const { data } = await api.delete(`/documents/${id}`);
    return data;
  },
};

// ─── Dashboard ───────────────────────────────────────────
export const dashboardService = {
  getStats: async () => {
    const { data } = await api.get("/dashboard");
    return data;
  },

  getDeptBreakdown: async () => {
    const { data } = await api.get("/dashboard/dept-breakdown");
    return data;
  },

  getRecentLeave: async () => {
    const { data } = await api.get("/dashboard/recent-leave");
    return data;
  },
};

// ─── Notifications ───────────────────────────────────────
export const notificationService = {
  getAll: async () => {
    const { data } = await api.get("/notifications");
    return data;
  },

  markRead: async (id: number | string) => {
    const { data } = await api.put(`/notifications/${id}/read`);
    return data;
  },

  markAllRead: async () => {
    const { data } = await api.put("/notifications/read-all");
    return data;
  },
};

// ─── Users / Profiles ────────────────────────────────────
export const userService = {
  getProfiles: async () => {
    const { data } = await api.get("/users/profiles");
    return data;
  },

  getProfile: async (id: number | string) => {
    const { data } = await api.get(`/users/profile/${id}`);
    return data;
  },

  updateProfile: async (id: number | string, payload: any) => {
    const { data } = await api.put(`/users/profile/${id}`, payload);
    return data;
  },
};

export default api;
