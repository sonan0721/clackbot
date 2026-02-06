// 프로젝트 타입 정의

export interface ProjectInfo {
  id: string;
  directory: string;
  slackChannels: string[];
  isDefault: boolean;
}
