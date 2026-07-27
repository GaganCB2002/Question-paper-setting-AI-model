import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Sparkles, CheckCircle, XCircle, Play, Pause, RefreshCw, Clock, ListChecks, Brain, ChevronRight, ChevronDown, Layers, ThumbsUp, ThumbsDown } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { useToast } from '../hooks/use-toast';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/authStore';

interface Phase {
  phase_number: number;
  title: string;
  description?: string;
  topic?: string;
  question_count_planned: number;
  question_count_generated?: number;
  status?: string;
}

interface TaskData {
  id: string;
  title: string;
  status: string;
  total_phases: number;
  current_phase: number;
  total_questions_planned: number;
  total_questions_generated: number;
  progress_pct: number;
  created_at: string | null;
  completed_at: string | null;
  paused_at: string | null;
}

interface SSEEvent {
  type: string;
  phase?: number;
  title?: string;
  total?: number;
  progress?: string;
  message?: string;
  daily_remaining?: number;
  task_id?: string;
  total_generated?: number;
  total_planned?: number;
  generated?: number;
}

export default function TaskPlannerPage() {
  const navigate = useNavigate();
  const { toast } = useToast();

  // Plan creation
  const [syllabusText, setSyllabusText] = useState('');
  const [totalQuestions, setTotalQuestions] = useState(100);
  const [questionsPerPhase, setQuestionsPerPhase] = useState(25);
  const [examName, setExamName] = useState('General');
  const [difficulty, setDifficulty] = useState('balanced');
  const [creating, setCreating] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<any>(null);
  const [phases, setPhases] = useState<Phase[]>([]);

  // Approval
  const [showApproval, setShowApproval] = useState(false);

  // Task list
  const [tasks, setTasks] = useState<TaskData[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  // Generation
  const [generating, setGenerating] = useState(false);
  const [genLog, setGenLog] = useState<SSEEvent[]>([]);

  useEffect(() => {
    loadTasks();
    autoResumePaused();
  }, []);

  const autoResumePaused = async () => {
    try {
      const res = await api.autoResumeTasks();
      if (res.success && res.data?.resumed > 0) {
        toast({ title: 'Tasks auto-resumed', description: res.data.message });
        loadTasks();
      }
    } catch {}
  };

  const loadTasks = async () => {
    setLoadingTasks(true);
    const res = await api.listTasks();
    if (res.success && res.data) {
      setTasks(res.data.items || []);
    }
    setLoadingTasks(false);
  };

  const handleCreatePlan = async () => {
    if (!syllabusText.trim()) {
      toast({ title: 'No text', description: 'Please paste syllabus text first.', variant: 'destructive' });
      return;
    }
    setCreating(true);
    setCurrentPlan(null);
    setPhases([]);
    try {
      const res = await api.createTaskPlan({
        syllabus_text: syllabusText.trim(),
        exam_name: examName,
        difficulty,
        total_questions: totalQuestions,
        questions_per_phase: questionsPerPhase,
      });
      if (res.success && res.data) {
        setCurrentPlan(res.data);
        setPhases(res.data.phases || []);
        setShowApproval(true);
        toast({ title: 'Plan created', description: `${res.data.total_phases} phases planned for ${res.data.total_questions_planned} questions.` });
      } else {
        toast({ title: 'Plan failed', description: res.error || 'Could not create plan', variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setCreating(false);
  };

  const handleApprove = async (approve: boolean) => {
    if (!currentPlan) return;
    try {
      const res = await api.approveTaskPlan(currentPlan.task_id, approve);
      if (res.success) {
        if (approve) {
          toast({ title: 'Plan approved', description: 'Starting generation...' });
          setShowApproval(false);
          handleStartTask(currentPlan.task_id);
        } else {
          toast({ title: 'Plan rejected', description: 'You can modify and recreate the plan.' });
          setShowApproval(false);
        }
        loadTasks();
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleStartTask = async (taskId: string) => {
    setActiveTaskId(taskId);
    setGenerating(true);
    setGenLog([]);

    const token = useAuthStore.getState().accessToken;
    const url = api.startTaskUrl(taskId);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      if (!res.body) throw new Error('No stream body');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data: SSEEvent = JSON.parse(line.slice(6));
              setGenLog(prev => [...prev, data]);

              if (data.type === 'complete' || data.type === 'error' || data.type === 'quota_exceeded') {
                reader.cancel();
                setGenerating(false);
                loadTasks();
                if (data.type === 'complete') {
                  toast({ title: 'Task complete', description: data.message });
                } else if (data.type === 'quota_exceeded') {
                  toast({ title: 'Quota exceeded', description: data.message, variant: 'destructive' });
                } else {
                  toast({ title: 'Error', description: data.message, variant: 'destructive' });
                }
                return;
              }
            } catch {}
          }
        }
      }
    } catch (err: any) {
      setGenerating(false);
      toast({ title: 'Connection lost', description: err.message || 'Generation stream ended.', variant: 'destructive' });
    }
  };

  const handleResumeTask = async (taskId: string) => {
    await handleStartTask(taskId);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-500';
      case 'in_progress': return 'text-blue-500';
      case 'paused': return 'text-yellow-500';
      case 'planning': return 'text-purple-500';
      case 'approved': return 'text-indigo-500';
      case 'rejected': return 'text-red-500';
      default: return 'text-muted-foreground';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'in_progress': return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
      case 'paused': return <Pause className="w-4 h-4 text-yellow-500" />;
      case 'planning': return <Clock className="w-4 h-4 text-purple-500" />;
      case 'approved': return <ThumbsUp className="w-4 h-4 text-indigo-500" />;
      case 'rejected': return <XCircle className="w-4 h-4 text-red-500" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Task Planner</h1>
          <p className="text-muted-foreground mt-1">Create phased question generation plans with auto-resume.</p>
        </div>
      </div>

      {/* Step 1: Create Plan */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" />
            Step 1: Create a Phased Plan
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <textarea
            value={syllabusText}
            onChange={e => setSyllabusText(e.target.value)}
            placeholder="Paste your complete syllabus text here. The AI will analyze it and create a phased question generation plan..."
            className="w-full min-h-[200px] p-4 rounded-xl border bg-background resize-y text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Exam Name</label>
              <Input value={examName} onChange={e => setExamName(e.target.value)} className="h-9" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Total Questions (10-500)</label>
              <Input type="number" value={totalQuestions} onChange={e => setTotalQuestions(Number(e.target.value))}
                min={10} max={500} className="h-9" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Questions per Phase</label>
              <Input type="number" value={questionsPerPhase} onChange={e => setQuestionsPerPhase(Number(e.target.value))}
                min={5} max={100} className="h-9" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Difficulty</label>
              <select value={difficulty} onChange={e => setDifficulty(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border bg-background text-sm">
                <option value="easy">Easy</option>
                <option value="balanced">Mixed</option>
                <option value="hard">Hard</option>
              </select>
            </div>
          </div>

          <Button size="lg" onClick={handleCreatePlan} disabled={creating || !syllabusText.trim()} className="w-full">
            {creating ? <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Analyzing Syllabus...</> : <><Sparkles className="w-5 h-5 mr-2" /> Create Phased Plan</>}
          </Button>
        </CardContent>
      </Card>

      {/* Step 2: Approval */}
      {showApproval && currentPlan && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ListChecks className="w-5 h-5 text-primary" />
              Step 2: Review & Approve Plan
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-xl bg-card border">
              <h3 className="font-semibold mb-2">{currentPlan.title}</h3>
              <p className="text-sm text-muted-foreground">
                {currentPlan.total_phases} phases · {currentPlan.total_questions_planned} total questions
              </p>
            </div>

            <div className="space-y-2">
              {phases.map((p, i) => (
                <div key={i} className="flex items-center gap-4 p-3 rounded-lg bg-card border">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                    {p.phase_number}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{p.title || `Phase ${p.phase_number}`}</p>
                    <p className="text-xs text-muted-foreground">{p.topic} — {p.question_count_planned} questions</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" size="lg" onClick={() => handleApprove(false)}>
                <ThumbsDown className="w-4 h-4 mr-2" /> Reject Plan
              </Button>
              <Button size="lg" onClick={() => handleApprove(true)}>
                <ThumbsUp className="w-4 h-4 mr-2" /> Approve & Start
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Generation Progress */}
      {generating && (
        <Card className="border-blue-500/30 bg-blue-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-blue-500 animate-pulse" />
              Generating Questions...
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
              <span>{genLog.filter(e => e.type === 'generating').length > 0 ? 'Generating batch...' : 'Starting...'}</span>
            </div>
            <div className="max-h-60 overflow-y-auto space-y-1 bg-card/50 rounded-xl p-3">
              {genLog.map((e, i) => (
                <div key={i} className="flex items-center gap-2 text-xs font-mono">
                  {e.type === 'phase_start' && <span className="text-blue-500">▶ Phase {e.phase}: {e.title} ({e.total} questions)</span>}
                  {e.type === 'generating' && <span className="text-muted-foreground">  ↳ Generating: {e.progress}</span>}
                  {e.type === 'phase_complete' && <span className="text-green-500">✓ Phase {e.phase} complete ({e.generated} generated)</span>}
                  {e.type === 'quota_exceeded' && <span className="text-yellow-500">⚠ Quota exceeded: {e.message}</span>}
                  {e.type === 'error' && <span className="text-red-500">✖ Error: {e.message}</span>}
                  {e.type === 'resume' && <span className="text-indigo-500">↻ {e.message}</span>}
                  {e.type === 'complete' && <span className="text-green-500 font-bold">✓ {e.message}</span>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Task List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <ListChecks className="w-5 h-5" />
            Your Tasks
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={loadTasks}>
            <RefreshCw className="w-4 h-4 mr-1" /> Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {loadingTasks ? (
            <div className="text-center py-8"><Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" /></div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Layers className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">No tasks yet</p>
              <p className="text-xs mt-1">Create a plan above to start generating questions.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {tasks.map(t => (
                <Card key={t.id} className="hover:border-primary/30 transition-all">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(t.status)}
                          <span className="font-medium text-sm">{t.title}</span>
                          <span className={`text-xs font-medium ${getStatusColor(t.status)}`}>{t.status}</span>
                        </div>
                        <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                          <span>{t.total_questions_generated}/{t.total_questions_planned} questions</span>
                          <span>Phase {t.current_phase}/{t.total_phases}</span>
                          <span>{t.progress_pct}% complete</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-muted mt-2 overflow-hidden">
                          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${t.progress_pct}%` }} />
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        {t.status === 'in_progress' && (
                          <Button size="sm" variant="outline" disabled>
                            <Loader2 className="w-4 h-4 animate-spin mr-1" /> Running
                          </Button>
                        )}
                        {t.status === 'paused' && (
                          <Button size="sm" onClick={() => handleResumeTask(t.id)}>
                            <Play className="w-4 h-4 mr-1" /> Resume
                          </Button>
                        )}
                        {t.status === 'approved' && (
                          <Button size="sm" onClick={() => handleStartTask(t.id)}>
                            <Play className="w-4 h-4 mr-1" /> Start
                          </Button>
                        )}
                        {(t.status === 'completed' || t.status === 'planning') && (
                          <Button size="sm" variant="outline" onClick={() => setActiveTaskId(t.id === activeTaskId ? null : t.id)}>
                            <ChevronDown className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
