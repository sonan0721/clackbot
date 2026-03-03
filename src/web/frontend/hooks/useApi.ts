import { useQuery, useMutation, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export function useApiQuery<T>(
  key: string[],
  path: string,
  options?: Omit<UseQueryOptions<T>, 'queryKey' | 'queryFn'>
) {
  return useQuery<T>({
    queryKey: key,
    queryFn: () => fetchApi<T>(path),
    ...options,
  });
}

export function useApiMutation<TData, TVariables>(
  path: string,
  method: 'PUT' | 'POST' | 'DELETE' = 'PUT'
) {
  const queryClient = useQueryClient();
  return useMutation<TData, Error, TVariables>({
    mutationFn: (variables) =>
      fetchApi<TData>(path, {
        method,
        body: JSON.stringify(variables),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });
}

export { fetchApi };
