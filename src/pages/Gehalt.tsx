// Gehalt – die Seite für Angestellte.
//
// Für ein Gehalt gibt es keine Rechnung, die man abheften könnte: Es kommt
// jeden Monat von selbst. Deshalb steht hier keine Belegliste, sondern eine
// Treppe: „ab Januar 2025 so viel, ab Juli 2026 so viel". Eine Erhöhung legt
// eine neue Stufe an, statt die alte zu ändern – sonst stimmten vergangene
// Monate nicht mehr.
//
// Einmalzahlungen (13. Gehalt, Bonus, Urlaubsgeld, Nachzahlung) stehen
// daneben, weil sie sich nicht wiederholen.

import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Wallet, Gift } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { ListGroup, ListRow } from '@/components/ui/list-group';
import { FormGroup, FormRow, FIELD, FIELD_DATE } from '@/components/ui/form-list';
import { ResponsiveModal } from '@/components/ui/responsive-modal';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { salaries as salaryDb, salaryExtras as extraDb } from '@/lib/db';
import { salaryForMonth, salaryYear, paydayLabel } from '@/lib/salary';
import { fmtCurrency } from '@/lib/utils';
import { useAppStore } from '@/store';
import type { Salary, SalaryExtra } from '@/types';
import { toast } from 'sonner';

const MONTH_NAMES = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

/** Leeres Formular für eine neue Stufe – beginnt im laufenden Monat. */
function emptySalary(): Omit<Salary, 'id'> {
  const now = new Date();
  return {
    valid_from: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
    employer: '',
    gross: 0,
    net: 0,
    payday: 0,
    note: '',
  };
}

function emptyExtra(): Omit<SalaryExtra, 'id'> {
  return {
    date: new Date().toISOString().slice(0, 10),
    label: '',
    gross: 0,
    net: 0,
    note: '',
  };
}

