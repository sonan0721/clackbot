import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@/components/ui/sidebar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  LayoutDashboard,
  FolderOpen,
  MessageSquare,
  Brain,
  Wrench,
  Activity,
  Radio,
  Monitor,
  Settings,
  ChevronRight,
  Bot,
  Plus,
  Pencil,
  Trash2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useBotStatus } from '@/hooks/useBotStatus';
import { useApiQuery, fetchApi } from '@/hooks/useApi';
import { useQueryClient } from '@tanstack/react-query';
import { useAgentStreams } from '@/context/AgentStreamContext';
import { CreateProjectDialog, type ProjectToEdit } from '@/components/projects/CreateProjectDialog';
import type { ConfigResponse, AgentSessionsResponse } from '@/types/api';

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: status } = useBotStatus();
  const { data: config } = useApiQuery<ConfigResponse>(['config'], '/api/config');
  const { connected } = useAgentStreams();
  const { data: activeSessions } = useApiQuery<AgentSessionsResponse>(
    ['sessions', 'active'],
    '/api/sessions?status=active&limit=100',
  );
  const activeCount = activeSessions?.total ?? 0;

  const projects = config?.projects ? Object.entries(config.projects) : [];

  const isActive = (path: string) => location.pathname === path;

  // 프로젝트 다이얼로그 상태
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editProject, setEditProject] = useState<ProjectToEdit | null>(null);

  const handleCreateProject = () => {
    setEditProject(null);
    setDialogOpen(true);
  };

  const handleEditProject = (name: string, project: { path: string; description?: string }) => {
    setEditProject({ name, path: project.path, description: project.description });
    setDialogOpen(true);
  };

  const handleDeleteProject = async (name: string) => {
    if (!window.confirm(`프로젝트 [${name}]을 삭제하시겠습니까?`)) return;
    try {
      await fetchApi(`/api/projects/${name}`, { method: 'DELETE' });
      queryClient.invalidateQueries();
    } catch {
      // 에러 무시 (쿼리 무효화가 최신 상태를 보여줌)
    }
  };

  return (
    <Sidebar>
      <SidebarHeader className="border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Bot className="h-5 w-5 text-sidebar-primary" />
          <div className="flex flex-col">
            <span className="text-sm font-semibold">
              {status?.botName || 'Clackbot'}
            </span>
            <span className="text-xs text-muted-foreground">
              {status?.teamName || '연결 중...'}
            </span>
          </div>
          <span
            className={`ml-auto h-2 w-2 rounded-full ${
              connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
            }`}
            title={connected ? 'WebSocket 연결됨' : 'WebSocket 연결 끊김'}
          />
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* 대시보드 */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={isActive('/')}
                  onClick={() => navigate('/')}
                >
                  <LayoutDashboard className="h-4 w-4" />
                  <span>대시보드</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={isActive('/chat')}
                  onClick={() => navigate('/chat')}
                >
                  <Radio className="h-4 w-4" />
                  <span>실시간 채팅</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={isActive('/agents')}
                  onClick={() => navigate('/agents')}
                >
                  <Monitor className="h-4 w-4" />
                  <span>에이전트 관제</span>
                  {activeCount > 0 && (
                    <Badge variant="default" className="ml-auto h-5 min-w-5 px-1 text-[10px]">
                      {activeCount}
                    </Badge>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* 프로젝트 */}
        <SidebarGroup>
          <div className="flex items-center justify-between pr-2">
            <SidebarGroupLabel>프로젝트</SidebarGroupLabel>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5"
              onClick={handleCreateProject}
              title="프로젝트 추가"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
          <SidebarGroupContent>
            <SidebarMenu>
              {projects.map(([name, project]) => (
                <Collapsible key={name} defaultOpen className="group/collapsible">
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton className="group/project">
                        <FolderOpen className="h-4 w-4" />
                        <span className="flex-1 truncate">{name}</span>
                        {/* 편집/삭제 버튼 (hover 시 표시) */}
                        <span className="hidden group-hover/project:flex items-center gap-0.5 mr-1">
                          <button
                            className="rounded p-0.5 hover:bg-accent"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditProject(name, project);
                            }}
                            title="수정"
                          >
                            <Pencil className="h-3 w-3 text-muted-foreground" />
                          </button>
                          <button
                            className="rounded p-0.5 hover:bg-destructive/20"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteProject(name);
                            }}
                            title="삭제"
                          >
                            <Trash2 className="h-3 w-3 text-muted-foreground" />
                          </button>
                        </span>
                        <ChevronRight className="h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton
                            isActive={isActive(`/projects/${name}/memory`)}
                            onClick={() => navigate(`/projects/${name}/memory`)}
                          >
                            <Brain className="h-3.5 w-3.5" />
                            <span>메모리</span>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton
                            isActive={isActive(`/projects/${name}/conversations`)}
                            onClick={() => navigate(`/projects/${name}/conversations`)}
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                            <span>대화 이력</span>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              ))}
              {projects.length === 0 && (
                <SidebarMenuItem>
                  <SidebarMenuButton disabled>
                    <span className="text-muted-foreground text-xs">프로젝트 없음</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* 도구 & 활동 */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={isActive('/conversations')}
                  onClick={() => navigate('/conversations')}
                >
                  <MessageSquare className="h-4 w-4" />
                  <span>대화 이력</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={isActive('/tools')}
                  onClick={() => navigate('/tools')}
                >
                  <Wrench className="h-4 w-4" />
                  <span>도구 & 에이전트</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={isActive('/activity')}
                  onClick={() => navigate('/activity')}
                >
                  <Activity className="h-4 w-4" />
                  <span>활동 로그</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={isActive('/settings')}
              onClick={() => navigate('/settings')}
            >
              <Settings className="h-4 w-4" />
              <span>설정</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      {/* 프로젝트 생성/수정 다이얼로그 */}
      <CreateProjectDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editProject={editProject}
      />
    </Sidebar>
  );
}
