import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useApiQuery, useApiMutation } from '@/hooks/useApi';
import type { ConfigResponse } from '@/types/api';

const PRESET_PROMPTS: Record<string, string> = {
  intj: '성격: INTJ. 논리적·간결·직접적. 핵심만 체계적으로 정리. 3~5줄, 이모지 없음, 한국어.',
  intp: '성격: INTP. 정밀·분석적. 논리적 근거와 여러 관점 제시. 3~7줄, 이모지 없음, 한국어.',
  entj: '성격: ENTJ. 단호·자신감. 결론과 행동 지침 먼저, 효율 중심. 3~5줄, 이모지 없음, 한국어.',
  entp: '성격: ENTP. 창의적·위트. 새로운 아이디어와 대안 적극 제시. 3~8줄, 이모지 가능, 한국어.',
  infj: '성격: INFJ. 사려깊은 통찰. 공감하면서 본질적 의미 전달, 부드럽고 명확. 3~7줄, 이모지 최소, 한국어.',
  infp: '성격: INFP. 따뜻·공감적. 감정 인정 후 이상적 방향 제시, 격려하는 톤. 3~8줄, 이모지 가능, 한국어.',
  enfj: '성격: ENFJ. 따뜻한 리더십. 격려·영감·칭찬, 팀 조화 강조. 3~8줄, 이모지 적절히, 한국어.',
  enfp: '성격: ENFP. 에너지·열정. 밝고 캐주얼, 창의적 아이디어와 긍정 에너지. 3~8줄, 이모지 자주, 한국어.',
  istj: '성격: ISTJ. 정확·체계적·신뢰. 사실 기반, 핵심만 전달, 기한 명확. 3~5줄, 이모지 없음, 한국어.',
  isfj: '성격: ISFJ. 따뜻·세심. 필요한 것 미리 챙기고 안정감 있는 톤. 3~7줄, 이모지 소량, 한국어.',
  estj: '성격: ESTJ. 결단력·체계. 규칙과 절차 명확, 직설적·당당. 3~5줄, 이모지 없음, 한국어.',
  esfj: '성격: ESFJ. 친근·사교적. 배려와 협력 강조, 실용적 도움 제안. 3~8줄, 이모지 적절히, 한국어.',
  istp: '성격: ISTP. 실용·직접적. 문제 해결 핵심만, 담백하고 꾸밈없는 톤. 2~4줄, 이모지 없음, 한국어.',
  isfp: '성격: ISFP. 부드럽·배려. 공감하면서 실용적 도움, 창의적 접근 제안. 3~6줄, 이모지 소량, 한국어.',
  estp: '성격: ESTP. 직설·에너지. 즉각 실행 가능한 방안, 핵심만 빠르게. 2~5줄, 이모지 없음, 한국어.',
  esfp: '성격: ESFP. 밝고 유쾌. 친근한 톤, 재미있고 실용적 해결책. 3~7줄, 이모지 자주, 한국어.',
};

const PRESET_GROUPS = [
  {
    label: '분석가 (NT)',
    presets: [
      { value: 'intj', label: 'INTJ' },
      { value: 'intp', label: 'INTP' },
      { value: 'entj', label: 'ENTJ' },
      { value: 'entp', label: 'ENTP' },
    ],
  },
  {
    label: '외교관 (NF)',
    presets: [
      { value: 'infj', label: 'INFJ' },
      { value: 'infp', label: 'INFP' },
      { value: 'enfj', label: 'ENFJ' },
      { value: 'enfp', label: 'ENFP' },
    ],
  },
  {
    label: '관리자 (SJ)',
    presets: [
      { value: 'istj', label: 'ISTJ' },
      { value: 'isfj', label: 'ISFJ' },
      { value: 'estj', label: 'ESTJ' },
      { value: 'esfj', label: 'ESFJ' },
    ],
  },
  {
    label: '탐험가 (SP)',
    presets: [
      { value: 'istp', label: 'ISTP' },
      { value: 'isfp', label: 'ISFP' },
      { value: 'estp', label: 'ESTP' },
      { value: 'esfp', label: 'ESFP' },
    ],
  },
  {
    label: '커스텀',
    presets: [{ value: 'custom', label: '커스텀' }],
  },
];

export function PersonalityEditor() {
  const { data: config } = useApiQuery<ConfigResponse>(['config'], '/api/config');
  const mutation = useApiMutation<{ message: string }, Partial<ConfigResponse>>(
    '/api/config',
    'PUT',
  );

  const [selectedPreset, setSelectedPreset] = useState<string>('istj');
  const [promptText, setPromptText] = useState('');
  const [saved, setSaved] = useState(false);

  // config 로드 시 초기값 설정
  useEffect(() => {
    if (!config) return;
    const preset = config.personality.preset || 'istj';
    setSelectedPreset(preset);
    if (preset === 'custom') {
      setPromptText(config.personality.customPrompt ?? '');
    } else {
      setPromptText(PRESET_PROMPTS[preset] ?? '');
    }
  }, [config]);

  const handlePresetChange = (value: string) => {
    setSelectedPreset(value);
    setSaved(false);
    if (value === 'custom') {
      setPromptText(config?.personality.customPrompt ?? '');
    } else {
      setPromptText(PRESET_PROMPTS[value] ?? '');
    }
  };

  const handlePromptChange = (value: string) => {
    setPromptText(value);
    setSaved(false);
  };

  const handleSave = () => {
    // 현재 텍스트가 어떤 프리셋과 정확히 일치하는지 확인
    const matchingPreset = Object.entries(PRESET_PROMPTS).find(
      ([, prompt]) => prompt === promptText,
    );

    if (matchingPreset) {
      // 프리셋과 정확히 일치 -> 해당 프리셋으로 저장
      mutation.mutate(
        { personality: { preset: matchingPreset[0], customPrompt: undefined } as ConfigResponse['personality'] },
        {
          onSuccess: () => {
            setSelectedPreset(matchingPreset[0]);
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
          },
        },
      );
    } else {
      // 프리셋과 불일치 -> custom으로 저장
      mutation.mutate(
        { personality: { preset: 'custom', customPrompt: promptText } as ConfigResponse['personality'] },
        {
          onSuccess: () => {
            setSelectedPreset('custom');
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
          },
        },
      );
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">성격 프리셋</CardTitle>
        <CardDescription>봇의 응답 스타일을 선택하거나 직접 작성하세요</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Select value={selectedPreset} onValueChange={handlePresetChange}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="프리셋 선택" />
          </SelectTrigger>
          <SelectContent>
            {PRESET_GROUPS.map((group) => (
              <SelectGroup key={group.label}>
                <SelectLabel>{group.label}</SelectLabel>
                {group.presets.map((preset) => (
                  <SelectItem key={preset.value} value={preset.value}>
                    {preset.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>

        <Textarea
          value={promptText}
          onChange={(e) => handlePromptChange(e.target.value)}
          rows={4}
          placeholder="성격 프롬프트를 입력하세요..."
          className="resize-none"
        />

        <div className="flex items-center gap-3">
          <Button
            onClick={handleSave}
            disabled={mutation.isPending}
            size="sm"
          >
            {mutation.isPending ? '저장 중...' : '저장'}
          </Button>
          {saved && (
            <span className="text-sm text-green-600 dark:text-green-400">
              저장되었습니다
            </span>
          )}
          {mutation.isError && (
            <span className="text-sm text-destructive">
              저장 실패
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
