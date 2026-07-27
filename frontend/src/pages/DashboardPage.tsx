import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderPlus, Folder, FileText, Pencil, Trash2, Loader2, Plus, Upload, Search, FileDown, ChevronDown, ChevronRight, ChevronUp, File, Image, Type, Brain, Sparkles, BookOpen, CheckCircle, X, Download, Copy, Eye, AlertCircle, Lightbulb } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { useFolderStore } from '../stores/folderStore';
import type { FolderItem } from '../stores/folderStore';
import { api } from '../lib/api';
import { useToast } from '../hooks/use-toast';

const FOLDER_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#a855f7'];

interface GeneratedQuestion {
  question_number: number;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: string;
  correct_answer_text?: string;
  explanation: string;
  topic?: string;
  difficulty?: string;
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { folders, loading, fetchFolders, fetchTree, createFolder, updateFolder, deleteFolder, setCurrentFolder } = useFolderStore();

  // Folder state
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newColor, setNewColor] = useState(FOLDER_COLORS[0]);
  const [renameValue, setRenameValue] = useState('');
  const [stats, setStats] = useState({ files: 0, papers: 0, questions: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [menuFolderId, setMenuFolderId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });

  // Syllabus section state
  const [syllabusText, setSyllabusText] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generatedQuestions, setGeneratedQuestions] = useState<GeneratedQuestion[]>([]);
  const [expandedQuestions, setExpandedQuestions] = useState<Set<number>>(new Set());
  const [questionCount, setQuestionCount] = useState(10);
  const [selectedDifficulty, setSelectedDifficulty] = useState('balanced');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadFormat, setUploadFormat] = useState<'pdf' | 'word' | 'text' | null>(null);

  // Collapse state
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    stats: false,
    folders: false,
    syllabus: false,
    generated: false,
  });

  useEffect(() => {
    fetchFolders();
    fetchTree();
    api.getQuota().then(r => {
      if (r.success) setStats(prev => ({ ...prev, questions: r.data.daily_used }));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const handleClick = () => setMenuFolderId(null);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  const toggleSection = (key: string) => {
    setCollapsedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Folder functions
  const handleCreate = async () => {
    if (!newName.trim()) return;
    const ok = await createFolder({ name: newName.trim(), description: newDesc.trim() || undefined, color: newColor });
    if (ok) {
      setShowCreate(false);
      setNewName('');
      setNewDesc('');
      toast({ title: 'Folder created', description: `"${newName.trim()}" created successfully.` });
    }
  };

  const handleRename = async (id: string) => {
    if (!renameValue.trim()) return;
    const ok = await updateFolder(id, { name: renameValue.trim() });
    if (ok) {
      setEditingId(null);
      toast({ title: 'Folder renamed', description: `Renamed to "${renameValue.trim()}".` });
    }
  };

  const handleDelete = async (folder: FolderItem) => {
    setMenuFolderId(null);
    const hasContent = folder.file_count > 0;
    const msg = hasContent
      ? `Delete "${folder.name}" and all ${folder.file_count} file(s) inside?`
      : `Delete "${folder.name}"?`;
    if (!window.confirm(msg)) return;
    const ok = await deleteFolder(folder.id, true);
    if (ok) toast({ title: 'Folder deleted', description: `"${folder.name}" deleted.` });
  };

  const handleFolderClick = (e: React.MouseEvent, folder: FolderItem) => {
    e.stopPropagation();
    setMenuFolderId(folder.id);
    setMenuPos({ x: e.clientX, y: e.clientY });
  };

  // Syllabus functions
  const handleFileSelect = (format: 'pdf' | 'word' | 'text') => {
    setUploadFormat(format);
    const input = document.createElement('input');
    input.type = 'file';
    if (format === 'pdf') input.accept = '.pdf';
    else if (format === 'word') input.accept = '.docx,.doc';
    else input.accept = '.txt';
    input.onchange = (e: any) => {
      if (e.target.files?.[0]) setSelectedFile(e.target.files[0]);
    };
    input.click();
  };

  const handleGenerateFromText = async () => {
    if (!syllabusText.trim()) {
      toast({ title: 'No text', description: 'Please paste or type syllabus text first.', variant: 'destructive' });
      return;
    }
    setGenerating(true);
    setGeneratedQuestions([]);
    try {
      const res = await api.syllabusGenerate({
        text: syllabusText.trim(),
        question_count: questionCount,
        difficulty: selectedDifficulty,
      });
      if (res.success && res.data?.questions) {
        setGeneratedQuestions(res.data.questions);
        toast({ title: 'Questions generated', description: `${res.data.count} MCQ questions created.` });
      } else {
        toast({ title: 'Generation failed', description: res.error || 'Could not generate questions', variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Generation failed', variant: 'destructive' });
    }
    setGenerating(false);
  };

  const handleGenerateFromFile = async () => {
    if (!selectedFile) return;
    setGenerating(true);
    setGeneratedQuestions([]);
    try {
      const res = await api.uploadAndGenerate(selectedFile, 'General', questionCount, 'english', selectedDifficulty);
      if (res.success && res.data?.questions) {
        setGeneratedQuestions(res.data.questions);
        toast({ title: 'Questions generated', description: `${res.data.count} MCQ questions from "${selectedFile.name}".` });
        setSelectedFile(null);
        setUploadFormat(null);
      } else {
        toast({ title: 'Generation failed', description: res.error || 'Could not generate questions', variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Generation failed', variant: 'destructive' });
    }
    setGenerating(false);
  };

  const toggleQuestionExpand = (num: number) => {
    setExpandedQuestions(prev => {
      const next = new Set(prev);
      if (next.has(num)) next.delete(num);
      else next.add(num);
      return next;
    });
  };

  const filteredFolders = folders.filter(f =>
    !searchQuery || f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderFolderCard = (folder: FolderItem) => {
    const isEditing = editingId === folder.id;
    return (
      <Card key={folder.id} className="group hover:border-primary/30 transition-all relative">
        <CardContent className="p-5">
          <div className="flex items-start justify-between mb-3">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center cursor-pointer shrink-0"
              style={{ backgroundColor: (folder.color || '#6366f1') + '20', color: folder.color || '#6366f1' }}
              onClick={(e) => handleFolderClick(e, folder)}
            >
              <Folder className="w-6 h-6" />
            </div>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button variant="ghost" size="icon" className="h-8 w-8" title="Rename"
                onClick={(e) => { e.stopPropagation(); setEditingId(folder.id); setRenameValue(folder.name); }}>
                <Pencil className="w-3.5 h-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" title="Delete"
                onClick={(e) => { e.stopPropagation(); handleDelete(folder); }}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {isEditing ? (
            <div className="flex gap-2">
              <Input value={renameValue} onChange={e => setRenameValue(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleRename(folder.id); if (e.key === 'Escape') setEditingId(null); }}
                className="h-8 text-sm" autoFocus />
              <Button size="sm" className="h-8" onClick={() => handleRename(folder.id)}>Save</Button>
            </div>
          ) : (
            <h3
              className="font-semibold text-sm cursor-pointer hover:text-primary truncate"
              onClick={(e) => handleFolderClick(e, folder)}
            >
              {folder.name}
            </h3>
          )}

          <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <FileText className="w-3 h-3" /> {folder.file_count} file{folder.file_count !== 1 ? 's' : ''}
            </span>
            {folder.description && (
              <span className="truncate flex-1 text-right">{folder.description}</span>
            )}
          </div>
        </CardContent>

        {/* Context Menu */}
        {menuFolderId === folder.id && (
          <div
            className="fixed z-50 w-48 rounded-xl border bg-popover p-1 shadow-xl"
            style={{ left: menuPos.x, top: menuPos.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <button className="flex w-full items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-accent"
              onClick={() => { setCurrentFolder(folder); navigate(`/folders/${folder.id}`); setMenuFolderId(null); }}>
              <Eye className="w-4 h-4" /> View Folder
            </button>
            <button className="flex w-full items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-accent"
              onClick={() => { setEditingId(folder.id); setRenameValue(folder.name); setMenuFolderId(null); }}>
              <Pencil className="w-4 h-4" /> Rename
            </button>
            <button className="flex w-full items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-accent"
              onClick={() => { navigate('/upload'); setMenuFolderId(null); }}>
              <Upload className="w-4 h-4" /> Upload to Folder
            </button>
            <div className="h-px bg-border my-1" />
            <button className="flex w-full items-center gap-2 px-3 py-2 text-sm rounded-lg text-destructive hover:bg-destructive/10"
              onClick={() => handleDelete(folder)}>
              <Trash2 className="w-4 h-4" /> Delete
            </button>
          </div>
        )}
      </Card>
    );
  };

  const renderQuestionCard = (q: GeneratedQuestion) => {
    const isExpanded = expandedQuestions.has(q.question_number);
    const isCorrect = (opt: string) => opt === q.correct_answer;

    return (
      <Card key={q.question_number} className="border-primary/10">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold">{q.question_number}</span>
                {q.difficulty && (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    q.difficulty === 'easy' ? 'bg-green-500/10 text-green-500' :
                    q.difficulty === 'hard' ? 'bg-red-500/10 text-red-500' :
                    'bg-yellow-500/10 text-yellow-500'
                  }`}>{q.difficulty}</span>
                )}
                {q.topic && <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/5 text-muted-foreground">{q.topic}</span>}
              </div>
              <p className="font-medium text-sm mb-3">{q.question_text}</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                {['A', 'B', 'C', 'D'].map(opt => {
                  const optKey = `option_${opt.toLowerCase()}` as keyof typeof q;
                  const optText = q[optKey] as string;
                  const correct = isCorrect(opt);
                  return (
                    <div key={opt} className={`flex items-center gap-2 p-2 rounded-lg text-sm border ${
                      correct && isExpanded ? 'border-green-500/50 bg-green-500/5' : 'border-border'
                    }`}>
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        correct && isExpanded ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'
                      }`}>{opt}</span>
                      <span className={correct && isExpanded ? 'text-green-600 dark:text-green-400 font-medium' : ''}>{optText}</span>
                      {correct && isExpanded && <CheckCircle className="w-3.5 h-3.5 text-green-500 ml-auto shrink-0" />}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="h-8 text-xs gap-1"
              onClick={() => toggleQuestionExpand(q.question_number)}>
              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              {isExpanded ? 'Hide Explanation' : 'Show Explanation'}
            </Button>
          </div>

          {isExpanded && (
            <div className="mt-3 p-4 rounded-xl bg-primary/5 border border-primary/10">
              <div className="flex items-start gap-3">
                <Lightbulb className="w-5 h-5 text-yellow-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1">CORRECT ANSWER: {q.correct_answer}. {q.correct_answer_text || ''}</p>
                  <p className="text-sm leading-relaxed">{q.explanation}</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="max-w-6xl mx-auto p-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Manage folders, upload syllabus, and generate MCQ questions.</p>
        </div>
      </div>

      {/* Stats Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg">Overview</CardTitle>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleSection('stats')}>
            {collapsedSections.stats ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </CardHeader>
        {!collapsedSections.stats && (
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card><CardContent className="p-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-500"><Folder className="w-5 h-5" /></div>
                <div><p className="text-2xl font-bold">{folders.length}</p><p className="text-xs text-muted-foreground">Folders</p></div>
              </CardContent></Card>
              <Card><CardContent className="p-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500"><FileText className="w-5 h-5" /></div>
                <div><p className="text-2xl font-bold">{stats.files}</p><p className="text-xs text-muted-foreground">Files</p></div>
              </CardContent></Card>
              <Card><CardContent className="p-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center text-green-500"><FileDown className="w-5 h-5" /></div>
                <div><p className="text-2xl font-bold">{stats.papers}</p><p className="text-xs text-muted-foreground">Papers</p></div>
              </CardContent></Card>
              <Card><CardContent className="p-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-500"><Brain className="w-5 h-5" /></div>
                <div><p className="text-2xl font-bold">{stats.questions}</p><p className="text-xs text-muted-foreground">Questions</p></div>
              </CardContent></Card>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Folders Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg">Folders</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleSection('folders')}>
              {collapsedSections.folders ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </div>
        </CardHeader>
        {!collapsedSections.folders && (
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-9" placeholder="Search folders..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
              </div>
              <Button onClick={() => setShowCreate(true)}>
                <FolderPlus className="w-4 h-4 mr-2" /> New Folder
              </Button>
            </div>

            {/* Create Folder Dialog */}
            {showCreate && (
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="p-6 space-y-4">
                  <h3 className="font-semibold">Create New Folder</h3>
                  <Input placeholder="Folder name" value={newName} onChange={e => setNewName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleCreate()} autoFocus />
                  <Input placeholder="Description (optional)" value={newDesc} onChange={e => setNewDesc(e.target.value)} />
                  <div className="flex gap-2">
                    {FOLDER_COLORS.map(c => (
                      <button key={c} className={`w-7 h-7 rounded-full border-2 transition-all ${newColor === c ? 'border-foreground scale-110' : 'border-transparent'}`}
                        style={{ backgroundColor: c }} onClick={() => setNewColor(c)} />
                    ))}
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
                    <Button onClick={handleCreate} disabled={!newName.trim() || loading}>
                      {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                      Create
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Folder Grid */}
            {loading && folders.length === 0 ? (
              <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
            ) : filteredFolders.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Folder className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">No folders yet</p>
                <p className="text-xs mt-1">Create your first folder to organize your files.</p>
                <Button className="mt-4" size="sm" onClick={() => setShowCreate(true)}>
                  <FolderPlus className="w-4 h-4 mr-2" /> Create Folder
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredFolders.map(renderFolderCard)}
              </div>
            )}

            {/* Quick folder actions */}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => navigate('/upload')}>
                <Upload className="w-4 h-4 mr-2" /> Upload Files
              </Button>
              <Button variant="outline" size="sm" onClick={() => { setShowCreate(true); }}>
                <FolderPlus className="w-4 h-4 mr-2" /> New Folder
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Upload Syllabus Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            Upload Syllabus & Generate Questions
          </CardTitle>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleSection('syllabus')}>
            {collapsedSections.syllabus ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </CardHeader>
        {!collapsedSections.syllabus && (
          <CardContent className="space-y-6">
            {/* 3 Upload Blocks */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={() => handleFileSelect('pdf')}
                className={`flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-dashed transition-all ${
                  uploadFormat === 'pdf' && selectedFile ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-accent/50'
                }`}
              >
                <File className="w-10 h-10 text-red-500" />
                <span className="font-medium text-sm">Upload PDF</span>
                <span className="text-[10px] text-muted-foreground">.pdf files</span>
                {uploadFormat === 'pdf' && selectedFile && (
                  <span className="text-xs text-primary font-medium truncate max-w-full">{selectedFile.name}</span>
                )}
              </button>

              <button
                onClick={() => handleFileSelect('word')}
                className={`flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-dashed transition-all ${
                  uploadFormat === 'word' && selectedFile ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-accent/50'
                }`}
              >
                <FileText className="w-10 h-10 text-blue-500" />
                <span className="font-medium text-sm">Upload Word</span>
                <span className="text-[10px] text-muted-foreground">.docx / .doc files</span>
                {uploadFormat === 'word' && selectedFile && (
                  <span className="text-xs text-primary font-medium truncate max-w-full">{selectedFile.name}</span>
                )}
              </button>

              <button
                onClick={() => handleFileSelect('text')}
                className={`flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-dashed transition-all ${
                  uploadFormat === 'text' && selectedFile ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-accent/50'
                }`}
              >
                <Type className="w-10 h-10 text-green-500" />
                <span className="font-medium text-sm">Upload Text</span>
                <span className="text-[10px] text-muted-foreground">.txt files</span>
                {uploadFormat === 'text' && selectedFile && (
                  <span className="text-xs text-primary font-medium truncate max-w-full">{selectedFile.name}</span>
                )}
              </button>
            </div>

            {/* Selected File Actions */}
            {selectedFile && (
              <div className="flex items-center justify-between p-3 rounded-xl bg-accent/50 border">
                <div className="flex items-center gap-3">
                  {uploadFormat === 'pdf' ? <File className="w-5 h-5 text-red-500" /> :
                   uploadFormat === 'word' ? <FileText className="w-5 h-5 text-blue-500" /> :
                   <Type className="w-5 h-5 text-green-500" />}
                  <div>
                    <p className="text-sm font-medium">{selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => { setSelectedFile(null); setUploadFormat(null); }}>
                    <X className="w-4 h-4 mr-1" /> Remove
                  </Button>
                  <Button size="sm" onClick={handleGenerateFromFile} disabled={generating}>
                    {generating ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Sparkles className="w-4 h-4 mr-1" />}
                    Generate
                  </Button>
                </div>
              </div>
            )}

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-4 text-muted-foreground">Or paste text below</span>
              </div>
            </div>

            {/* Text Paste Area */}
            <div>
              <label className="text-sm font-medium mb-2 block">Syllabus Text</label>
              <textarea
                value={syllabusText}
                onChange={e => setSyllabusText(e.target.value)}
                placeholder="Paste your syllabus text, exam topics, or any educational content here to generate MCQ questions..."
                className="w-full min-h-[200px] p-4 rounded-xl border bg-background resize-y text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>

            {/* Generation Options */}
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground">Questions:</label>
                <select value={questionCount} onChange={e => setQuestionCount(Number(e.target.value))}
                  className="h-9 px-3 rounded-lg border bg-background text-sm">
                  {[5, 10, 15, 20, 25, 30, 50, 100, 150, 200, 300, 500].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground">Difficulty:</label>
                <select value={selectedDifficulty} onChange={e => setSelectedDifficulty(e.target.value)}
                  className="h-9 px-3 rounded-lg border bg-background text-sm">
                  <option value="easy">Easy</option>
                  <option value="balanced">Mixed</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
              <Button size="lg" onClick={handleGenerateFromText} disabled={generating || !syllabusText.trim()} className="ml-auto">
                {generating ? <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Generating...</> : <><Sparkles className="w-5 h-5 mr-2" /> Generate MCQ Questions</>}
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Generated Questions Section */}
      {generatedQuestions.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Brain className="w-5 h-5 text-primary" />
              Generated MCQ Questions ({generatedQuestions.length})
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => {
                const text = generatedQuestions.map(q =>
                  `Q${q.question_number}: ${q.question_text}\n` +
                  `A) ${q.option_a}\nB) ${q.option_b}\nC) ${q.option_c}\nD) ${q.option_d}\n` +
                  `Answer: ${q.correct_answer}. ${q.correct_answer_text || ''}\nExplanation: ${q.explanation}\n`
                ).join('\n---\n\n');
                navigator.clipboard.writeText(text);
                toast({ title: 'Copied', description: 'Questions copied to clipboard.' });
              }}>
                <Copy className="w-4 h-4 mr-1" /> Copy All
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleSection('generated')}>
                {collapsedSections.generated ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </Button>
            </div>
          </CardHeader>
          {!collapsedSections.generated && (
            <CardContent className="space-y-4">
              {generatedQuestions.map(renderQuestionCard)}
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}
