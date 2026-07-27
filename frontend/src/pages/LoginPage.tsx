import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, Loader2, UserCheck } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { useAuthStore } from '../stores/authStore';
import { api } from '../lib/api';

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore(s => s.setAuth);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fillTestUser = async () => {
    setUsername('testuser');
    setPassword('Test@123');
    setError('');
    setLoading(true);
    const res = await api.login('testuser', 'Test@123');
    if (res.success && res.data) {
      setAuth(res.data.access_token, res.data.refresh_token, res.data.user);
      navigate('/');
    } else {
      setError(res.error || 'Login failed');
    }
    setLoading(false);
  };

  const handleLogin = async () => {
    if (!username.trim()) { setError('Username or email is required'); return; }
    if (!password) { setError('Password is required'); return; }
    setLoading(true);
    setError('');
    const res = await api.login(username, password);
    if (res.success && res.data) {
      setAuth(res.data.access_token, res.data.refresh_token, res.data.user);
      navigate('/');
    } else {
      setError(res.error || 'Login failed');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-950/20 via-background to-purple-950/20 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">KKE Generator</CardTitle>
          <CardDescription>Sign in to continue</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">{error}</p>}
          <div className="space-y-2">
            <label className="text-sm font-medium">Username or Email</label>
            <Input value={username} onChange={e => setUsername(e.target.value)} placeholder="Enter your username" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Password</label>
            <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" onKeyDown={e => e.key === 'Enter' && handleLogin()} />
          </div>
          <Button className="w-full" onClick={handleLogin} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <LogIn className="w-4 h-4 mr-2" />}
            Sign In
          </Button>
          <Button variant="outline" className="w-full" onClick={fillTestUser} type="button">
            <UserCheck className="w-4 h-4 mr-2" />
            Test User
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Don't have an account?{' '}
            <button className="text-primary underline" onClick={() => navigate('/register')}>Register</button>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
