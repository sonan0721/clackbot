import { useApiQuery } from './useApi';
import type { StatusResponse } from '@/types/api';

export function useBotStatus() {
  return useApiQuery<StatusResponse>(
    ['status'],
    '/api/status',
    { refetchInterval: 30000 }
  );
}
