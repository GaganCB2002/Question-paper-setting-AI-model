import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Coins, BarChart3, CalendarDays, RefreshCw, AlertTriangle, Clock, Zap, Activity, ArrowLeft, Bell, CheckCircle } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { useAuthStore } from '../stores/authStore';
import { useToast } from '../hooks/use-toast';

const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8000/api/v1';

interface TokenData {
  daily_limit: number;
  daily_used: number;
  daily_remaining: number;
  daily_percentage: number;
  total_quota: number;
  total_used: number;
  total_remaining: number;
  total_percentage: number;
  reset_date: string | null;
}

interface DailyHistory {
  date: string;
  tokens: number;
  requests: number;
}

interface TopEndpoint {
  endpoint: string;
  tokens: number;
  requests: number;
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuthStore();
  const [tokenData, setTokenData] = useState<TokenData | null>(null);
  const [dailyHistory, setDailyHistory] = useState<DailyHistory[]>([]);
  const [topEndpoints, setTopEndpoints] = useState<TopEndpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<{ id: number; message: string; read: boolean }[]>([]);

  useEffect(() => {
    loadTokenData();
    loadNotifications();
  }, []);

  const loadTokenData = async () => {
    setLoading(true);
    try {
      const token = useAuthStore.getState().accessToken;
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/profile/tokens?days=30`, { headers });
      const data = await res.json();
      if (data.success && data.data) {
        setTokenData(data.data.quota);
        setDailyHistory(data.data.daily_history || []);
        setTopEndpoints(data.data.top_endpoints || []);

        if (data.data.needs_notification) {
          const pct = data.data.quota.daily_percentage;
          for (const t of data.data.notify_thresholds) {
            if (pct >= t) {
              toast({
                title: `Quota Warning: ${t}% Used`,
                description: `You have used ${t}% of your daily token quota.`,
              });
            }
          }
        }
      }
    } catch (err) {
      console.error('Failed to load token data:', err);
    }
    setLoading(false);
  };

  const loadNotifications = () => {
    const stored = localStorage.getItem('kke-notifications');
    if (stored) {
      try {
        setNotifications(JSON.parse(stored));
      } catch {}
    }
  };

  const markAllRead = () => {
    const updated = notifications.map(n => ({ ...n, read: true }));
    setNotifications(updated);
    localStorage.setItem('kke-notifications', JSON.stringify(updated));
  };

  const getPercentageColor = (pct: number) => {
    if (pct >= 90) return 'text-red-500';
    if (pct >= 75) return 'text-orange-500';
    if (pct >= 50) return 'text-yellow-500';
    return 'text-green-500';
  };

  const getProgressColor = (pct: number) => {
    if (pct >= 90) return 'bg-red-500';
    if (pct >= 75) return 'bg-orange-500';
    if (pct >= 50) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const formatNumber = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toString();
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <div className="max-w-5xl mx-auto p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
          <p className="text-muted-foreground mt-1">Manage your account and view token usage.</p>
        </div>
      </div>

      {/* User Info Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary text-2xl font-bold">
              {user?.full_name?.charAt(0)?.toUpperCase() || user?.username?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold">{user?.full_name || user?.username}</h2>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
              <div className="flex gap-3 mt-2 text-xs">
                <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary">{user?.role || 'user'}</span>
                {user?.is_superuser && <span className="px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-500">Admin</span>}
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={loadTokenData}>
              <RefreshCw className="w-4 h-4 mr-2" /> Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Token Quota Card */}
      {tokenData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Coins className="w-5 h-5 text-yellow-500" />
              Token Usage & Quota
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Daily Usage */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Daily Usage</span>
                <span className={`text-sm font-bold ${getPercentageColor(tokenData.daily_percentage)}`}>
                  {formatNumber(tokenData.daily_used)} / {formatNumber(tokenData.daily_limit)}
                </span>
              </div>
              <div className="w-full h-3 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${getProgressColor(tokenData.daily_percentage)}`}
                  style={{ width: `${Math.min(tokenData.daily_percentage, 100)}%` }}
                />
              </div>
              <div className="flex justify-between mt-1 text-xs text-muted-foreground">
                <span>0%</span>
                <span className={getPercentageColor(tokenData.daily_percentage)}>{tokenData.daily_percentage}% used</span>
                <span>100%</span>
              </div>
            </div>

            {/* Total Usage */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Total Quota</span>
                <span className={`text-sm font-bold ${getPercentageColor(tokenData.total_percentage)}`}>
                  {formatNumber(tokenData.total_used)} / {formatNumber(tokenData.total_quota)}
                </span>
              </div>
              <div className="w-full h-3 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${getProgressColor(tokenData.total_percentage)}`}
                  style={{ width: `${Math.min(tokenData.total_percentage, 100)}%` }}
                />
              </div>
              <div className="flex justify-between mt-1 text-xs text-muted-foreground">
                <span>0%</span>
                <span className={getPercentageColor(tokenData.total_percentage)}>{tokenData.total_percentage}% used</span>
                <span>100%</span>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
              <div className="p-3 rounded-xl bg-green-500/5 border border-green-500/10">
                <p className="text-xs text-muted-foreground">Daily Remaining</p>
                <p className="text-lg font-bold text-green-500">{formatNumber(tokenData.daily_remaining)}</p>
              </div>
              <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/10">
                <p className="text-xs text-muted-foreground">Total Remaining</p>
                <p className="text-lg font-bold text-blue-500">{formatNumber(tokenData.total_remaining)}</p>
              </div>
              <div className="p-3 rounded-xl bg-yellow-500/5 border border-yellow-500/10">
                <p className="text-xs text-muted-foreground">Daily Used</p>
                <p className="text-lg font-bold text-yellow-500">{formatNumber(tokenData.daily_used)}</p>
              </div>
              <div className="p-3 rounded-xl bg-purple-500/5 border border-purple-500/10">
                <p className="text-xs text-muted-foreground">Reset Date</p>
                <p className="text-lg font-bold text-purple-500 text-sm">{formatDate(tokenData.reset_date)}</p>
              </div>
            </div>

            {/* Threshold Warnings */}
            <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/10">
              <h4 className="text-sm font-semibold flex items-center gap-2 mb-2">
                <Bell className="w-4 h-4 text-amber-500" />
                Notification Thresholds
              </h4>
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                {[50, 75, 90, 100].map(t => {
                  const reached = tokenData.daily_percentage >= t;
                  return (
                    <div key={t} className={`p-2 rounded-lg ${reached ? 'bg-amber-500/10 text-amber-500' : 'bg-muted text-muted-foreground'}`}>
                      {reached ? <AlertTriangle className="w-3 h-3 mx-auto mb-1" /> : <CheckCircle className="w-3 h-3 mx-auto mb-1" />}
                      {t}%
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                You'll be notified at 50%, 75%, 90%, and 100% of your daily quota.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Daily History Chart */}
      {dailyHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="w-4 h-4" />
              Last 30 Days Usage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-1 h-32">
              {dailyHistory.slice(-30).map((day, i) => {
                const maxTokens = Math.max(...dailyHistory.map(d => d.tokens), 1);
                const height = Math.max((day.tokens / maxTokens) * 100, 3);
                const pct = tokenData ? Math.round((day.tokens / tokenData.daily_limit) * 100) : 0;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                    <div
                      className={`w-full rounded-t ${getProgressColor(pct)} opacity-80 hover:opacity-100 transition-opacity min-h-[4px]`}
                      style={{ height: `${height}%` }}
                      title={`${day.date}: ${formatNumber(day.tokens)} tokens`}
                    />
                    <span className="text-[8px] text-muted-foreground rotate-45 origin-left whitespace-nowrap">
                      {day.date.slice(5)}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top Endpoints */}
      {topEndpoints.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Zap className="w-4 h-4" />
              Top Endpoints by Usage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {topEndpoints.map((ep, i) => (
                <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50">
                  <span className="w-5 text-xs text-muted-foreground font-mono">{i + 1}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium truncate">{ep.endpoint}</p>
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span>{formatNumber(ep.tokens)} tokens</span>
                      <span>{ep.requests} requests</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notifications */}
      {notifications.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="w-4 h-4" />
              Notifications ({notifications.filter(n => !n.read).length} unread)
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={markAllRead}>
              Mark All Read
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {notifications.map(n => (
              <div key={n.id} className={`p-3 rounded-lg border ${n.read ? 'bg-card' : 'bg-primary/5 border-primary/20'}`}>
                <div className="flex items-start gap-3">
                  {n.read ? <Bell className="w-4 h-4 text-muted-foreground mt-0.5" /> : <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5" />}
                  <div>
                    <p className="text-sm">{n.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">{n.read ? 'Read' : 'Unread'}</p>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {loading && !tokenData && (
        <div className="text-center py-16 text-muted-foreground">
          <Coins className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p>Loading token usage data...</p>
        </div>
      )}
    </div>
  );
}
