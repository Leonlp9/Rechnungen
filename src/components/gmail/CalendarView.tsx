import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import {
  ChevronLeft, ChevronRight, Plus, CalendarDays, List,
  Clock, MapPin, Trash2, X, Loader2, UserPlus, LogOut, ChevronDown,
  Receipt, ExternalLink, CalendarRange, Calendar, LayoutGrid,
} from 'lucide-react';
import {
  startCalendarOAuthFlow,
  fetchCalendars,
  fetchCalendarEvents,
  createCalendarEvent,
  deleteCalendarEvent,
  getValidCalendarToken,
  fetchCalendarUserEmail,
  type CalendarToken,
  type CalendarEvent,
  type GoogleCalendar,
} from '@/lib/googleCalendar';
import { useCalendarStore, type CalendarAccount } from '@/store/calendarStore';
import { getAllInvoices } from '@/lib/db';
import type { Invoice } from '@/types';
import { CATEGORY_LABELS } from '@/types';
import { toast } from 'sonner';

// â”€â”€ Date helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const MONTHS = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function isToday(d: Date) { return isSameDay(d, new Date()); }

function getMonthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  let dow = first.getDay();
  dow = dow === 0 ? 6 : dow - 1;
  const days: Date[] = [];
  for (let i = -dow; i < 42 - dow; i++) {
    days.push(new Date(year, month, 1 + i));
  }
  return days;
}

function fmt(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function fmtTime(d: Date) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function parseLocalDate(s: string): Date {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}
/** Monday of the week containing d */
function weekStart(d: Date): Date {
  const c = new Date(d);
  const dow = c.getDay() === 0 ? 6 : c.getDay() - 1;
  c.setDate(c.getDate() - dow);
  c.setHours(0, 0, 0, 0);
  return c;
}
function addDays(d: Date, n: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}
function getWeekNumber(d: Date): number {
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dow = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dow);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  return Math.ceil((((tmp.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

// â”€â”€ Invoice colors by type â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const INVOICE_COLORS: Record<string, string> = {
  einnahme: '#22c55e',
  ausgabe: '#ef4444',
  info: '#a855f7',
};

// â”€â”€ Event color â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const COLOR_MAP: Record<string, string> = {
  '1': '#7986cb', '2': '#33b679', '3': '#8e24aa', '4': '#e67c73',
  '5': '#f6c026', '6': '#f5511d', '7': '#039be5', '8': '#616161',
  '9': '#3f51b5', '10': '#0b8043', '11': '#d60000',
};
function eventColor(e: CalendarEvent, cal?: GoogleCalendar): string {
  if (e.colorId) return COLOR_MAP[e.colorId] ?? '#4285f4';
  if (cal?.backgroundColor) return cal.backgroundColor;
  return '#4285f4';
}

// â”€â”€ Unified day entry â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type DayEntry =
  | { kind: 'invoice'; invoice: Invoice; date: Date }
  | { kind: 'gcal'; event: RichEvent };

interface RichEvent extends CalendarEvent {
  _accountEmail: string;
  _calendarId: string;
  _calendar?: GoogleCalendar;
}

function entryDate(e: DayEntry): Date {
  return e.kind === 'invoice' ? e.date : e.event.startDate;
}
function entryColor(e: DayEntry): string {
  if (e.kind === 'invoice') return INVOICE_COLORS[e.invoice.type] ?? '#94a3b8';
  return eventColor(e.event, e.event._calendar);
}
function entryTitle(e: DayEntry): string {
  if (e.kind === 'invoice') {
    const partner = e.invoice.partner ? ` · ${e.invoice.partner}` : '';
    const amount = e.invoice.brutto !== 0
      ? ` ${e.invoice.brutto > 0 ? '+' : ''}${e.invoice.brutto.toFixed(2)} ${e.invoice.currency}`
      : '';
    return (e.invoice.description || 'Rechnung') + partner + amount;
  }
  return e.event.summary || '(kein Titel)';
}

// â”€â”€ Invoice toggle state (localStorage) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const LS_INV_KEY = 'calendar-invoice-show-v1';
const LS_INV_COLLAPSED_KEY = 'calendar-invoice-collapsed-v1';
const LS_ACC_COLLAPSED_KEY = 'calendar-acc-collapsed-v1';
type InvoiceFilter = { einnahme: boolean; ausgabe: boolean; info: boolean };
function loadInvFilter(): InvoiceFilter {
  try { return JSON.parse(localStorage.getItem(LS_INV_KEY) ?? 'null') ?? { einnahme: true, ausgabe: true, info: true }; }
  catch { return { einnahme: true, ausgabe: true, info: true }; }
}
function saveInvFilter(f: InvoiceFilter) { localStorage.setItem(LS_INV_KEY, JSON.stringify(f)); }
function loadInvCollapsed(): boolean {
  try { return JSON.parse(localStorage.getItem(LS_INV_COLLAPSED_KEY) ?? 'false') ?? false; }
  catch { return false; }
}
function loadCollapsedAccounts(): Record<string, boolean> {
  try { return JSON.parse(localStorage.getItem(LS_ACC_COLLAPSED_KEY) ?? 'null') ?? {}; }
  catch { return {}; }
}

// â”€â”€ New event dialog â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function NewEventDialog({ defaultDate, accounts, onSave, onClose }: {
  defaultDate: string;
  accounts: CalendarAccount[];
  onSave: (data: { summary: string; start: string; end: string; calendarId: string; accountEmail: string; allDay: boolean; description?: string; location?: string }) => Promise<void>;
  onClose: () => void;
}) {
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState(defaultDate);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [allDay, setAllDay] = useState(false);
  const [accountEmail, setAccountEmail] = useState(accounts[0]?.email ?? '');
  const [calId, setCalId] = useState('');
  const [saving, setSaving] = useState(false);

  const activeAccount = accounts.find((a) => a.email === accountEmail);

  useEffect(() => {
    if (activeAccount) {
      const primary = activeAccount.calendars.find((c) => c.primary) ?? activeAccount.calendars[0];
      setCalId(primary?.id ?? 'primary');
    }
  }, [accountEmail]);

  const handleSave = async () => {
    if (!summary.trim()) { toast.error('Bitte einen Titel eingeben'); return; }
    setSaving(true);
    try {
      const start = allDay ? date : `${date}T${startTime}:00`;
      const end = allDay ? date : `${date}T${endTime}:00`;
      await onSave({ summary, description, location, start, end, calendarId: calId, accountEmail, allDay });
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? 'Fehler beim Erstellen');
    } finally { setSaving(false); }
  };

  if (accounts.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
        <div className="bg-background border border-border rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4 text-center space-y-3" onClick={(e) => e.stopPropagation()}>
          <h2 className="text-base font-semibold">Kein Google-Konto verbunden</h2>
          <p className="text-sm text-muted-foreground">Verbinde zuerst ein Google-Konto, um Termine zu erstellen.</p>
          <Button variant="outline" size="sm" onClick={onClose}>Schließen</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-background border border-border rounded-xl shadow-2xl p-6 w-full max-w-md mx-4 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Neuer Termin</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <input autoFocus className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" placeholder="Titel" value={summary} onChange={(e) => setSummary(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSave()} />
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} className="rounded" />
          Ganztägig
        </label>
        <input type="date" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" value={date} onChange={(e) => setDate(e.target.value)} />
        {!allDay && (
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1 block">Beginn</label>
              <input type="time" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1 block">Ende</label>
              <input type="time" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>
        )}
        <input className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" placeholder="Ort (optional)" value={location} onChange={(e) => setLocation(e.target.value)} />
        <textarea className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none" placeholder="Beschreibung (optional)" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        {accounts.length > 1 && (
          <select className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" value={accountEmail} onChange={(e) => setAccountEmail(e.target.value)}>
            {accounts.map((a) => <option key={a.email} value={a.email}>{a.email}</option>)}
          </select>
        )}
        {activeAccount && activeAccount.calendars.length > 1 && (
          <select className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" value={calId} onChange={(e) => setCalId(e.target.value)}>
            {activeAccount.calendars.map((c) => <option key={c.id} value={c.id}>{c.summary}</option>)}
          </select>
        )}
        <div className="flex gap-2 justify-end pt-1">
          <Button variant="outline" size="sm" onClick={onClose}>Abbrechen</Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
            Speichern
          </Button>
        </div>
      </div>
    </div>
  );
}

