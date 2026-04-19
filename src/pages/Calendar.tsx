import { CalendarView } from '@/components/gmail/CalendarView';

export default function CalendarPage() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center border-b border-border px-4 py-2.5 shrink-0">
        <h1 className="text-base font-semibold">Kalender</h1>
      </div>
      <CalendarView />
    </div>
  );
}

