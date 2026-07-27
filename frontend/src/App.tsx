import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import { Upload, Database, History, LayoutDashboard, Folder, LogOut, User as UserIcon, ListChecks } from 'lucide-react';
import { Toaster } from './components/ui/toaster';
import { ModeToggle } from './components/ModeToggle';
import { useAuthStore } from './stores/authStore';
import DashboardPage from './pages/DashboardPage';
import UploadPage from './pages/UploadPage';
import ExamPage from './pages/ExamPage';
import PaperViewPage from './pages/PaperViewPage';
import FolderViewPage from './pages/FolderViewPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ProfilePage from './pages/ProfilePage';
import TaskPlannerPage from './pages/TaskPlannerPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  if (!isAuthenticated()) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, clearAuth } = useAuthStore();
  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      <div className="hidden md:flex w-64 border-r bg-card flex-col shrink-0">
        <div className="p-6 border-b flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">KKE Generator</h2>
            <p className="text-xs text-muted-foreground mt-1">Karnataka Exams AI</p>
          </div>
          <ModeToggle />
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <Link to="/" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent hover:text-accent-foreground text-sm font-medium transition-colors">
            <LayoutDashboard className="w-4 h-4" /> Dashboard
          </Link>
          <Link to="/upload" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent hover:text-accent-foreground text-sm font-medium transition-colors">
            <Upload className="w-4 h-4" /> Upload & Analyze
          </Link>
          <Link to="/folders" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent hover:text-accent-foreground text-sm font-medium transition-colors">
            <Folder className="w-4 h-4" /> My Folders
          </Link>
          <Link to="/questions" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent hover:text-accent-foreground text-sm font-medium transition-colors">
            <Database className="w-4 h-4" /> Question Bank
          </Link>
          <Link to="/history" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent hover:text-accent-foreground text-sm font-medium transition-colors">
            <History className="w-4 h-4" /> History
          </Link>
          <Link to="/tasks" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent hover:text-accent-foreground text-sm font-medium transition-colors">
            <ListChecks className="w-4 h-4" /> Task Planner
          </Link>
          <Link to="/profile" className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent hover:text-accent-foreground text-sm font-medium transition-colors">
            <UserIcon className="w-4 h-4" /> Profile
          </Link>
        </nav>
        <div className="p-4 border-t">
          <div className="flex items-center justify-between">
            <div className="text-sm">
              <p className="font-medium truncate">{user?.full_name || user?.username}</p>
              <p className="text-xs text-muted-foreground">{user?.role || 'user'}</p>
            </div>
            <button onClick={clearAuth} className="p-2 hover:bg-accent rounded-md transition-colors" title="Sign out">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-auto bg-background/50 flex flex-col">
        <div className="md:hidden p-4 border-b bg-card flex justify-between items-center shrink-0">
          <h2 className="font-bold bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">KKE Generator</h2>
          <ModeToggle />
        </div>
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
      <Toaster />
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/*" element={
          <ProtectedRoute>
            <AppLayout>
              <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/upload" element={<UploadPage />} />
                <Route path="/folders/:folderId" element={<FolderViewPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/tasks" element={<TaskPlannerPage />} />
                <Route path="/exam/:id" element={<ExamPage />} />
                <Route path="/exam/:examId/paper/:setNumber" element={<PaperViewPage />} />
                <Route path="/questions" element={<div className="p-8"><h1 className="text-3xl font-bold mb-4">Question Bank</h1><p>Question Bank (Coming Soon)</p></div>} />
                <Route path="/history" element={<div className="p-8"><h1 className="text-3xl font-bold mb-4">History</h1><p>History (Coming Soon)</p></div>} />
              </Routes>
            </AppLayout>
          </ProtectedRoute>
        } />
      </Routes>
    </Router>
  );
}