// â”€â”€ Detail panels â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function InvoiceDetail({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const navigate = useNavigate();
  const color = INVOICE_COLORS[invoice.type] ?? '#94a3b8';
  const typeLabel = invoice.type === 'einnahme' ? 'Einnahme' : invoice.type === 'ausgabe' ? 'Ausgabe' : 'Info';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-background border border-border rounded-xl shadow-2xl p-6 w-full max-w-md mx-4 space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-full shrink-0 mt-0.5" style={{ backgroundColor: color }} />
            <h2 className="text-base font-semibold leading-tight">{invoice.description || 'Rechnung'}</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground shrink-0"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-3.5 w-3.5 shrink-0" />
          <span>{new Date(invoice.date + 'T00:00:00').toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
        </div>
        {invoice.partner && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Receipt className="h-3.5 w-3.5 shrink-0" />
            <span>{invoice.partner}</span>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2 text-sm rounded-lg border border-border p-3">
          <div><p className="text-xs text-muted-foreground">Typ</p><p className="font-medium" style={{ color }}>{typeLabel}</p></div>
          <div><p className="text-xs text-muted-foreground">Brutto</p><p className="font-medium">{invoice.brutto.toFixed(2)} {invoice.currency}</p></div>
          <div><p className="text-xs text-muted-foreground">Netto</p><p className="font-medium">{invoice.netto.toFixed(2)} {invoice.currency}</p></div>
          <div><p className="text-xs text-muted-foreground">Kategorie</p><p className="font-medium text-xs">{CATEGORY_LABELS[invoice.category] ?? invoice.category}</p></div>
        </div>
        {invoice.note && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{invoice.note}</p>}
        <div className="flex justify-end pt-1">
          <Button size="sm" className="gap-1.5" onClick={() => { onClose(); navigate(`/invoices/${invoice.id}`); }}>
            <ExternalLink className="h-3.5 w-3.5" />
            Rechnung öffnen
          </Button>
        </div>
      </div>
    </div>
  );
}

