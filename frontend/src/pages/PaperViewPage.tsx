import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Loader2, FileText, FileDown, CheckCircle } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { useToast } from '../hooks/use-toast';
import { api } from '../lib/api';
import { useAppStore } from '../stores/appStore';
import { useSSE } from '../hooks/useSSE';
import { useSyllabus } from '../hooks/useApi';

interface Paper {
  id: string;
  setNumber: number;
  title?: string;
  questions?: Question[];
}

interface Question {
  id?: string;
  questionNumber: number;
  questionText: string;
  optionA?: string;
  optionB?: string;
  optionC?: string;
  optionD?: string;
  correctAnswer: string;
  topic?: string;
  difficulty?: string;
  questionType: string;
  explanation?: string;
  memoryTrick?: string;
}

interface SetProfile {
  name: string;
  description: string;
}

const SET_PROFILES: Record<number, SetProfile> = {
  1: { name: 'Set 1', description: 'Default question set' },
  2: { name: 'Set 2', description: 'Alternate question set' },
  3: { name: 'Set 3', description: 'Practice set' },
  4: { name: 'Set 4', description: 'Revision set' },
  5: { name: 'Set 5', description: 'Mock test' },
  6: { name: 'Set 6', description: 'Final practice' },
};

export default function PaperViewPage() {
  const { examId, setNumber } = useParams<{ examId: string, setNumber: string }>();
  const setNum = parseInt(setNumber || '1');
  const profile = SET_PROFILES[setNum] || { name: `Set ${setNum}`, description: '' };
  const { toast } = useToast();
  
  const { currentExam, setCurrentExam } = useAppStore();
  const { data: examData } = useSyllabus(examId);

  useEffect(() => {
    if (examData && (!currentExam || currentExam.id !== examId)) {
      setCurrentExam(examData);
    }
  }, [examData, currentExam, examId, setCurrentExam]);

  const displayExam = currentExam || examData;
  
  const [paper, setPaper] = useState<Paper | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  
  const { status, streamText, startStream, error, setStatus } = useSSE(async (data) => {
    const paperRes = await api.getPaper(data.paper_id);
    if (paperRes.success) {
      setPaper(paperRes.data);
      if (paperRes.data.questions) {
        setQuestions(paperRes.data.questions);
      }
    }
  });
  
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!examId || !displayExam) return;

    const examName = displayExam?.exam_name || displayExam?.name || examId;
    startStream({ exam_name: examName, paper_set: `set_${setNum}`, question_count: 50, language: 'english', difficulty: 'balanced' });
  }, [examId, setNum, displayExam]);

  // Auto-scroll during streaming
  useEffect(() => {
    if (status === 'streaming') {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [streamText, status]);

  const handleDownload = (format: 'pdf' | 'docx') => {
    toast({ title: 'Coming Soon', description: `Export to ${format.toUpperCase()} will be available soon.` });
  };

  return (
    <div className="max-w-5xl mx-auto p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to={`/exam/${examId}`}><ArrowLeft className="w-5 h-5" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{profile?.name}</h1>
            <p className="text-muted-foreground text-sm">{displayExam?.name}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {status === 'streaming' && (
            <Badge variant="secondary" className="animate-pulse flex gap-2 py-1">
              <Loader2 className="w-3 h-3 animate-spin" /> Generating AI Paper
            </Badge>
          )}
          {status === 'complete' && (
            <>
              <Badge className="bg-green-500/10 text-green-500 hover:bg-green-500/20 flex gap-1 py-1">
                <CheckCircle className="w-3 h-3" /> Ready
              </Badge>
              <Button variant="outline" size="sm" onClick={() => handleDownload('pdf')}>
                <FileText className="w-4 h-4 mr-2" /> PDF
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleDownload('docx')}>
                <FileDown className="w-4 h-4 mr-2" /> DOCX
              </Button>
            </>
          )}
        </div>
      </div>

      {status === 'streaming' && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-6 font-mono text-sm whitespace-pre-wrap text-muted-foreground min-h-[500px]">
            {streamText}
            <span className="animate-pulse ml-1 inline-block w-2 h-4 bg-primary/50" />
            <div ref={bottomRef} />
          </CardContent>
        </Card>
      )}

      {status === 'complete' && questions.length > 0 && (
        <div className="space-y-6">
          {questions.map((q, index) => (
            <motion.div
              key={q.id || q.questionNumber}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
            >
              <Card className="hover:border-primary/30 transition-colors">
                <CardContent className="p-6">
                  <div className="flex gap-4">
                    <span className="font-bold text-lg min-w-[2.5rem]">Q{q.questionNumber}.</span>
                    <div className="flex-1 space-y-4">
                      <p className="text-base font-medium leading-relaxed">{q.questionText}</p>
                      
                      <div className="grid sm:grid-cols-2 gap-3 pl-2">
                        <div className={`p-3 rounded-md border ${q.correctAnswer === 'A' ? 'bg-green-500/10 border-green-500/30' : 'bg-secondary/20 border-transparent'}`}>
                          <span className="font-bold mr-2 text-muted-foreground">(A)</span> {q.optionA}
                        </div>
                        <div className={`p-3 rounded-md border ${q.correctAnswer === 'B' ? 'bg-green-500/10 border-green-500/30' : 'bg-secondary/20 border-transparent'}`}>
                          <span className="font-bold mr-2 text-muted-foreground">(B)</span> {q.optionB}
                        </div>
                        <div className={`p-3 rounded-md border ${q.correctAnswer === 'C' ? 'bg-green-500/10 border-green-500/30' : 'bg-secondary/20 border-transparent'}`}>
                          <span className="font-bold mr-2 text-muted-foreground">(C)</span> {q.optionC}
                        </div>
                        <div className={`p-3 rounded-md border ${q.correctAnswer === 'D' ? 'bg-green-500/10 border-green-500/30' : 'bg-secondary/20 border-transparent'}`}>
                          <span className="font-bold mr-2 text-muted-foreground">(D)</span> {q.optionD}
                        </div>
                      </div>

                      <div className="flex gap-2 pt-2">
                        <Badge variant="outline" className="text-xs bg-background">{q.topic}</Badge>
                        <Badge variant="outline" className={`text-xs ${
                          q.difficulty === 'easy' ? 'text-green-500 border-green-500/30' :
                          q.difficulty === 'moderate' ? 'text-blue-500 border-blue-500/30' :
                          q.difficulty === 'hard' ? 'text-orange-500 border-orange-500/30' :
                          'text-red-500 border-red-500/30'
                        }`}>{q.difficulty}</Badge>
                        <Badge variant="outline" className="text-xs text-muted-foreground border-border">{q.questionType.replace('_', ' ')}</Badge>
                      </div>

                      {q.explanation && (
                        <div className="mt-4 p-4 bg-primary/5 rounded-md text-sm border border-primary/10">
                          <p className="font-semibold text-primary mb-1">Explanation:</p>
                          <p className="text-muted-foreground whitespace-pre-wrap">{q.explanation}</p>
                          {q.memoryTrick && (
                            <div className="mt-3 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded text-yellow-600/90 dark:text-yellow-500/90">
                              <span className="font-bold">💡 Memory Trick:</span> {q.memoryTrick}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {status === 'error' && (
        <Card className="border-destructive">
          <CardContent className="p-6 text-center text-destructive">
            <p className="font-bold text-lg mb-2">Generation Failed</p>
            <p>{error}</p>
            <Button className="mt-4" onClick={() => startStream({ exam_name: examId, paper_set: `set_${setNum}`, question_count: 50, language: 'english', difficulty: 'balanced' })}>Try Again</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
