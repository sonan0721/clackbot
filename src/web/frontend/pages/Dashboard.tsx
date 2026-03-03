import { PageHeader } from '@/components/layout/PageHeader';
import { StatusCards } from '@/components/dashboard/StatusCards';
import { ActivityTimeline } from '@/components/dashboard/ActivityTimeline';
import { RecentConversations } from '@/components/dashboard/RecentConversations';

export default function Dashboard() {
  return (
    <>
      <PageHeader title="대시보드" />
      <div className="space-y-6 p-6">
        <StatusCards />
        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <ActivityTimeline />
          <RecentConversations />
        </div>
      </div>
    </>
  );
}
