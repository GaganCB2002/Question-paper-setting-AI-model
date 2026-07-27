import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '../lib/api';

export function useSyllabi(examName?: string, year?: number) {
  return useQuery({
    queryKey: ['syllabi', examName, year],
    queryFn: () => api.listSyllabi(examName, year).then(res => res.data),
  });
}

export function useSyllabus(id: string | undefined) {
  return useQuery({
    queryKey: ['syllabus', id],
    queryFn: () => (id ? api.getSyllabus(id).then(res => res.data) : null),
    enabled: !!id,
  });
}

export function usePapers(page = 1) {
  return useQuery({
    queryKey: ['papers', page],
    queryFn: () => api.listPapers(page).then(res => res.data),
  });
}

export function usePaper(id: string | undefined) {
  return useQuery({
    queryKey: ['paper', id],
    queryFn: () => (id ? api.getPaper(id).then(res => res.data) : null),
    enabled: !!id,
  });
}

export function useExamPatterns(examName?: string) {
  return useQuery({
    queryKey: ['examPatterns', examName],
    queryFn: () => api.listExamPatterns(examName).then(res => res.data),
  });
}

export function useUploadFile() {
  return useMutation({
    mutationFn: (file: File) => api.uploadFile(file),
  });
}

export function useFiles(page = 1) {
  return useQuery({
    queryKey: ['files', page],
    queryFn: () => api.listFiles(page).then(res => res.data),
  });
}

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.getDashboard().then(res => res.data),
  });
}

export function useUsers(page = 1) {
  return useQuery({
    queryKey: ['users', page],
    queryFn: () => api.listUsers(page).then(res => res.data),
  });
}

export function useSearch(q: string, entityType?: string) {
  return useQuery({
    queryKey: ['search', q, entityType],
    queryFn: () => api.globalSearch(q, entityType).then(res => res.data),
    enabled: q.length > 0,
  });
}
