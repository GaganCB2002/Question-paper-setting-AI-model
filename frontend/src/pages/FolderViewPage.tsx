import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Folder, FileText, Upload, Trash2, Pencil, Loader2, FolderPlus, CheckCircle, Eye } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { useFolderStore } from '../stores/folderStore';
import type { FolderItem } from '../stores/folderStore';
import { api } from '../lib/api';
import { useToast } from '../hooks/use-toast';

export default function FolderViewPage() {
  const { folderId } = useParams<{ folderId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { currentFolder, loading, fetchFolder, createFolder, updateFolder, deleteFolder, setCurrentFolder } = useFolderStore();
  const [files, setFiles] = useState<any[]>([]);
  const [subfolders, setSubfolders] = useState<FolderItem[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (folderId) {
      fetchFolder(folderId);
      api.listFiles(1, 100, folderId).then(r => {
        if (r.success) setFiles(r.data?.items || []);
      });
    }
    return () => { setCurrentFolder(null); };
  }, [folderId]);

  const refresh = async () => {
    if (!folderId) return;
    await fetchFolder(folderId);
    const res = await api.listFiles(1, 100, folderId);
    if (res.success) setFiles(res.data?.items || []);
    const dirRes = await api.listFolders(folderId);
    if (dirRes.success) setSubfolders(dirRes.data?.items || []);
  };

  useEffect(() => {
    if (currentFolder) refresh();
  }, [currentFolder?.id]);

  const handleCreateSubfolder = async () => {
    if (!newName.trim() || !folderId) return;
    const ok = await createFolder({ name: newName.trim(), parent_id: folderId });
    if (ok) {
      setShowCreate(false);
      setNewName('');
      toast({ title: 'Subfolder created' });
      refresh();
    }
  };

  const handleUpdate = async () => {
    if (!folderId || !editName.trim()) return;
    const ok = await updateFolder(folderId, { name: editName.trim(), description: editDesc || undefined });
    if (ok) {
      setEditing(false);
      toast({ title: 'Folder updated' });
    }
  };

  const handleDelete = async () => {
    if (!folderId) return;
    const total = files.length + subfolders.length;
    const msg = total > 0
      ? `Delete this folder and all ${total} item(s) inside?`
      : 'Delete this empty folder?';
    if (!window.confirm(msg)) return;
    const ok = await deleteFolder(folderId, true);
    if (ok) {
      toast({ title: 'Folder deleted' });
      navigate('/');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length || !folderId) return;
    setUploading(true);
    for (const file of Array.from(e.target.files)) {
      const res = await api.uploadFile(file, folderId);
      if (!res.success) {
        toast({ title: 'Upload failed', description: `${file.name}: ${res.error}`, variant: 'destructive' });
      }
    }
    setUploading(false);
    refresh();
    toast({ title: 'Upload complete', description: `${e.target.files.length} file(s) uploaded.` });
    e.target.value = '';
  };

  if (loading && !currentFolder) {
    return <div className="p-8 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" /></div>;
  }
  if (!currentFolder) {
    return <div className="p-8 text-center text-destructive">Folder not found.</div>;
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="max-w-5xl mx-auto p-8 space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/" className="hover:text-foreground">Dashboard</Link>
        <span>/</span>
        <span className="text-foreground font-medium">{currentFolder.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/"><ArrowLeft className="w-5 h-5" /></Link>
          </Button>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ backgroundColor: (currentFolder.color || '#6366f1') + '20', color: currentFolder.color || '#6366f1' }}>
            <Folder className="w-7 h-7" />
          </div>
          <div>
            {editing ? (
              <div className="flex gap-2 items-center">
                <Input value={editName} onChange={e => setEditName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleUpdate(); if (e.key === 'Escape') setEditing(false); }}
                  className="h-9" autoFocus />
                <Button size="sm" className="h-9" onClick={handleUpdate}>Save</Button>
                <Button size="sm" variant="ghost" className="h-9" onClick={() => setEditing(false)}>Cancel</Button>
              </div>
            ) : (
              <>
                <h1 className="text-2xl font-bold">{currentFolder.name}</h1>
                {currentFolder.description && (
                  <p className="text-sm text-muted-foreground mt-1">{currentFolder.description}</p>
                )}
              </>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {editing ? null : (
            <>
              <Button variant="outline" size="sm" onClick={() => { setEditing(true); setEditName(currentFolder.name); setEditDesc(currentFolder.description || ''); }}>
                <Pencil className="w-4 h-4 mr-2" /> Edit
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowCreate(true)}>
                <FolderPlus className="w-4 h-4 mr-2" /> Subfolder
              </Button>
              <label className="cursor-pointer">
                <Button variant="default" size="sm" disabled={uploading}>
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                  Upload
                </Button>
                <input type="file" multiple className="hidden" onChange={handleFileUpload}
                  accept=".pdf,.docx,.doc,.txt,.png,.jpg,.jpeg,.pptx,.xlsx" />
              </label>
              <Button variant="destructive" size="sm" onClick={handleDelete}>
                <Trash2 className="w-4 h-4 mr-2" /> Delete
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Subfolder Creation */}
      {showCreate && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4 flex items-center gap-3">
            <Input placeholder="New subfolder name" value={newName} onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreateSubfolder()} className="flex-1" autoFocus />
            <Button size="sm" onClick={handleCreateSubfolder} disabled={!newName.trim()}>Create</Button>
            <Button size="sm" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
          </CardContent>
        </Card>
      )}

      {/* Stats bar */}
      <div className="flex gap-4 text-sm text-muted-foreground">
        <span>{subfolders.length} subfolder{subfolders.length !== 1 ? 's' : ''}</span>
        <span>{files.length} file{files.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Subfolders */}
      {subfolders.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Subfolders</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {subfolders.map(sf => (
              <Card key={sf.id} className="hover:border-primary/30 cursor-pointer transition-all"
                onClick={() => navigate(`/folders/${sf.id}`)}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: (sf.color || '#6366f1') + '20', color: sf.color || '#6366f1' }}>
                    <Folder className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{sf.name}</p>
                    <p className="text-xs text-muted-foreground">{sf.file_count} files</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Files */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Files</h2>
        {files.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground border rounded-xl">
            <Upload className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No files in this folder</p>
            <p className="text-sm mt-1">Upload PDFs, documents, or images to get started.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {files.map(f => (
              <Card key={f.id} className={`hover:border-primary/30 transition-all ${f.extension === 'pdf' ? 'cursor-pointer' : ''}`}
                onClick={() => { if (f.extension === 'pdf') navigate(`/pdf-viewer/${f.id}`); }}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{f.original_filename}</p>
                    <div className="flex gap-3 text-xs text-muted-foreground mt-0.5">
                      <span>{formatSize(f.file_size)}</span>
                      <span>{f.extension?.toUpperCase()}</span>
                      {f.is_processed && <span className="flex items-center gap-1 text-green-500"><CheckCircle className="w-3 h-3" /> Processed</span>}
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">{f.extension?.toUpperCase() || 'FILE'}</Badge>
                  {f.extension === 'pdf' && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0"
                      onClick={(e) => { e.stopPropagation(); navigate(`/pdf-viewer/${f.id}`); }}>
                      <Eye className="w-4 h-4" />
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
