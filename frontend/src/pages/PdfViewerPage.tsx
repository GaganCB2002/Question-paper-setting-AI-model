import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { pdfjs, Document as PdfDoc, Page } from 'react-pdf';
import 'react-pdf/dist/Page/TextLayer.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import {
  ArrowLeft, Loader2, ZoomIn, ZoomOut, RotateCw, Search, Copy, Highlighter,
  StickyNote, Trash2, ChevronLeft, ChevronRight, FileText, Check, X, Download, MousePointer2
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { useToast } from '../hooks/use-toast';
import { useAuthStore } from '../stores/authStore';
import { api } from '../lib/api';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8000/api/v1';

interface HighlightItem {
  id: string;
  pageNumber: number;
  text: string;
  color: string;
  rects: { left: number; top: number; width: number; height: number }[];
}

interface NoteItem {
  id: string;
  pageNumber: number;
  content: string;
  color: string;
  positionX: number;
  positionY: number;
}

const HIGHLIGHT_COLORS = ['#fef08a', '#fde68a', '#bbf7d0', '#bfdbfe', '#c4b5fd', '#fecaca'];

export default function PdfViewerPage() {
  const { fileId } = useParams<{ fileId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const accessToken = useAuthStore(s => s.accessToken);

  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [rotation, setRotation] = useState(0);
  const [loading, setLoading] = useState(true);
  const [fileName, setFileName] = useState('');
  const [highlights, setHighlights] = useState<HighlightItem[]>([]);
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [showNotesPanel, setShowNotesPanel] = useState(false);
  const [activeTool, setActiveTool] = useState<'cursor' | 'highlight' | 'note'>('cursor');
  const [selectedColor, setSelectedColor] = useState(HIGHLIGHT_COLORS[0]);
  const [noteText, setNoteText] = useState('');
  const [notePosition, setNotePosition] = useState<{ x: number; y: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [searchResults, setSearchResults] = useState<number[]>([]);
  const [searchIndex, setSearchIndex] = useState(0);
  const [loadError, setLoadError] = useState(false);

  const pageRef = useRef<HTMLDivElement>(null);

  const pdfHeaders: Record<string, string> = {};
  if (accessToken) pdfHeaders['Authorization'] = `Bearer ${accessToken}`;

  const pdfUrl = fileId ? `${API_BASE}/files/${fileId}/download` : null;

  useEffect(() => {
    if (!fileId) return;
    setLoading(true);
    api.getFile(fileId).then(res => {
      if (res.success && res.data) {
        setFileName(res.data.original_filename || 'Unknown');
      }
      setLoading(false);
    }).catch(() => setLoading(false));

    api.listNotes(fileId).then(res => {
      if (res.success) {
        const items = Array.isArray(res.data) ? res.data : (res.data?.items || []);
        setNotes(items.map((n: any) => ({
          id: n.id,
          pageNumber: n.page_number || 1,
          content: n.content || '',
          color: n.color || '#fef08a',
          positionX: n.position_x || 100,
          positionY: n.position_y || 100,
        })));
      }
    });
  }, [fileId]);

  function onDocumentLoadSuccess({ numPages: n }: { numPages: number }) {
    setNumPages(n);
    setLoadError(false);
  }

  const goToPage = (page: number) => {
    setPageNumber(Math.max(1, Math.min(page, numPages)));
  };

  const handleTextSelection = useCallback(() => {
    if (activeTool !== 'highlight') return;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.toString().trim()) return;

    const text = selection.toString().trim();
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const pageEl = pageRef.current;
    if (!pageEl) return;

    const pageRect = pageEl.getBoundingClientRect();
    const newHighlight: HighlightItem = {
      id: `hl-${Date.now()}`,
      pageNumber,
      text,
      color: selectedColor,
      rects: [{
        left: rect.left - pageRect.left,
        top: rect.top - pageRect.top,
        width: rect.width,
        height: rect.height,
      }],
    };
    setHighlights(prev => [...prev, newHighlight]);
    selection.removeAllRanges();
    toast({ title: 'Highlighted', description: 'Text highlighted.' });
  }, [activeTool, pageNumber, selectedColor, toast]);

  const removeHighlight = (id: string) => {
    setHighlights(prev => prev.filter(h => h.id !== id));
  };

  const handlePageClick = (e: React.MouseEvent) => {
    if (activeTool !== 'note') return;
    const pageEl = pageRef.current;
    if (!pageEl) return;
    const rect = pageEl.getBoundingClientRect();
    setNotePosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
    setNoteText('');
  };

  const saveNote = async () => {
    if (!noteText.trim() || !notePosition || !fileId) return;
    const res = await api.createNote({
      file_id: fileId,
      page_number: pageNumber,
      note_type: 'text',
      content: noteText.trim(),
      color: selectedColor,
      position_x: notePosition.x,
      position_y: notePosition.y,
    });
    if (res.success && res.data) {
      setNotes(prev => [...prev, {
        id: res.data.id,
        pageNumber,
        content: noteText.trim(),
        color: selectedColor,
        positionX: notePosition.x,
        positionY: notePosition.y,
      }]);
      setNoteText('');
      setNotePosition(null);
      toast({ title: 'Note added', description: 'Note saved.' });
    } else {
      toast({ title: 'Failed', description: res.error || 'Could not save note', variant: 'destructive' });
    }
  };

  const deleteNote = async (id: string) => {
    await api.deleteNote(id);
    setNotes(prev => prev.filter(n => n.id !== id));
  };

  const handleSearch = () => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    const results: number[] = [];
    for (let i = 1; i <= numPages; i++) {
      if (highlights.some(h => h.pageNumber === i && h.text.toLowerCase().includes(searchQuery.toLowerCase()))) {
        results.push(i);
      }
    }
    setSearchResults(results);
    setSearchIndex(0);
    if (results.length > 0) setPageNumber(results[0]);
  };

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied', description: 'Text copied to clipboard.' });
  };

  const downloadPdf = () => {
    const link = document.createElement('a');
    link.href = pdfUrl || '';
    link.download = fileName || 'document.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Left Toolbar */}
      <div className="w-12 border-r bg-card flex flex-col items-center py-3 gap-3 shrink-0">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(-1)} title="Back">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="w-8 h-px bg-border" />
        <Button variant={activeTool === 'cursor' ? 'default' : 'ghost'} size="icon" className="h-8 w-8"
          onClick={() => setActiveTool('cursor')} title="Select">
          <MousePointer2 className="w-4 h-4" />
        </Button>
        <Button variant={activeTool === 'highlight' ? 'default' : 'ghost'} size="icon" className="h-8 w-8"
          onClick={() => setActiveTool(activeTool === 'highlight' ? 'cursor' : 'highlight')} title="Highlight">
          <Highlighter className="w-4 h-4" />
        </Button>
        <Button variant={activeTool === 'note' ? 'default' : 'ghost'} size="icon" className="h-8 w-8"
          onClick={() => setActiveTool(activeTool === 'note' ? 'cursor' : 'note')} title="Add note">
          <StickyNote className="w-4 h-4" />
        </Button>
        <div className="w-8 h-px bg-border" />
        <Button variant={showSearch ? 'default' : 'ghost'} size="icon" className="h-8 w-8"
          onClick={() => setShowSearch(!showSearch)} title="Search highlights">
          <Search className="w-4 h-4" />
        </Button>
        <Button variant={showNotesPanel ? 'default' : 'ghost'} size="icon" className="h-8 w-8"
          onClick={() => setShowNotesPanel(!showNotesPanel)} title="Notes panel">
          <FileText className="w-4 h-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={downloadPdf} title="Download PDF">
          <Download className="w-4 h-4" />
        </Button>
      </div>

      {/* Main PDF Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <div className="h-12 border-b bg-card flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-sm font-medium truncate max-w-[300px]">{fileName || 'PDF Viewer'}</span>
            {activeTool === 'highlight' && (
              <div className="flex items-center gap-1 ml-2 shrink-0">
                {HIGHLIGHT_COLORS.map(c => (
                  <button key={c} className={`w-5 h-5 rounded-sm border-2 ${selectedColor === c ? 'border-foreground' : 'border-transparent'}`}
                    style={{ backgroundColor: c }} onClick={() => setSelectedColor(c)} />
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setScale(s => Math.max(0.5, s - 0.1))}>
              <ZoomOut className="w-3.5 h-3.5" />
            </Button>
            <span className="text-xs w-12 text-center tabular-nums">{Math.round(scale * 100)}%</span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setScale(s => Math.min(3, s + 0.1))}>
              <ZoomIn className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setRotation(r => (r + 90) % 360)}>
              <RotateCw className="w-3.5 h-3.5" />
            </Button>
            <div className="w-px h-5 bg-border mx-1" />
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 px-2"
              onClick={() => goToPage(pageNumber - 1)} disabled={pageNumber <= 1}>
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            <span className="text-xs tabular-nums flex items-center gap-1">
              <input type="number" value={pageNumber} onChange={e => goToPage(Number(e.target.value))}
                className="w-8 text-center bg-transparent border-b border-border outline-none" min={1} max={numPages || 1} />
              / {numPages}
            </span>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 px-2"
              onClick={() => goToPage(pageNumber + 1)} disabled={pageNumber >= numPages}>
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Search Bar */}
        {showSearch && (
          <div className="h-10 border-b bg-card flex items-center gap-2 px-4 shrink-0">
            <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search in highlights..." className="h-7 text-xs max-w-xs"
              onKeyDown={e => e.key === 'Enter' && handleSearch()} />
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleSearch}>
              <Search className="w-3 h-3 mr-1" /> Search
            </Button>
            {searchResults.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {searchIndex + 1} of {searchResults.length} pages
              </span>
            )}
            {(searchResults.length > 0 || searchQuery) && (
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setSearchQuery(''); setSearchResults([]); }}>
                <X className="w-3 h-3" />
              </Button>
            )}
          </div>
        )}

        {/* PDF Content */}
        <div className="flex-1 overflow-auto bg-muted/30 flex justify-center p-4">
          <div ref={pageRef} className="relative" onMouseUp={handleTextSelection} onClick={handlePageClick}>
            {loading && (
              <div className="flex items-center justify-center w-[600px] h-[800px]">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            )}
            {pdfUrl && (
              <PdfDoc
                file={{ url: pdfUrl }} options={{ httpHeaders: pdfHeaders }}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={() => { setLoading(false); setLoadError(true); toast({ title: 'Load failed', description: 'Could not load PDF.', variant: 'destructive' }); }}
                loading={<div className="flex items-center justify-center w-[600px] h-[800px]"><Loader2 className="w-8 h-8 animate-spin" /></div>}
              >
                <Page pageNumber={pageNumber} scale={scale} rotate={rotation}
                  renderTextLayer renderAnnotationLayer
                  className="shadow-xl rounded-md overflow-hidden bg-white" />
              </PdfDoc>
            )}
            {loadError && (
              <div className="flex flex-col items-center justify-center w-[600px] h-[400px] text-muted-foreground gap-3">
                <FileText className="w-16 h-16 opacity-30" />
                <p className="font-medium">Failed to load PDF</p>
                <p className="text-xs">The file may be missing or inaccessible.</p>
              </div>
            )}

            {/* Highlight overlays */}
            {highlights.filter(h => h.pageNumber === pageNumber).map(h => (
              <div key={h.id} className="group absolute pointer-events-none"
                style={{ left: h.rects[0]?.left || 0, top: h.rects[0]?.top || 0, width: h.rects[0]?.width || 100, height: h.rects[0]?.height || 20 }}>
                <div className="absolute inset-0 opacity-40 rounded-sm" style={{ backgroundColor: h.color }} />
                <div className="absolute -top-6 left-0 hidden group-hover:flex gap-1 pointer-events-auto">
                  <button className="p-1 rounded bg-popover border shadow-sm text-xs hover:bg-accent"
                    onClick={() => copyText(h.text)} title="Copy text"><Copy className="w-3 h-3" /></button>
                  <button className="p-1 rounded bg-popover border shadow-sm text-xs hover:bg-accent"
                    onClick={() => removeHighlight(h.id)} title="Remove"><Trash2 className="w-3 h-3 text-destructive" /></button>
                </div>
              </div>
            ))}

            {/* Note markers */}
            {notes.filter(n => n.pageNumber === pageNumber).map(n => (
              <div key={n.id} className="absolute group cursor-pointer" style={{ left: n.positionX, top: n.positionY }}>
                <StickyNote className="w-5 h-5 opacity-70 hover:opacity-100 transition-opacity" style={{ color: n.color }} />
                <div className="absolute left-6 top-0 w-48 hidden group-hover:block z-50">
                  <div className="p-2 rounded-lg border bg-popover shadow-lg text-xs">
                    <p className="mb-1 whitespace-pre-wrap">{n.content}</p>
                    <button className="text-destructive hover:underline flex items-center gap-1 text-[10px]"
                      onClick={() => deleteNote(n.id)}><Trash2 className="w-3 h-3" /> Delete</button>
                  </div>
                </div>
              </div>
            ))}

            {/* Note input popup */}
            {notePosition && (
              <div className="absolute z-50" style={{ left: notePosition.x, top: notePosition.y + 10 }}>
                <Card className="shadow-xl w-64">
                  <CardContent className="p-3 space-y-2">
                    <textarea value={noteText} onChange={e => setNoteText(e.target.value)}
                      placeholder="Type your note..." rows={3}
                      className="w-full text-xs p-2 rounded border bg-background resize-none focus:outline-none focus:ring-1 focus:ring-primary" />
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setNotePosition(null)}>
                        <X className="w-3 h-3 mr-1" /> Cancel
                      </Button>
                      <Button size="sm" className="h-7 text-xs" onClick={saveNote} disabled={!noteText.trim()}>
                        <Check className="w-3 h-3 mr-1" /> Save
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Tool indicator */}
            {activeTool === 'highlight' && (
              <div className="absolute top-2 right-2 bg-popover/90 rounded-lg px-2 py-1 text-[10px] text-muted-foreground border shadow-sm">
                Select text to highlight
              </div>
            )}
            {activeTool === 'note' && (
              <div className="absolute top-2 right-2 bg-popover/90 rounded-lg px-2 py-1 text-[10px] text-muted-foreground border shadow-sm">
                Click anywhere to add a note
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Notes Panel */}
      {showNotesPanel && (
        <div className="w-72 border-l bg-card flex flex-col shrink-0">
          <div className="p-3 border-b flex items-center justify-between">
            <h3 className="text-sm font-semibold">Notes & Highlights</h3>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowNotesPanel(false)}>
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
          <div className="flex-1 overflow-auto p-3 space-y-3">
            {notes.length === 0 && highlights.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-8">No notes or highlights yet. Use the toolbar to add them.</p>
            )}
            <div className="space-y-2">
              {highlights.map(h => (
                <div key={h.id} className="p-2 rounded-lg border text-xs space-y-1 group">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: h.color }} />
                    <span className="text-[10px] text-muted-foreground">Page {h.pageNumber}</span>
                    <div className="ml-auto flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => copyText(h.text)} className="hover:text-primary"><Copy className="w-3 h-3" /></button>
                      <button onClick={() => removeHighlight(h.id)} className="hover:text-destructive"><Trash2 className="w-3 h-3" /></button>
                    </div>
                  </div>
                  <p className="text-muted-foreground mt-1 leading-relaxed line-clamp-3">"{h.text}"</p>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              {notes.map(n => (
                <div key={n.id} className="p-2 rounded-lg border text-xs space-y-1 group">
                  <div className="flex items-center gap-2">
                    <StickyNote className="w-3 h-3 shrink-0" style={{ color: n.color }} />
                    <span className="text-[10px] text-muted-foreground">Page {n.pageNumber}</span>
                    <button className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive"
                      onClick={() => deleteNote(n.id)}><Trash2 className="w-3 h-3" /></button>
                  </div>
                  <p className="mt-1">{n.content}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}