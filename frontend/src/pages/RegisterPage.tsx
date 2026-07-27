import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, Loader2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { api } from '../lib/api';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', username: '', full_name: '', password: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = async () => {
    if (!form.full_name.trim()) { setError('Full name is required'); return; }
    if (!form.email.trim()) { setError('Email is required'); return; }
    if (!form.email.includes('@')) { setError('Invalid email address'); return; }
    if (!form.username.trim() || form.username.length < 3) { setError('Username must be at least 3 characters'); return; }
    if (!form.password || form.password.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (form.password !== form.confirmPassword) { setError('Passwords do not match'); return; }
    setLoading(true);
    setError('');
    const res = await api.register({ email: form.email, username: form.username, password: form.password, full_name: form.full_name });
    if (res.success) {
      navigate('/login');
    } else {
      setError(res.error || 'Registration failed');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-950/20 via-background to-purple-950/20 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">Create Account</CardTitle>
          <CardDescription>Register to get started</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">{error}</p>}
          <div className="space-y-2">
            <label className="text-sm font-medium">Full Name</label>
            <Input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} placeholder="Your full name" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Email</label>
            <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="email@example.com" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Username</label>
            <Input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} placeholder="Choose a username" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Password</label>
            <Input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Create a password" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Confirm Password</label>
            <Input type="password" value={form.confirmPassword} onChange={e => setForm({ ...form, confirmPassword: e.target.value })} placeholder="Confirm password" />
          </div>
          <Button className="w-full" onClick={handleRegister} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />}
            Create Account
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <button className="text-primary underline" onClick={() => navigate('/login')}>Sign in</button>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