function GCalDetail({ event, onDelete, onClose }: { event: RichEvent; onDelete: () => void; onClose: () => void }) {
  const color = eventColor(event, event._calendar);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-background border border-border rounded-xl shadow-2xl p-6 w-full max-w-md mx-4 space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-full shrink-0 mt-0.5" style={{ backgroundColor: color }} />
            <h2 className="text-base font-semibold leading-tight">{event.summary || '(kein Titel)'}</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground shrink-0"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-3.5 w-3.5 shrink-0" />
          {event.allDay
            ? <span>{event.startDate.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · Ganztägig</span>
            : <span>{event.startDate.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}, {fmtTime(event.startDate)} – {fmtTime(event.endDate)} Uhr</span>
          }
        </div>
        {event.location && <div className="flex items-center gap-2 text-sm text-muted-foreground"><MapPin className="h-3.5 w-3.5 shrink-0" /><span>{event.location}</span></div>}
        {event.description && <p className="text-sm text-foreground/80 whitespace-pre-wrap">{event.description}</p>}
        <div className="text-xs text-muted-foreground space-y-0.5">
          {event._calendar && <p>Kalender: {event._calendar.summary}</p>}
          <p>Konto: {event._accountEmail}</p>
        </div>
        <div className="flex justify-end pt-1">
          <Button variant="destructive" size="sm" className="gap-1.5" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" />Löschen
          </Button>
        </div>
      </div>
    </div>
  );
}