export default function GehaltPage() {
  const selectedYear = useAppStore((s) => s.selectedYear);
  const privacyMode = useAppStore((s) => s.privacyMode);
  const [salaries, setSalaries] = useState<Salary[]>([]);
  const [extras, setExtras] = useState<SalaryExtra[]>([]);
  const [salaryForm, setSalaryForm] = useState<Omit<Salary, 'id'> | null>(null);
  const [extraForm, setExtraForm] = useState<Omit<SalaryExtra, 'id'> | null>(null);

  const load = async () => {
    try {
      const [s, e] = await Promise.all([salaryDb.getAll(), extraDb.getAll()]);
      setSalaries(s);
      setExtras(e);
    } catch (err) {
      toast.error('Gehaltsdaten konnten nicht geladen werden: ' + String(err));
    }
  };

  useEffect(() => { void load(); }, []);

  const now = new Date();
  const aktuell = salaryForMonth(salaries, now.getFullYear(), now.getMonth() + 1);
  const jahr = useMemo(() => salaryYear(salaries, extras, selectedYear), [salaries, extras, selectedYear]);

  const saveSalary = async () => {
    if (!salaryForm) return;
    if (!/^\d{4}-\d{2}$/.test(salaryForm.valid_from)) {
      toast.error('Bitte einen Monat im Format 2026-08 angeben');
      return;
    }
    try {
      await salaryDb.create(salaryForm);
      setSalaryForm(null);
      await load();
      toast.success('Gehalt gespeichert');
    } catch (err) {
      toast.error('Speichern fehlgeschlagen: ' + String(err));
    }
  };

  const saveExtra = async () => {
    if (!extraForm) return;
    try {
      await extraDb.create(extraForm);
      setExtraForm(null);
      await load();
      toast.success('Zahlung gespeichert');
    } catch (err) {
      toast.error('Speichern fehlgeschlagen: ' + String(err));
    }
  };

  return (
    // Am Rechner in einer Spalte von Lesebreite statt über die ganze Fläche:
    // Zeilen mit Beschriftung links und Wert rechts werden sonst zu Balken,
    // bei denen zwischen beidem ein halber Bildschirm liegt.
    <div className="mx-auto max-w-3xl space-y-8 pb-6">
      <PageHeader
        title="Gehalt"
        subtitle="Was jeden Monat kommt – und was einmalig dazukam"
        startExpanded
      />

      <ListGroup
        title="Aktuell"
        footer={
          aktuell
            ? `Zahlung ${paydayLabel(aktuell.payday)}${aktuell.employer ? ` · ${aktuell.employer}` : ''}`
            : 'Noch kein Gehalt hinterlegt. Trage ein, ab wann du wie viel bekommst.'
        }
      >
        <ListRow
          icon={<Wallet />}
          tint="green"
          label="Brutto im Monat"
          value={aktuell ? fmtCurrency(aktuell.gross, privacyMode) : '—'}
          noChevron
        />
        <ListRow
          label="Netto im Monat"
          value={aktuell && aktuell.net > 0 ? fmtCurrency(aktuell.net, privacyMode) : '—'}
          noChevron
        />
      </ListGroup>

      <div className="space-y-3">
        <ListGroup
          title={`Jahr ${selectedYear}`}
          footer="Brutto und Netto aus den Stufen plus allen Einmalzahlungen des Jahres."
        >
          <ListRow label="Brutto gesamt" value={fmtCurrency(jahr.gross, privacyMode)} noChevron />
          <ListRow label="Netto gesamt" value={jahr.net > 0 ? fmtCurrency(jahr.net, privacyMode) : '—'} noChevron />
        </ListGroup>
      </div>

      {/* ── Stufen ── */}
      <div className="space-y-3">
        <ListGroup
          title="Gehaltsstufen"
          footer="Eine Erhöhung ist eine neue Stufe – die alte bleibt stehen, damit vergangene Monate richtig bleiben."
        >
          {salaries.length === 0 && (
            <ListRow label="Noch keine Stufe" hint="Trage ein, ab wann du wie viel bekommst" noChevron />
          )}
          {salaries.map((s) => (
            <ListRow
              key={s.id}
              icon={<Wallet />}
              tint="blue"
              label={`ab ${s.valid_from.replace('-', '/')}`}
              hint={`${fmtCurrency(s.gross, privacyMode)} brutto · ${paydayLabel(s.payday)}${s.employer ? ` · ${s.employer}` : ''}`}
              trailing={
                <button
                  type="button"
                  aria-label="Stufe löschen"
                  onClick={async () => { await salaryDb.remove(s.id); await load(); }}
                  className="text-muted-foreground active:opacity-60"
                >
                  <Trash2 className="h-[18px] w-[18px]" />
                </button>
              }
            />
          ))}
        </ListGroup>
        <Button variant="secondary" className="h-11 w-full text-[17px]" onClick={() => setSalaryForm(emptySalary())}>
          <Plus className="mr-2 h-4 w-4" /> Gehalt oder Erhöhung eintragen
        </Button>
      </div>

      {/* ── Einmalzahlungen ── */}
      <div className="space-y-3">
        <ListGroup
          title="Einmalzahlungen"
          footer="13. Gehalt, Bonus, Urlaubsgeld, Nachzahlung – alles, was sich nicht monatlich wiederholt."
        >
          {extras.length === 0 && (
            <ListRow label="Noch keine Zahlung" hint="Bonus, 13. Gehalt, Urlaubsgeld …" noChevron />
          )}
          {extras.map((e) => (
            <ListRow
              key={e.id}
              icon={<Gift />}
              tint="orange"
              label={e.label || 'Sonderzahlung'}
              hint={`${e.date} · ${fmtCurrency(e.gross, privacyMode)} brutto`}
              trailing={
                <button
                  type="button"
                  aria-label="Zahlung löschen"
                  onClick={async () => { await extraDb.remove(e.id); await load(); }}
                  className="text-muted-foreground active:opacity-60"
                >
                  <Trash2 className="h-[18px] w-[18px]" />
                </button>
              }
            />
          ))}
        </ListGroup>
        <Button variant="secondary" className="h-11 w-full text-[17px]" onClick={() => setExtraForm(emptyExtra())}>
          <Plus className="mr-2 h-4 w-4" /> Einmalzahlung eintragen
        </Button>
      </div>

      {/* ── Monate des Jahres ── */}
      <ListGroup title={`Monate ${selectedYear}`}>
        {jahr.months.map((m) => (
          <ListRow
            key={m.month}
            label={MONTH_NAMES[m.month - 1]}
            hint={m.extras.length > 0 ? m.extras.map((e) => e.label || 'Sonderzahlung').join(', ') : undefined}
            value={m.gross > 0 ? fmtCurrency(m.gross, privacyMode) : '—'}
            noChevron
          />
        ))}
      </ListGroup>

      {/* ── Formular: Stufe ── */}
      <ResponsiveModal
        open={salaryForm != null}
        onClose={() => setSalaryForm(null)}
        title="Gehalt eintragen"
        closeLabel="Abbrechen"
      >
        {salaryForm && (
          <div className="space-y-6">
            <FormGroup footer="Ab welchem Monat gilt dieser Betrag? Format: 2026-08.">
              <FormRow label="Gültig ab">
                <input
                  className={FIELD}
                  value={salaryForm.valid_from}
                  onChange={(e) => setSalaryForm({ ...salaryForm, valid_from: e.target.value })}
                  placeholder="2026-08"
                />
              </FormRow>
              <FormRow label="Arbeitgeber">
                <input
                  className={FIELD}
                  value={salaryForm.employer}
                  onChange={(e) => setSalaryForm({ ...salaryForm, employer: e.target.value })}
                  placeholder="Firma"
                />
              </FormRow>
            </FormGroup>

            <FormGroup footer="Das Netto ist freiwillig – es hilft nur beim Überblick, was tatsächlich ankommt.">
              <FormRow label="Brutto">
                <input
                  type="number"
                  inputMode="decimal"
                  className={FIELD}
                  value={salaryForm.gross || ''}
                  onChange={(e) => setSalaryForm({ ...salaryForm, gross: Number(e.target.value) || 0 })}
                  placeholder="0,00"
                />
              </FormRow>
              <FormRow label="Netto">
                <input
                  type="number"
                  inputMode="decimal"
                  className={FIELD}
                  value={salaryForm.net || ''}
                  onChange={(e) => setSalaryForm({ ...salaryForm, net: Number(e.target.value) || 0 })}
                  placeholder="0,00"
                />
              </FormRow>
              <FormRow label="Zahltag">
                <Select
                  value={String(salaryForm.payday)}
                  onValueChange={(v) => setSalaryForm({ ...salaryForm, payday: Number(v) })}
                >
                  <SelectTrigger className="h-9 w-auto min-w-32 border-0 bg-transparent shadow-none">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    <SelectItem value="0">zum Monatsende</SelectItem>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                      <SelectItem key={d} value={String(d)}>{`am ${d}.`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormRow>
            </FormGroup>

            <Button className="h-[50px] w-full text-[17px] font-semibold" onClick={saveSalary}>
              Speichern
            </Button>
          </div>
        )}
      </ResponsiveModal>

      {/* ── Formular: Einmalzahlung ── */}
      <ResponsiveModal
        open={extraForm != null}
        onClose={() => setExtraForm(null)}
        title="Einmalzahlung"
        closeLabel="Abbrechen"
      >
        {extraForm && (
          <div className="space-y-6">
            <FormGroup>
              <FormRow label="Datum">
                <input
                  type="date"
                  className={FIELD_DATE}
                  value={extraForm.date}
                  onChange={(e) => setExtraForm({ ...extraForm, date: e.target.value })}
                />
              </FormRow>
              <FormRow label="Anlass">
                <input
                  className={FIELD}
                  value={extraForm.label}
                  onChange={(e) => setExtraForm({ ...extraForm, label: e.target.value })}
                  placeholder="13. Gehalt, Bonus …"
                />
              </FormRow>
              <FormRow label="Brutto">
                <input
                  type="number"
                  inputMode="decimal"
                  className={FIELD}
                  value={extraForm.gross || ''}
                  onChange={(e) => setExtraForm({ ...extraForm, gross: Number(e.target.value) || 0 })}
                  placeholder="0,00"
                />
              </FormRow>
              <FormRow label="Netto">
                <input
                  type="number"
                  inputMode="decimal"
                  className={FIELD}
                  value={extraForm.net || ''}
                  onChange={(e) => setExtraForm({ ...extraForm, net: Number(e.target.value) || 0 })}
                  placeholder="0,00"
                />
              </FormRow>
            </FormGroup>

            <Button className="h-[50px] w-full text-[17px] font-semibold" onClick={saveExtra}>
              Speichern
            </Button>
          </div>
        )}
      </ResponsiveModal>
    </div>
  );
}
