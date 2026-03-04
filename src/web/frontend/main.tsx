import React from 'react';
import ReactDOM from 'react-dom/client';
import { createHashRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AgentStreamProvider } from './context/AgentStreamContext';
import App from './App';
import './globals.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
});

const router = createHashRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, lazy: () => import('./pages/Dashboard').then(m => ({ Component: m.default })) },
      { path: 'sessions', lazy: () => import('./pages/Sessions').then(m => ({ Component: m.default })) },
      { path: 'conversations', lazy: () => import('./pages/Conversations').then(m => ({ Component: m.default })) },
      { path: 'projects/:name/sessions', lazy: () => import('./pages/Sessions').then(m => ({ Component: m.default })) },
      { path: 'projects/:name/memory', lazy: () => import('./pages/Memory').then(m => ({ Component: m.default })) },
      { path: 'projects/:name/conversations', lazy: () => import('./pages/Conversations').then(m => ({ Component: m.default })) },
      { path: 'tools', lazy: () => import('./pages/Tools').then(m => ({ Component: m.default })) },
      { path: 'chat', lazy: () => import('./pages/Chat').then(m => ({ Component: m.default })) },
      { path: 'agents', lazy: () => import('./pages/AgentControlCenter').then(m => ({ Component: m.default })) },
      { path: 'activity', lazy: () => import('./pages/ActivityLog').then(m => ({ Component: m.default })) },
      { path: 'settings', lazy: () => import('./pages/Settings').then(m => ({ Component: m.default })) },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AgentStreamProvider>
        <RouterProvider router={router} />
      </AgentStreamProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