// â”€â”€ Main CalendarView â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function CalendarView() {
  const accounts = useCalendarStore((s) => s.accounts);
  const addOrUpdateAccount = useCalendarStore((s) => s.addOrUpdateAccount);
  const removeAccount = useCalendarStore((s) => s.removeAccount);
  const updateToken = useCalendarStore((s) => s.updateToken);
  const updateCalendars = useCalendarStore((s) => s.updateCalendars);
  const toggleCalendar = useCalendarStore((s) => s.toggleCalendar);

  const [signing, setSigning] = useState(false);
  const [gcalEvents, setGcalEvents] = useState<RichEvent[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invFilter, setInvFilter] = useState<InvoiceFilter>(loadInvFilter);
  const [invCollapsed, setInvCollapsed] = useState(loadInvCollapsed);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<'year' | 'month' | 'week' | 'day' | 'list'>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [newEventDate, setNewEventDate] = useState<string | null>(null);
  const [detailEntry, setDetailEntry] = useState<DayEntry | null>(null);
  const [collapsedAccounts, setCollapsedAccounts] = useState<Record<string, boolean>>(loadCollapsedAccounts);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [datePickerMonth, setDatePickerMonth] = useState(() => new Date());

  const makeTokenUpdater = (email: string) => (t: CalendarToken) => updateToken(email, t);

  // Load invoices once
  useEffect(() => {
    getAllInvoices().then(setInvoices).catch(() => {});
  }, []);

  // Load calendars for all google accounts
  useEffect(() => {
    accounts.forEach(async (acc) => {
      try {
        const at = await getValidCalendarToken(acc.token, makeTokenUpdater(acc.email));
        const cals = await fetchCalendars(at);
        updateCalendars(acc.email, cals);
      } catch {}
    });
  }, [accounts.map((a) => a.email).join(',')]);

  const loadGcalEvents = useCallback(async () => {
    if (accounts.length === 0) { setGcalEvents([]); return; }
    setLoading(true);
    try {
      // Fetch a wide range: the full year so week/day/year views always have data
      const y = currentDate.getFullYear();
      const timeMin = new Date(y, 0, 1);
      const timeMax = new Date(y + 1, 0, 1);
      const allRich: RichEvent[] = [];
      await Promise.all(accounts.map(async (acc) => {
        const calMap = Object.fromEntries(acc.calendars.map((c) => [c.id, c]));
        const at = await getValidCalendarToken(acc.token, makeTokenUpdater(acc.email));
        const perCal = await Promise.all(
          acc.selectedCalendarIds.map((calId) =>
            fetchCalendarEvents(at, calId, timeMin, timeMax).then((evts) =>
              evts.map((e): RichEvent => ({ ...e, _accountEmail: acc.email, _calendarId: calId, _calendar: calMap[calId] }))
            )
          )
        );
        allRich.push(...perCal.flat());
      }));
      allRich.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
      setGcalEvents(allRich);
    } catch { toast.error('Google-Termine konnten nicht geladen werden'); }
    finally { setLoading(false); }
  }, [accounts, currentDate.getFullYear()]);

  useEffect(() => { loadGcalEvents(); }, [loadGcalEvents]);

  // Build visible entries for current month
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();


  // For year view: all invoices of the year (no month filter)
  const yearInvoiceEntries: DayEntry[] = invoices
    .filter((inv) => {
      const d = parseLocalDate(inv.date);
      return d.getFullYear() === year && invFilter[inv.type as keyof InvoiceFilter];
    })
    .map((inv) => ({ kind: 'invoice' as const, invoice: inv, date: parseLocalDate(inv.date) }));

  // Use all invoices (not just current month) so adjacent-month days in the month grid also show entries
  const allInvoiceEntries: DayEntry[] = invoices
    .filter((inv) => invFilter[inv.type as keyof InvoiceFilter])
    .map((inv) => ({ kind: 'invoice' as const, invoice: inv, date: parseLocalDate(inv.date) }));

  const allEntries: DayEntry[] = [
    ...allInvoiceEntries,
    ...gcalEvents.map((e): DayEntry => ({ kind: 'gcal', event: e })),
  ].sort((a, b) => entryDate(a).getTime() - entryDate(b).getTime());

  const allYearEntries: DayEntry[] = [
    ...yearInvoiceEntries,
    ...gcalEvents.map((e): DayEntry => ({ kind: 'gcal', event: e })),
  ];

  const entriesOnDay = (d: Date) => allEntries.filter((e) => {
    if (e.kind === 'invoice') return isSameDay(e.date, d);
    return isSameDay(e.event.startDate, d) || (e.event.allDay && e.event.startDate <= d && e.event.endDate > d);
  });

  const handleAddAccount = async () => {
    setSigning(true);
    try {
      const token = await startCalendarOAuthFlow();
      const at = token.access_token;
      const email = await fetchCalendarUserEmail(at);
      const cals = await fetchCalendars(at);
      const selectedCalendarIds = cals.filter((c) => c.selected !== false).map((c) => c.id);
      addOrUpdateAccount({ email, token, calendars: cals, selectedCalendarIds });
      toast.success(`${email} verbunden`);
    } catch (e: any) {
      toast.error('Anmeldung fehlgeschlagen: ' + (e?.message ?? e));
    } finally { setSigning(false); }
  };

  const handleCreateEvent = async (data: { summary: string; start: string; end: string; calendarId: string; accountEmail: string; allDay: boolean; description?: string; location?: string }) => {
    const acc = accounts.find((a) => a.email === data.accountEmail);
    if (!acc) return;
    const at = await getValidCalendarToken(acc.token, makeTokenUpdater(acc.email));
    await createCalendarEvent(at, data.calendarId, data);
    toast.success('Termin erstellt!');
    await loadGcalEvents();
  };

  const handleDeleteGcal = async (event: RichEvent) => {
    const acc = accounts.find((a) => a.email === event._accountEmail);
    if (!acc) return;
    try {
      const at = await getValidCalendarToken(acc.token, makeTokenUpdater(acc.email));
      await deleteCalendarEvent(at, event._calendarId, event.id);
      toast.success('Termin gelÃ¶scht');
      setDetailEntry(null);
      await loadGcalEvents();
    } catch (e: any) { toast.error(e?.message ?? 'LÃ¶schen fehlgeschlagen'); }
  };

  const toggleInvFilter = (key: keyof InvoiceFilter) => {
    setInvFilter((prev) => { const next = { ...prev, [key]: !prev[key] }; saveInvFilter(next); return next; });
  };

  const grid = getMonthGrid(year, month);

  // â”€â”€ Time-grid shared helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Scroll to 7:00 on mount / view change
    if ((view === 'week' || view === 'day') && scrollRef.current) {
      scrollRef.current.scrollTop = 7 * 56;
    }
  }, [view]);

  const HOURS = Array.from({ length: 24 }, (_, i) => i);

  function renderTimeGrid(days: Date[]) {
    const allDayEntries = days.map((d) =>
      allEntries.filter((e) => {
        if (e.kind === 'invoice') return isSameDay(e.date, d);
        return e.event.allDay && (isSameDay(e.event.startDate, d) || (e.event.startDate <= d && e.event.endDate > d));
      })
    );
    const timedEntries = days.map((d) =>
      allEntries.filter((e) => {
        if (e.kind === 'invoice') return false;
        return !e.event.allDay && isSameDay(e.event.startDate, d);
      })
    );

    // Build spanning all-day event rows (deduplicated, multi-day events span columns)
    type SpanEvent = { entry: DayEntry; startCol: number; spanCols: number; row: number };
    const spanEvents: SpanEvent[] = [];
    const seenIds = new Set<string>();
    days.forEach((_d, di) => {
      allDayEntries[di].forEach((entry) => {
        const id = entry.kind === 'gcal' ? entry.event.id : `inv-${entry.invoice.id ?? di}`;
        if (seenIds.has(id)) return;
        seenIds.add(id);
        let span = 1;
        if (entry.kind === 'gcal' && entry.event.allDay) {
          for (let j = di + 1; j < days.length; j++) {
            const hasInNext = allDayEntries[j].some((e) => (e.kind === 'gcal' ? e.event.id : '') === id);
            if (hasInNext) span++;
            else break;
          }
        }
        // Find a free row (no overlap with already placed events)
        let row = 0;
        while (spanEvents.some((se) => se.row === row && se.startCol < di + span && se.startCol + se.spanCols > di)) row++;
        spanEvents.push({ entry, startCol: di, spanCols: span, row });
      });
    });
    const maxRow = spanEvents.length > 0 ? Math.max(...spanEvents.map((s) => s.row)) + 1 : 0;
    const allDayRowHeight = maxRow > 0 ? Math.max(maxRow * 22 + 6, 28) : 0;

    return (
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Header row + all-day row share a scrollbar-aware wrapper */}
        <div className="shrink-0 overflow-hidden" style={{ overflowY: 'scroll', maxHeight: 0, visibility: 'hidden' }} aria-hidden />
        {/* Header row */}
        <div className="grid border-b border-border shrink-0" style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)`, scrollbarGutter: 'stable' }}>
          <div className="border-r border-border" />
          {days.map((d, i) => (
            <div key={i} className={cn('py-2 text-center border-r border-border last:border-r-0', isToday(d) && 'bg-primary/5')}>
              <p className="text-xs text-muted-foreground">{WEEKDAYS[(d.getDay() + 6) % 7]}</p>
              <button
                onClick={() => { setCurrentDate(d); setView('day'); }}
                className={cn('text-lg font-semibold w-9 h-9 mx-auto flex items-center justify-center rounded-full transition-colors hover:bg-muted', isToday(d) && 'bg-primary text-primary-foreground hover:bg-primary')}
              >
                {d.getDate()}
              </button>
            </div>
          ))}
        </div>
        {/* All-day row with proper column spanning */}
        {maxRow > 0 && (
          <div className="border-b border-border shrink-0 relative" style={{ height: allDayRowHeight, scrollbarGutter: 'stable' }}>
            {/* Column borders */}
            <div className="absolute inset-0 grid pointer-events-none" style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)` }}>
              <div className="border-r border-border px-1 flex items-start justify-end pt-1 pointer-events-none">
                <span className="text-[10px] text-muted-foreground">Ganztg.</span>
              </div>
              {days.map((_, i) => (
                <div key={i} className="border-r border-border last:border-r-0" />
              ))}
            </div>
            {/* Spanning event chips */}
            <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)`, gridTemplateRows: `repeat(${maxRow}, 22px)`, paddingTop: 2, paddingRight: 2, gap: '2px 0' }}>
              {spanEvents.map(({ entry, startCol, spanCols, row }, idx) => {
                const color = entryColor(entry);
                return (
                  <button
                    key={idx}
                    onClick={() => setDetailEntry(entry)}
                    className="rounded px-1.5 text-[10px] text-left truncate font-medium h-[20px] self-start"
                    style={{
                      gridColumn: `${startCol + 2} / span ${spanCols}`,
                      gridRow: row + 1,
                      backgroundColor: color + '30',
                      color,
                      marginLeft: 2,
                      marginRight: 2,
                    }}
                    title={entryTitle(entry)}
                  >
                    {entryTitle(entry)}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {/* Timed grid */}
        <div className="flex-1 overflow-y-auto" ref={scrollRef} style={{ scrollbarGutter: 'stable' }}>
          <div className="relative" style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)` }}>
            {/* Hour lines */}
            {HOURS.map((h) => (
              <div key={h} className="flex" style={{ height: 56 }}>
                <div className="w-14 shrink-0 border-r border-border flex items-start justify-end pr-2 pt-0.5">
                  <span className="text-[10px] text-muted-foreground tabular-nums">{String(h).padStart(2, '0')}:00</span>
                </div>
                {days.map((_, di) => (
                  <div key={di} className="flex-1 border-r border-border last:border-r-0 border-b border-dashed border-border/50" />
                ))}
              </div>
            ))}
            {/* Events overlay â€“ per day column */}
            {days.map((_d, di) => (
              <div
                key={di}
                className="absolute top-0 bottom-0 pointer-events-none"
                style={{ left: `calc(56px + ${di} * ((100% - 56px) / ${days.length}))`, width: `calc((100% - 56px) / ${days.length})` }}
              >
                {timedEntries[di].map((entry, ei) => {
                  if (entry.kind !== 'gcal') return null;
                  const e = entry.event;
                  const startMins = e.startDate.getHours() * 60 + e.startDate.getMinutes();
                  const endMins = Math.max(e.endDate.getHours() * 60 + e.endDate.getMinutes(), startMins + 30);
                  const top = (startMins / 60) * 56;
                  const height = Math.max(((endMins - startMins) / 60) * 56, 20);
                  const color = entryColor(entry);
                  return (
                    <button
                      key={ei}
                      onClick={() => setDetailEntry(entry)}
                      className="absolute left-0.5 right-0.5 rounded pointer-events-auto px-1 py-0.5 text-[10px] text-left overflow-hidden"
                      style={{ top, height, backgroundColor: color + '30', color, border: `1px solid ${color}60` }}
                      title={e.summary}
                    >
                      <p className="font-semibold truncate leading-tight">{e.summary}</p>
                      <p className="truncate opacity-80">{fmtTime(e.startDate)} â€“ {fmtTime(e.endDate)}</p>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // â”€â”€ Year view â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const yearView = (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 12 }, (_, mi) => {
          const miniGrid = getMonthGrid(year, mi);
          return (
            <div key={mi} className="rounded-lg border border-border p-3 hover:bg-muted/20 transition-colors">
              <button
                onClick={() => { setCurrentDate(new Date(year, mi, 1)); setView('month'); }}
                className="text-sm font-semibold mb-2 hover:text-primary transition-colors block w-full text-left"
              >
                {MONTHS[mi]}
              </button>
              <div className="grid grid-cols-7 gap-px text-[9px] text-muted-foreground text-center mb-1">
                {WEEKDAYS.map((d) => <span key={d}>{d[0]}</span>)}
              </div>
              <div className="grid grid-cols-7 gap-px">
                {miniGrid.slice(0, 35).map((d, i) => {
                  const hasEntries = allYearEntries.some((e) => isSameDay(entryDate(e), d));
                  const inM = d.getMonth() === mi;
                  return (
                    <button
                      key={i}
                      onClick={() => { setCurrentDate(d); setView('day'); }}
                      className={cn(
                        'aspect-square flex flex-col items-center justify-center rounded text-[9px] relative hover:bg-muted transition-colors',
                        !inM && 'text-muted-foreground/30',
                        isToday(d) && 'bg-primary text-primary-foreground hover:bg-primary font-bold',
                      )}
                    >
                      {d.getDate()}
                      {hasEntries && inM && !isToday(d) && (
                        <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary/70" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // â”€â”€ Month grid â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const monthView = (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="grid grid-cols-7 border-b border-border shrink-0">
        {WEEKDAYS.map((d) => <div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 grid-rows-6 flex-1 overflow-hidden">
        {grid.map((d, i) => {
          const dayEntries = entriesOnDay(d);
          const inMonth = d.getMonth() === month;
          return (
            <div key={i} className={cn('border-b border-r border-border p-1 overflow-hidden flex flex-col gap-0.5 cursor-pointer hover:bg-muted/30 transition-colors', !inMonth && 'bg-muted/10')} onClick={() => setNewEventDate(fmt(d))}>
              <button
                onClick={(e) => { e.stopPropagation(); setCurrentDate(d); setView('day'); }}
                className={cn('text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full shrink-0 self-start hover:bg-primary hover:text-primary-foreground transition-colors', isToday(d) ? 'bg-primary text-primary-foreground' : !inMonth ? 'text-muted-foreground/50' : 'text-foreground')}
              >
                {d.getDate()}
              </button>
              {dayEntries.slice(0, 3).map((entry, ei) => {
                const color = entryColor(entry);
                const title = entryTitle(entry);
                const timeStr = entry.kind === 'gcal' && !entry.event.allDay ? fmtTime(entry.event.startDate) : null;
                return (
                  <button key={ei} onClick={(ev) => { ev.stopPropagation(); setDetailEntry(entry); }} className="flex items-center gap-1 rounded px-1 py-0.5 text-[10px] text-left w-full overflow-hidden" style={{ backgroundColor: color + '25', color }} title={title}>
                    {timeStr && <span className="shrink-0 font-medium">{timeStr}</span>}
                    <span className="truncate font-medium">{title}</span>
                  </button>
                );
              })}
              {dayEntries.length > 3 && <span className="text-[10px] text-muted-foreground px-1">+{dayEntries.length - 3} weitere</span>}
            </div>
          );
        })}
      </div>
    </div>
  );

  // â”€â”€ Week view â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const ws = weekStart(currentDate);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  const weekView = renderTimeGrid(weekDays);

  // â”€â”€ Day view â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const dayView = renderTimeGrid([currentDate]);

  // â”€â”€ List view â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // For list view, show the full year
  const listEntries = [...invoices]
    .filter((inv) => {
      const d = parseLocalDate(inv.date);
      return d.getFullYear() === year && invFilter[inv.type as keyof InvoiceFilter];
    })
    .map((inv): DayEntry => ({ kind: 'invoice', invoice: inv, date: parseLocalDate(inv.date) }));
  const listGcal = gcalEvents.map((e): DayEntry => ({ kind: 'gcal', event: e }));
  const listAllEntries = [...listEntries, ...listGcal].sort((a, b) => entryDate(a).getTime() - entryDate(b).getTime());

  const listView = (
    <div className="flex-1 overflow-y-auto">
      {listAllEntries.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground">
          <CalendarDays className="h-8 w-8 opacity-40" />
          <p className="text-sm">Keine Einträge in diesem Jahr</p>
        </div>
      )}
      <div className="divide-y divide-border">
        {listAllEntries.map((entry, idx) => {
          const color = entryColor(entry);
          const title = entryTitle(entry);
          const date = entryDate(entry);
          const sub = entry.kind === 'invoice'
            ? `${entry.invoice.type === 'einnahme' ? 'Einnahme' : entry.invoice.type === 'ausgabe' ? 'Ausgabe' : 'Info'} · ${CATEGORY_LABELS[entry.invoice.category] ?? entry.invoice.category}`
            : entry.event.allDay ? 'Ganztägig' : `${fmtTime(entry.event.startDate)} – ${fmtTime(entry.event.endDate)} Uhr`;
          return (
            <button key={idx} onClick={() => setDetailEntry(entry)} className="w-full flex items-start gap-3 px-4 py-3 hover:bg-muted/40 transition-colors text-left">
              <span className="rounded-full shrink-0 self-stretch mt-0.5" style={{ backgroundColor: color, minWidth: '3px', width: '3px' }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {date.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                  {sub ? ` · ${sub}` : ''}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  // â”€â”€ Toolbar title â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const toolbarTitle = (() => {
    if (view === 'year') return `${year}`;
    if (view === 'month') return `${MONTHS[month]} ${year}`;
    if (view === 'day') return currentDate.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    if (view === 'week') {
      const wn = getWeekNumber(ws);
      const end = addDays(ws, 6);
      return `KW ${wn} · ${ws.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    }
    return `${year}`;
  })();

  const navigate_prev = () => {
    if (view === 'year') setCurrentDate(new Date(year - 1, month, 1));
    else if (view === 'month') setCurrentDate(new Date(year, month - 1, 1));
    else if (view === 'week') setCurrentDate(addDays(currentDate, -7));
    else if (view === 'day') setCurrentDate(addDays(currentDate, -1));
    else setCurrentDate(new Date(year - 1, month, 1));
  };
  const navigate_next = () => {
    if (view === 'year') setCurrentDate(new Date(year + 1, month, 1));
    else if (view === 'month') setCurrentDate(new Date(year, month + 1, 1));
    else if (view === 'week') setCurrentDate(addDays(currentDate, 7));
    else if (view === 'day') setCurrentDate(addDays(currentDate, 1));
    else setCurrentDate(new Date(year + 1, month, 1));
  };

  const VIEW_BUTTONS = [
    { key: 'year' as const,  label: 'Jahr',  icon: LayoutGrid },
    { key: 'month' as const, label: 'Monat', icon: CalendarDays },
    { key: 'week' as const,  label: 'Woche', icon: CalendarRange },
    { key: 'day' as const,   label: 'Tag',   icon: Calendar },
    { key: 'list' as const,  label: 'Liste', icon: List },
  ];

  const currentView = {
    year: yearView,
    month: monthView,
    week: weekView,
    day: dayView,
    list: listView,
  }[view];

  // ── Sidebar ──────────────────────────────────────────────────────────────
  const sidebar = (
    <aside className="w-56 shrink-0 flex flex-col border-r border-border bg-muted/20 overflow-y-auto py-3 px-3 gap-3">
      <div className="flex gap-1.5">
        <Button size="sm" className="gap-1.5 flex-1 text-xs" onClick={() => setNewEventDate(fmt(new Date()))}>
          <Plus className="h-3.5 w-3.5" />Neuer Termin
        </Button>
        <Button size="sm" variant="outline" className="shrink-0 px-2" title="Google-Konto hinzufügen" onClick={handleAddAccount} disabled={signing}>
          {signing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
        </Button>
      </div>

      {/* Rechnungen layer */}
      <div>
        <div className="flex items-center gap-1">
          <button onClick={() => setInvCollapsed((v) => { const next = !v; localStorage.setItem(LS_INV_COLLAPSED_KEY, JSON.stringify(next)); return next; })} className="flex items-center gap-1.5 flex-1 min-w-0 px-1 py-0.5 rounded hover:bg-muted/60 text-left">
            <ChevronDown className={cn('h-3 w-3 shrink-0 text-muted-foreground transition-transform', invCollapsed && '-rotate-90')} />
            <Receipt className="h-3 w-3 shrink-0 text-muted-foreground" />
            <span className="text-[11px] font-medium text-foreground truncate">Rechnungen</span>
          </button>
        </div>
        {!invCollapsed && (['einnahme', 'ausgabe', 'info'] as const).map((t) => (
          <button key={t} onClick={() => toggleInvFilter(t)} className="flex items-center gap-2 w-full pl-5 pr-1 py-1 rounded hover:bg-muted/60 text-left text-xs">
            <span className="w-3 h-3 rounded-sm shrink-0 border-2" style={invFilter[t] ? { backgroundColor: INVOICE_COLORS[t], borderColor: INVOICE_COLORS[t] } : { borderColor: INVOICE_COLORS[t], backgroundColor: 'transparent' }} />
            <span className="truncate">{t === 'einnahme' ? 'Einnahmen' : t === 'ausgabe' ? 'Ausgaben' : 'Info'}</span>
          </button>
        ))}
      </div>

      {/* Google Kalender accounts */}
      {accounts.length > 0 && (
        <div className="space-y-2">
          {accounts.map((acc) => {
            const collapsed = collapsedAccounts[acc.email] ?? false;
            return (
              <div key={acc.email}>
                <div className="flex items-center gap-1 group">
                  <button onClick={() => setCollapsedAccounts((prev) => { const next = { ...prev, [acc.email]: !collapsed }; localStorage.setItem(LS_ACC_COLLAPSED_KEY, JSON.stringify(next)); return next; })} className="flex items-center gap-1.5 flex-1 min-w-0 px-1 py-0.5 rounded hover:bg-muted/60 text-left">
                    <ChevronDown className={cn('h-3 w-3 shrink-0 text-muted-foreground transition-transform', collapsed && '-rotate-90')} />
                    <span className="text-[11px] font-medium text-foreground truncate">{acc.email}</span>
                  </button>
                  <button onClick={() => { removeAccount(acc.email); toast.info(`${acc.email} getrennt`); }} title="Konto trennen" className="shrink-0 p-0.5 rounded text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive transition-all">
                    <LogOut className="h-3 w-3" />
                  </button>
                </div>
                {!collapsed && acc.calendars.map((cal) => (
                  <button key={cal.id} onClick={() => toggleCalendar(acc.email, cal.id)} className="flex items-center gap-2 w-full pl-5 pr-1 py-1 rounded hover:bg-muted/60 text-left text-xs">
                    <span className="w-3 h-3 rounded-sm shrink-0 border-2" style={acc.selectedCalendarIds.includes(cal.id) ? { backgroundColor: cal.backgroundColor ?? '#4285f4', borderColor: cal.backgroundColor ?? '#4285f4' } : { borderColor: cal.backgroundColor ?? '#4285f4', backgroundColor: 'transparent' }} />
                    <span className="truncate">{cal.summary}</span>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {accounts.length === 0 && (
        <p className="text-[10px] text-muted-foreground px-1">Kein Google-Konto verbunden. Klicke oben auf <UserPlus className="h-3 w-3 inline" />, um einen Kalender zu verknüpfen.</p>
      )}
    </aside>
  );

  return (
    <div className="flex flex-1 overflow-hidden">
      {sidebar}
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-4 py-2 shrink-0 gap-2">
          <div className="flex items-center gap-2">
            <button onClick={navigate_prev} className="p-1.5 rounded hover:bg-muted text-muted-foreground"><ChevronLeft className="h-4 w-4" /></button>
            <button onClick={navigate_next} className="p-1.5 rounded hover:bg-muted text-muted-foreground"><ChevronRight className="h-4 w-4" /></button>
            <Popover open={datePickerOpen} onOpenChange={(o) => { setDatePickerOpen(o); if (o) setDatePickerMonth(new Date(currentDate)); }}>
              <PopoverTrigger asChild>
                <button className="text-base font-semibold ml-1 min-w-0 truncate max-w-xs hover:text-primary transition-colors cursor-pointer" title="Datum wählen">
                  {toolbarTitle}
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-auto p-3">
                {/* Year + Month selector */}
                <div className="flex items-center justify-between mb-2 gap-2">
                  <button onClick={() => setDatePickerMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))} className="p-1 rounded hover:bg-muted text-muted-foreground">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <div className="flex items-center gap-1">
                    <select
                      className="text-sm font-semibold bg-transparent border-0 focus:outline-none cursor-pointer hover:text-primary"
                      value={datePickerMonth.getMonth()}
                      onChange={(e) => setDatePickerMonth(new Date(datePickerMonth.getFullYear(), +e.target.value, 1))}
                    >
                      {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
                    </select>
                    <select
                      className="text-sm font-semibold bg-transparent border-0 focus:outline-none cursor-pointer hover:text-primary"
                      value={datePickerMonth.getFullYear()}
                      onChange={(e) => setDatePickerMonth(new Date(+e.target.value, datePickerMonth.getMonth(), 1))}
                    >
                      {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 3 + i).map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                  <button onClick={() => setDatePickerMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))} className="p-1 rounded hover:bg-muted text-muted-foreground">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
                {/* Weekday header */}
                <div className="grid grid-cols-7 gap-0.5 mb-1">
                  {WEEKDAYS.map((d) => (
                    <span key={d} className="text-[10px] text-muted-foreground text-center py-0.5 font-medium">{d}</span>
                  ))}
                </div>
                {/* Day grid */}
                <div className="grid grid-cols-7 gap-0.5">
                  {getMonthGrid(datePickerMonth.getFullYear(), datePickerMonth.getMonth()).slice(0, 35).map((d, i) => {
                    const inMonth = d.getMonth() === datePickerMonth.getMonth();
                    const selected = isSameDay(d, currentDate);
                    return (
                      <button
                        key={i}
                        onClick={() => {
                          setCurrentDate(new Date(d));
                          setDatePickerOpen(false);
                        }}
                        className={cn(
                          'aspect-square w-8 h-8 flex items-center justify-center rounded-full text-xs transition-colors hover:bg-muted',
                          !inMonth && 'text-muted-foreground/40',
                          isToday(d) && !selected && 'border border-primary text-primary font-semibold',
                          selected && 'bg-primary text-primary-foreground font-semibold hover:bg-primary',
                        )}
                      >
                        {d.getDate()}
                      </button>
                    );
                  })}
                </div>
                {/* Quick nav to today */}
                <div className="mt-2 pt-2 border-t border-border flex justify-center">
                  <button
                    onClick={() => { setCurrentDate(new Date()); setDatePickerOpen(false); }}
                    className="text-xs text-primary hover:underline"
                  >
                    Heute
                  </button>
                </div>
              </PopoverContent>
            </Popover>
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground ml-1 shrink-0" />}
          </div>
          <div className="flex items-center bg-muted rounded-lg p-0.5 shrink-0">
            {VIEW_BUTTONS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setView(key)}
                className={cn('flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors', view === key ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
              >
                <Icon className="h-3 w-3" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
        </div>
        {currentView}
      </div>

      {newEventDate && <NewEventDialog defaultDate={newEventDate} accounts={accounts} onSave={handleCreateEvent} onClose={() => setNewEventDate(null)} />}
      {detailEntry && detailEntry.kind === 'invoice' && (
        <InvoiceDetail invoice={detailEntry.invoice} onClose={() => setDetailEntry(null)} />
      )}
      {detailEntry && detailEntry.kind === 'gcal' && (
        <GCalDetail event={detailEntry.event} onDelete={() => handleDeleteGcal(detailEntry.event)} onClose={() => setDetailEntry(null)} />
      )}
    </div>
  );
}
