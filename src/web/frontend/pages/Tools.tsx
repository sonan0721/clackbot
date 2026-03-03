import { Wrench, Server, Bot, Sparkles } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useApiQuery } from '@/hooks/useApi';
import type { ToolsResponse } from '@/types/api';

interface AgentDef {
  file: string;
  name?: string;
  description?: string;
  [key: string]: string | undefined;
}

interface SkillDef {
  name: string;
  description?: string;
  [key: string]: string | undefined;
}

interface McpServerInfo {
  name: string;
  type: string;
  status: string;
  serverType: string;
  command?: string;
  args?: string[];
  url?: string;
  env?: string[];
  headers?: string[];
}

export default function Tools() {
  const { data: tools, isLoading: toolsLoading } = useApiQuery<ToolsResponse>(
    ['tools'],
    '/api/tools',
  );

  const { data: agents, isLoading: agentsLoading } = useApiQuery<AgentDef[]>(
    ['agents'],
    '/api/agents',
  );

  const { data: skills, isLoading: skillsLoading } = useApiQuery<SkillDef[]>(
    ['agents-skills'],
    '/api/agents/skills',
  );

  const builtinTools = tools?.builtin ?? [];
  const mcpServers = (tools as unknown as { mcpServers: McpServerInfo[] })?.mcpServers ?? [];
  const mcpServerList = Array.isArray(mcpServers) ? mcpServers : [];
  const agentList = agents ?? [];
  const skillList = skills ?? [];

  const builtinCount = builtinTools.length;
  const mcpCount = mcpServerList.length;
  const agentCount = agentList.length;
  const skillCount = skillList.length;

  const isLoading = toolsLoading || agentsLoading || skillsLoading;

  return (
    <>
      <PageHeader title="도구 & 에이전트" />
      <div className="p-6">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : (
          <Tabs defaultValue="builtin">
            <TabsList>
              <TabsTrigger value="builtin">
                내장 도구 ({builtinCount})
              </TabsTrigger>
              <TabsTrigger value="mcp">
                MCP 서버 ({mcpCount})
              </TabsTrigger>
              <TabsTrigger value="agents">
                에이전트 ({agentCount})
              </TabsTrigger>
              <TabsTrigger value="skills">
                스킬 ({skillCount})
              </TabsTrigger>
            </TabsList>

            {/* 내장 도구 */}
            <TabsContent value="builtin" className="mt-4">
              {builtinCount === 0 ? (
                <EmptyState text="내장 도구가 없습니다" />
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {builtinTools.map((tool) => (
                    <Card key={tool.name}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center gap-2">
                          <Wrench className="h-4 w-4 text-amber-500" />
                          <CardTitle className="text-sm">{tool.name}</CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <CardDescription>{tool.description}</CardDescription>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* MCP 서버 */}
            <TabsContent value="mcp" className="mt-4">
              {mcpCount === 0 ? (
                <EmptyState text="MCP 서버가 없습니다" />
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {mcpServerList.map((server) => (
                    <Card key={server.name}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center gap-2">
                          <Server className="h-4 w-4 text-blue-500" />
                          <CardTitle className="text-sm">{server.name}</CardTitle>
                          <Badge variant="secondary" className="text-xs ml-auto">
                            {server.serverType ?? 'stdio'}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {server.command && (
                          <p className="text-xs text-muted-foreground font-mono truncate">
                            {server.command} {server.args?.join(' ')}
                          </p>
                        )}
                        {server.url && (
                          <p className="text-xs text-muted-foreground font-mono truncate">
                            {server.url}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* 에이전트 */}
            <TabsContent value="agents" className="mt-4">
              {agentCount === 0 ? (
                <EmptyState text="에이전트가 없습니다" />
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {agentList.map((agent) => (
                    <Card key={agent.file}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center gap-2">
                          <Bot className="h-4 w-4 text-green-500" />
                          <CardTitle className="text-sm">
                            {agent.name ?? agent.file.replace(/\.md$/, '')}
                          </CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <CardDescription>
                          {agent.description ?? '설명 없음'}
                        </CardDescription>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* 스킬 */}
            <TabsContent value="skills" className="mt-4">
              {skillCount === 0 ? (
                <EmptyState text="스킬이 없습니다" />
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {skillList.map((skill) => (
                    <Card key={skill.name}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-purple-500" />
                          <CardTitle className="text-sm">{skill.name}</CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <CardDescription>
                          {skill.description ?? '설명 없음'}
                        </CardDescription>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex h-40 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
      {text}
    </div>
  );
}
