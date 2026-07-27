import { useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Clock, CheckCircle, FileQuestion, BookOpen } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { useSyllabus } from '../hooks/useApi';
import { useAppStore } from '../stores/appStore';

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

export default function ExamPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentExam, setCurrentExam } = useAppStore();
  
  const { data: examData, isLoading: loading } = useSyllabus(id);

  useEffect(() => {
    if (examData) {
      setCurrentExam(examData);
    }
  }, [examData, setCurrentExam]);

  const displayExam = currentExam || examData;

  if (loading) return <div className="p-8 text-center"><p className="text-muted-foreground animate-pulse">Loading exam blueprint...</p></div>;
  if (!displayExam) return <div className="p-8 text-center text-destructive">Exam not found.</div>;

  const analysis = (displayExam as any).analysis;

  const topicWeightage = analysis?.topicWeightage || [
    { section: 'General', topic: 'Overview', questions: 10, marks: 10, weightage: '20%' },
  ];
  const difficultyDistribution = analysis?.difficultyDistribution || { easy: 20, moderate: 40, hard: 30, veryHard: 10 };
  const conductingAuthority = analysis?.conductingAuthority || 'Karnataka Examination Authority';
  const duration = analysis?.duration || '3 hours';
  const totalQuestions = analysis?.totalQuestions || 50;

  const generatePaper = (setNum: number) => {
    navigate(`/exam/${id}/paper/${setNum}`);
  };

  return (
    <div className="max-w-5xl mx-auto p-8 space-y-8">
      <div className="flex items-center gap-4 mb-2">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/"><ArrowLeft className="w-5 h-5" /></Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{displayExam.name}</h1>
          <p className="text-muted-foreground flex items-center gap-2 mt-1">
            <span className="font-medium text-foreground">{conductingAuthority}</span>
            <span>•</span>
            <Clock className="w-4 h-4" /> {duration}
            <span>•</span>
            <FileQuestion className="w-4 h-4" /> {totalQuestions} Questions
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Left Column: Stats & Blueprint */}
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-primary" /> 
                Topic Weightage
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-muted-foreground bg-secondary/50 uppercase">
                    <tr>
                      <th className="px-4 py-3 rounded-tl-md">Section</th>
                      <th className="px-4 py-3">Topic</th>
                      <th className="px-4 py-3 text-center">Questions</th>
                      <th className="px-4 py-3 text-center">Marks</th>
                      <th className="px-4 py-3 rounded-tr-md">Weightage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topicWeightage.map((t: any, i: number) => (
                      <tr key={i} className="border-b last:border-0 hover:bg-secondary/20">
                        <td className="px-4 py-3 font-medium">{t.section}</td>
                        <td className="px-4 py-3">{t.topic}</td>
                        <td className="px-4 py-3 text-center font-mono">{t.questions}</td>
                        <td className="px-4 py-3 text-center font-mono">{t.marks}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                              <div className="h-full bg-primary" style={{ width: t.weightage }} />
                            </div>
                            <span className="text-xs font-mono">{t.weightage}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Difficulty Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-end gap-2 h-32 pt-4">
                {[
                  { label: 'Easy', val: difficultyDistribution.easy || 20, color: 'bg-green-500' },
                  { label: 'Moderate', val: difficultyDistribution.moderate || 40, color: 'bg-blue-500' },
                  { label: 'Hard', val: difficultyDistribution.hard || 30, color: 'bg-orange-500' },
                  { label: 'Very Hard', val: difficultyDistribution.veryHard || 10, color: 'bg-red-500' },
                ].map(d => (
                  <div key={d.label} className="flex-1 flex flex-col items-center justify-end gap-2 group">
                    <span className="text-xs font-mono opacity-0 group-hover:opacity-100 transition-opacity">{d.val}%</span>
                    <div className={`w-full rounded-t-md ${d.color} transition-all duration-500 hover:brightness-110`} style={{ height: `${d.val}%` }} />
                    <span className="text-sm font-medium">{d.label}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Generate Papers */}
        <div className="space-y-6">
          <h3 className="text-lg font-bold">Generate Mock Papers</h3>
          
          <div className="grid gap-4">
            {[1, 2, 3, 4, 5, 6].map(num => {
              const profile = SET_PROFILES[num];
              const existingPaper = displayExam.papers?.find((p: any) => p.setNumber === num);
              
              return (
                <Card key={num} className={`border transition-colors ${existingPaper ? 'border-green-500/50 bg-green-500/5' : 'hover:border-primary/50'}`}>
                  <CardHeader className="p-4 pb-2">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-base">{profile?.name || `Set ${num}`}</CardTitle>
                      {existingPaper && <CheckCircle className="w-4 h-4 text-green-500" />}
                    </div>
                    <CardDescription className="text-xs">{profile?.description || ''}</CardDescription>
                  </CardHeader>
                  <CardFooter className="p-4 pt-2 flex justify-between items-center">
                    {existingPaper ? (
                      <>
                        <Badge variant="outline" className="bg-background">Generated</Badge>
                        <Button size="sm" variant="secondary" onClick={() => generatePaper(num)}>View Paper</Button>
                      </>
                    ) : (
                      <>
                        <Badge variant="secondary" className="bg-secondary/50">Not Started</Badge>
                        <Button size="sm" onClick={() => generatePaper(num)}>Generate</Button>
                      </>
                    )}
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
