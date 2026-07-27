import { useState, useEffect } from 'react';
import { Upload as UploadIcon, FileText, Folder, Loader2, CheckCircle, AlertCircle, ChevronRight, Plus, X } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { useToast } from '../hooks/use-toast';
import { api } from '../lib/api';
import { useFolderStore } from '../stores/folderStore';
import { useNavigate } from 'react-router-dom';

export default function UploadPage() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { folders, fetchFolders, createFolder } = useFolderStore();

  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | undefined>(undefined);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  useEffect(() => { fetchFolders(); }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setFiles(Array.from(e.target.files));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files) setFiles(Array.from(e.dataTransfer.files));
  };

  const createNewFolderAndUpload = async () => {
    if (!newFolderName.trim()) return;
    const folderRes = await api.createFolder({ name: newFolderName.trim() });
    if (folderRes.success && folderRes.data) {
      setSelectedFolderId(folderRes.data.id);
      setShowNewFolder(false);
      setNewFolderName('');
      await fetchFolders();
      toast({ title: 'Folder created', description: `"${newFolderName.trim()}" created.` });
    }
  };

  const startUpload = async () => {
    if (files.length === 0) return;
    setUploading(true);
    setResults([]);

    const newResults: any[] = [];
    for (const file of files) {
      try {
        const res = await api.uploadFile(file, selectedFolderId);
        if (res.success) {
          newResults.push({ name: file.name, status: 'success', data: res.data });
        } else {
          newResults.push({ name: file.name, status: 'error', error: res.error });
        }
      } catch (err: any) {
        newResults.push({ name: file.name, status: 'error', error: err.message });
      }
    }

    setResults(newResults);
    setUploading(false);
    const successCount = newResults.filter(r => r.status === 'success').length;
    toast({
      title: 'Upload Complete',
      description: `${successCount} of ${files.length} files uploaded successfully.`,
    });
  };

  const selectedFolder = folders.find(f => f.id === selectedFolderId);

  return (
    <div className="max-w-4xl mx-auto p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Upload & Analyze</h1>
        <p className="text-muted-foreground mt-2">
          Upload syllabus, previous year papers, or notifications into folders.
        </p>
      </div>

      {/* Folder Selector */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Folder className="w-5 h-5" /> Target Folder</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <button
              className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${!selectedFolderId ? 'bg-primary text-primary-foreground border-primary' : 'bg-card hover:border-primary/50 border-border'}`}
              onClick={() => setSelectedFolderId(undefined)}
            >
              <FileText className="w-4 h-4 inline mr-1.5" /> Root (No Folder)
            </button>
            {folders.map(f => (
              <button key={f.id}
                className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${selectedFolderId === f.id ? 'bg-primary text-primary-foreground border-primary' : 'bg-card hover:border-primary/50 border-border'}`}
                onClick={() => setSelectedFolderId(f.id)}
              >
                <Folder className="w-4 h-4 inline mr-1.5" /> {f.name}
                <span className="ml-1.5 opacity-60">({f.file_count})</span>
              </button>
            ))}
            <button
              className="px-4 py-2 rounded-lg border border-dashed text-sm font-medium text-muted-foreground hover:border-primary/50 hover:text-foreground transition-all"
              onClick={() => setShowNewFolder(true)}
            >
              <Plus className="w-4 h-4 inline mr-1.5" /> New Folder
            </button>
          </div>

          {showNewFolder && (
            <div className="flex items-center gap-2 mt-3">
              <Input placeholder="Folder name" value={newFolderName} onChange={e => setNewFolderName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') createNewFolderAndUpload(); if (e.key === 'Escape') setShowNewFolder(false); }}
                className="max-w-xs h-9" autoFocus />
              <Button size="sm" onClick={createNewFolderAndUpload} disabled={!newFolderName.trim()}>Create</Button>
              <Button size="sm" variant="ghost" onClick={() => setShowNewFolder(false)}><X className="w-4 h-4" /></Button>
            </div>
          )}

          {selectedFolder && (
            <p className="text-xs text-muted-foreground mt-2">
              Uploading to: <span className="font-medium text-foreground">{selectedFolder.name}</span>
              {selectedFolder.description && ` — ${selectedFolder.description}`}
            </p>
          )}
        </CardContent>
      </Card>

      {/* File Drop Zone */}
      <Card>
        <CardContent className="pt-6">
          <div
            className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${files.length > 0 ? 'border-primary/50 bg-primary/5' : 'border-border hover:border-primary/50'}`}
            onDragOver={e => e.preventDefault()}
            onDrop={handleDrop}
          >
            <UploadIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Drag and drop your documents here</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Supports PDF, DOCX, PPTX, XLSX, TXT, and Images (Max 50MB)
            </p>

            <input
              type="file"
              id="file-upload"
              multiple
              className="hidden"
              onChange={handleFileChange}
              accept=".pdf,.docx,.doc,.txt,.png,.jpg,.jpeg,.pptx,.xlsx"
            />
            <Button asChild variant={files.length > 0 ? 'secondary' : 'default'}>
              <label htmlFor="file-upload" className="cursor-pointer">Select Files</label>
            </Button>
          </div>

          {files.length > 0 && (
            <div className="mt-8 space-y-4">
              <h4 className="font-medium">Selected Files ({files.length})</h4>
              <div className="grid gap-3">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-secondary/50 rounded-md border">
                    <FileText className="w-5 h-5 text-primary" />
                    <span className="flex-1 text-sm font-medium truncate">{f.name}</span>
                    <span className="text-xs text-muted-foreground">{(f.size / 1024 / 1024).toFixed(2)} MB</span>
                    <button onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))} className="p-1 hover:bg-destructive/10 rounded">
                      <X className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center pt-4">
                <div className="text-sm text-muted-foreground">
                  {selectedFolder ? `Saving to: ${selectedFolder.name}` : 'Saving to: Root'}
                </div>
                <Button size="lg" onClick={startUpload} disabled={uploading}>
                  {uploading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Uploading...</> : 'Upload Files'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Upload Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {results.map((r, i) => (
              <div key={i} className={`flex items-center gap-3 p-3 rounded-md border ${r.status === 'success' ? 'bg-green-500/5 border-green-500/20' : 'bg-destructive/10 border-destructive/20'}`}>
                {r.status === 'success' ? <CheckCircle className="w-5 h-5 text-green-500" /> : <AlertCircle className="w-5 h-5 text-destructive" />}
                <span className="flex-1 text-sm">{r.name}</span>
                <span className="text-xs text-muted-foreground">{r.status === 'success' ? 'Uploaded' : r.error}</span>
                {r.status === 'success' && (
                  <Button variant="ghost" size="sm" className="h-7 text-xs"
                    onClick={() => selectedFolderId && navigate(`/folders/${selectedFolderId}`)}>
                    View <ChevronRight className="w-3 h-3 ml-1" />
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
