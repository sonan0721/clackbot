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
  ListTodo,
  Wrench,
  Activity,
  Radio,
  Settings,
  ChevronRight,
  Bot,
} from 'lucide-react';
import { useBotStatus } from '@/hooks/useBotStatus';
import { useApiQuery } from '@/hooks/useApi';
import type { ConfigResponse } from '@/types/api';

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { data: status } = useBotStatus();
  const { data: config } = useApiQuery<ConfigResponse>(['config'], '/api/config');

  const projects = config?.projects ? Object.entries(config.projects) : [];

  const isActive = (path: string) => location.pathname === path;

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
              status?.online ? 'bg-green-500' : 'bg-gray-400'
            }`}
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
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* 프로젝트 */}
        <SidebarGroup>
          <SidebarGroupLabel>프로젝트</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {projects.map(([name]) => (
                <Collapsible key={name} defaultOpen className="group/collapsible">
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton>
                        <FolderOpen className="h-4 w-4" />
                        <span>{name}</span>
                        <ChevronRight className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        <SidebarMenuSubItem>
                          <SidebarMenuSubButton
                            isActive={isActive(`/projects/${name}/sessions`)}
                            onClick={() => navigate(`/projects/${name}/sessions`)}
                          >
                            <ListTodo className="h-3.5 w-3.5" />
                            <span>세션</span>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
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
    </Sidebar>
  );
}
