import { create } from 'zustand';

interface Exam {
  id: string;
  name: string;
  exam_name?: string;
  papers?: Paper[];
  analysis?: any;
}

interface Paper {
  id?: string;
  setNumber?: number;
  title?: string;
  questions?: any[];
}

interface AppState {
  currentExam: Exam | null;
  currentPaper: Paper | null;
  setCurrentExam: (exam: Exam | null) => void;
  setCurrentPaper: (paper: Paper | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentExam: null,
  currentPaper: null,
  setCurrentExam: (exam) => set({ currentExam: exam }),
  setCurrentPaper: (paper) => set({ currentPaper: paper }),
}));
