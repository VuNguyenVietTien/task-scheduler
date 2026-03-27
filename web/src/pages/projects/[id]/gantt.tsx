import { Timeline } from '@/components/timeline/Timeline';
import { useRouter } from 'next/router';

export default function GanttPage() {
  const router = useRouter();
  const { id: projectId } = router.query;
  
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Lịch trình dự án</h1>
      {/* Render Timeline component - dữ liệu sẽ được lấy từ Redux store */}
      <Timeline onTaskClick={(taskId) => router.push(`/tasks/${taskId}`)} />
    </div>
  );
} 