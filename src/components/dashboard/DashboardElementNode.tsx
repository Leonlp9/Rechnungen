import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ElementType } from '@/types/dashboard';
import { useDashboardContext } from './DashboardContext';
import { KPICard } from './KPICard';
import { RevenueChart } from './RevenueChart';
import { CategoryDonut } from './CategoryDonut';
import { SonderausgabenCard } from './SonderausgabenCard';
import { ForecastList } from './ForecastList';
import { Forecast28DaysList } from './Forecast28DaysList';
import { Last28DaysChart } from './Last28DaysChart';
import { MonthChart } from './MonthChart';
import { RecentEmailsCard } from './RecentEmailsCard';
import { CashflowChart } from './CashflowChart';
import { TopAusgabenCard } from './TopAusgabenCard';
import { TopEinnahmenCard } from './TopEinnahmenCard';
import { TopPartnerCard } from './TopPartnerCard';
import { JahresvergleichCard } from './JahresvergleichCard';
import { MonatsuebersichtCard } from './MonatsuebersichtCard';
import { KleinunternehmerCard } from './KleinunternehmerCard';
import { GesamtRevenueChart } from './GesamtRevenueChart';
import { GesamtCashflowChart } from './GesamtCashflowChart';
import { AboList } from './AboList';
import { PartnerCard } from './PartnerCard';
import { JahresprognoseChart } from './JahresprognoseChart';
import { useAppStore } from '@/store';
import {
  Euro, TrendingUp, TrendingDown, FileText, Calculator, Sparkles, Percent, PiggyBank,
  Star, BarChart3,
} from 'lucide-react';
import { fmtCurrency } from '@/lib/utils';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { CATEGORY_LABELS, TYPE_LABELS } from '@/types';
import type { Invoice } from '@/types';
import { InvoiceContextMenu } from '@/components/invoices/InvoiceContextMenu';

interface DashboardElementNodeProps {
  type: ElementType;
  settingsOpen?: boolean;
  onSettingsClose?: () => void;
}

export function DashboardElementNode({ type, settingsOpen, onSettingsClose }: DashboardElementNodeProps) {
  const ctx = useDashboardContext();
  const navigate = useNavigate();
  const steuerregelung = useAppStore((s) => s.steuerregelung);
  const [ctxMenu, setCtxMenu] = useState<{ invoice: Invoice; x: number; y: number } | null>(null);

  const {
    loading, privacyMode,
    einnahmen, ausgaben, saldo, betriebsergebnis, recentCount,
    deltaEin, deltaAus, deltaSaldo,
    monatEin, monatAus, monatSaldo, monatSaldoMitPrognose,
    deltaMonatEin, deltaMonatAus, deltaMonatSaldo,
    forecastEin, forecastAus,
    yearInvoices, invoices, lastTen, prevYearInvoices,
    selectedMonth, selectedYear,
    gesamtEinnahmen, gesamtAusgaben, gesamtSaldo, gesamtBelege,
    gesamtBestesJahr, gesamtAvgYearlyEinnahmen, gesamtAvgYearlyAusgaben,
    gesamtMarge, gesamtByYear,
  } = ctx;


  switch (type) {
    case 'kpi-einnahmen-ytd':
      return (
        <KPICard loading={loading} title="Einnahmen YTD"
          value={fmtCurrency(einnahmen, privacyMode)}
          delta={privacyMode ? undefined : deltaEin}
          icon={<TrendingUp className="h-4 w-4 text-green-600" />} />
      );
    case 'kpi-ausgaben-ytd':
      return (
        <KPICard loading={loading} title="Ausgaben YTD"
          value={fmtCurrency(ausgaben, privacyMode)}
          delta={privacyMode ? undefined : deltaAus}
          icon={<TrendingDown className="h-4 w-4 text-red-600" />} />
      );
    case 'kpi-saldo-ytd':
      return (
        <KPICard loading={loading} title="Saldo YTD"
          value={fmtCurrency(saldo, privacyMode)}
          delta={privacyMode ? undefined : deltaSaldo}
          icon={<Euro className="h-4 w-4 text-primary" />}
          tooltip="Tatsächlich verfügbares Geld: Einnahmen minus alle Ausgaben" />
      );
    case 'kpi-betriebsergebnis':
      return (
        <KPICard loading={loading} title="Betriebsergebnis"
          value={fmtCurrency(betriebsergebnis, privacyMode)}
          icon={<Calculator className="h-4 w-4 text-violet-600" />}
          tooltip="Steuerlich relevantes Ergebnis: nur Betriebsausgaben abgezogen" />
      );
    case 'kpi-belege-30d':
      return (
        <KPICard loading={loading} title="Belege (30 Tage)"
          value={String(recentCount)}
          icon={<FileText className="h-4 w-4 text-muted-foreground" />} />
      );
    case 'kpi-einnahmen-monat':
      return (
        <KPICard loading={loading} title="Einnahmen (Monat)"
          value={fmtCurrency(monatEin, privacyMode)}
          delta={privacyMode ? undefined : deltaMonatEin}
          icon={<TrendingUp className="h-4 w-4 text-green-600" />} />
      );
    case 'kpi-ausgaben-monat':
      return (
        <KPICard loading={loading} title="Ausgaben (Monat)"
          value={fmtCurrency(monatAus, privacyMode)}
          delta={privacyMode ? undefined : deltaMonatAus}
          icon={<TrendingDown className="h-4 w-4 text-red-600" />} />
      );
    case 'kpi-saldo-monat':
      return (
        <KPICard loading={loading} title="Saldo (Monat)"
          value={fmtCurrency(monatSaldo, privacyMode)}
          delta={privacyMode ? undefined : deltaMonatSaldo}
          icon={<Euro className="h-4 w-4 text-primary" />}
          tooltip="Einnahmen minus Ausgaben im aktuellen Monat" />
      );
    case 'kpi-saldo-prognose':
      return (
        <KPICard loading={loading} title="Saldo inkl. Prognose"
          value={fmtCurrency(monatSaldoMitPrognose, privacyMode)}
          icon={<Sparkles className="h-4 w-4 text-violet-500" />}
          tooltip={`Aktueller Monatssaldo + erwartete Einnahmen (${fmtCurrency(forecastEin, privacyMode)}) − erwartete Ausgaben (${fmtCurrency(forecastAus, privacyMode)}) bis Monatsende`} />
      );
    case 'kpi-ust-jahr': {
      // Nur relevant für Regelbesteuerer
      if (steuerregelung === 'kleinunternehmer') {
        return (
          <KPICard
            loading={loading}
            title="USt-Zahllast"
            value="Nicht relevant"
            icon={<FileText className="h-4 w-4 text-muted-foreground" />}
            tooltip="Als Kleinunternehmer (§ 19 UStG) weist du keine Umsatzsteuer auf deinen Rechnungen aus und schuldest dem Finanzamt keine USt. Die Steuer in Rechnungen die du bekommst (z. B. Spotify, Software) hast du zwar mitbezahlt – aber das ist Sache des jeweiligen Anbieters, nicht deine. Dieses Widget ist nur für regelbesteuerte Unternehmer sinnvoll."
          />
        );
      }
      // Regelbesteuerung: USt auf Einnahmen minus Vorsteuer aus Ausgaben
      const ustEinnahmen = yearInvoices
        .filter((i) => i.type === 'einnahme')
        .reduce((s, i) => s + (i.ust ?? 0), 0);
      const vorsteuer = yearInvoices
        .filter((i) => i.type === 'ausgabe')
        .reduce((s, i) => s + (i.ust ?? 0), 0);
      const zahllast = ustEinnahmen - vorsteuer;
      return (
        <KPICard loading={loading} title="USt-Zahllast (Jahr)"
          value={fmtCurrency(zahllast, privacyMode)}
          icon={<FileText className="h-4 w-4 text-muted-foreground" />}
          tooltip={`Du sammelst USt von deinen Kunden ein (${fmtCurrency(ustEinnahmen, privacyMode)}) und kannst die USt aus deinen eigenen Einkäufen als Vorsteuer gegenrechnen (${fmtCurrency(vorsteuer, privacyMode)}). Die Differenz (${fmtCurrency(zahllast, privacyMode)}) musst du ans Finanzamt abführen.`} />
      );
    }
    case 'kpi-avg-einnahmen-monat': {
      const avg = einnahmen / 12;
      const prevAvg = ctx.prevYearInvoices.filter((i) => i.type === 'einnahme').reduce((s, i) => s + i.brutto, 0) / 12;
      const delta = prevAvg ? ((avg - prevAvg) / prevAvg) * 100 : 0;
      return (
        <KPICard loading={loading} title="Ø Einnahmen / Monat"
          value={fmtCurrency(avg, privacyMode)}
          delta={privacyMode ? undefined : delta}
          icon={<TrendingUp className="h-4 w-4 text-green-600" />}
          tooltip="Durchschnittliche monatliche Einnahmen (Einnahmen / 12)" />
      );
    }
    case 'kpi-avg-ausgaben-monat': {
      const avg = ausgaben / 12;
      const prevAvg = ctx.prevYearInvoices.filter((i) => i.type === 'ausgabe').reduce((s, i) => s + i.brutto, 0) / 12;
      const delta = prevAvg ? ((avg - prevAvg) / prevAvg) * 100 : 0;
      return (
        <KPICard loading={loading} title="Ø Ausgaben / Monat"
          value={fmtCurrency(avg, privacyMode)}
          delta={privacyMode ? undefined : delta}
          icon={<TrendingDown className="h-4 w-4 text-red-600" />}
          tooltip="Durchschnittliche monatliche Ausgaben (Ausgaben / 12)" />
      );
    }
    case 'kpi-marge': {
      const marge = einnahmen > 0 ? (betriebsergebnis / einnahmen) * 100 : 0;
      return (
        <KPICard loading={loading} title="Gewinnmarge"
          value={`${marge.toFixed(1)} %`}
          icon={<Percent className="h-4 w-4 text-violet-500" />}
          tooltip="Betriebsergebnis / Einnahmen × 100 – steuerlicher Gewinnanteil" />
      );
    }
    case 'kpi-steuerruecklage': {
      const ruecklage = Math.max(0, betriebsergebnis * 0.3);
      return (
        <KPICard loading={loading} title="Steuerrücklage (30 %)"
          value={fmtCurrency(ruecklage, privacyMode)}
          icon={<PiggyBank className="h-4 w-4 text-amber-500" />}
          tooltip="Empfohlene Steuerrücklage: 30 % des Betriebsergebnisses als Richtwert für die Einkommensteuer" />
      );
    }
    case 'list-top-einnahmen':
      return <TopEinnahmenCard loading={loading} invoices={yearInvoices} privacyMode={privacyMode} />;
    case 'card-monatsuebersicht':
      return <MonatsuebersichtCard loading={loading} invoices={yearInvoices} selectedYear={selectedYear} privacyMode={privacyMode} />;
    case 'chart-revenue':
      return <RevenueChart loading={loading} invoices={yearInvoices} privacyMode={privacyMode} />;
    case 'chart-cashflow':
      return <CashflowChart loading={loading} invoices={yearInvoices} privacyMode={privacyMode} />;
    case 'chart-category-donut':
      return <CategoryDonut loading={loading} invoices={yearInvoices} privacyMode={privacyMode} />;
    case 'chart-last28days':
      return <Last28DaysChart loading={loading} invoices={invoices} privacyMode={privacyMode} />;
    case 'chart-month':
      return <MonthChart loading={loading} invoices={invoices} privacyMode={privacyMode} selectedMonth={selectedMonth} selectedYear={selectedYear} />;
    case 'card-sonderausgaben':
      return <SonderausgabenCard loading={loading} invoices={yearInvoices} privacyMode={privacyMode} />;
    case 'list-top-ausgaben':
      return <TopAusgabenCard loading={loading} invoices={yearInvoices} privacyMode={privacyMode} />;
    case 'list-top-partner':
      return <TopPartnerCard loading={loading} invoices={yearInvoices} privacyMode={privacyMode} />;
    case 'list-forecast':
      return <ForecastList loading={loading} invoices={invoices} privacyMode={privacyMode} selectedMonth={selectedMonth} selectedYear={selectedYear} />;
    case 'list-forecast-28d':
      return <Forecast28DaysList loading={loading} invoices={invoices} privacyMode={privacyMode} />;
    case 'list-recent-emails':
      return <RecentEmailsCard editMode={ctx.editMode} settingsOpen={settingsOpen} onSettingsClose={onSettingsClose} />;
    case 'card-jahresvergleich':
      return <JahresvergleichCard loading={loading} yearInvoices={yearInvoices} prevYearInvoices={prevYearInvoices} selectedYear={ctx.selectedYear} privacyMode={privacyMode} />;
    case 'list-recent-invoices':
      return (
        <>
          <div className="rounded-xl border bg-card p-6 shadow-sm h-full">
            <h2 className="text-lg font-semibold mb-4">Letzte 10 Belege</h2>
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : lastTen.length === 0 ? (
              <p className="text-muted-foreground text-sm">Noch keine Rechnungen vorhanden.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Datum</TableHead>
                    <TableHead>Partner</TableHead>
                    <TableHead>Kategorie</TableHead>
                    <TableHead>Brutto</TableHead>
                    <TableHead>Typ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lastTen.map((inv) => (
                    <TableRow
                      key={inv.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/invoices/${inv.id}`)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setCtxMenu({ invoice: inv, x: e.clientX, y: e.clientY });
                      }}
                    >
                      <TableCell>{format(new Date(inv.date), 'dd.MM.yyyy', { locale: de })}</TableCell>
                      <TableCell>{inv.partner}</TableCell>
                      <TableCell>{CATEGORY_LABELS[inv.category]}</TableCell>
                      <TableCell className={inv.type === 'einnahme' ? 'text-green-600' : inv.type === 'ausgabe' ? 'text-red-600' : ''}>
                        {fmtCurrency(inv.brutto, privacyMode)}
                      </TableCell>
                      <TableCell>{TYPE_LABELS[inv.type]}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
          {ctxMenu && (
            <InvoiceContextMenu
              invoice={ctxMenu.invoice}
              x={ctxMenu.x}
              y={ctxMenu.y}
              onClose={() => setCtxMenu(null)}
            />
          )}
        </>
      );
    case 'kpi-kleinunternehmer':
      return (
        <KleinunternehmerCard
          loading={loading}
          einnahmen={einnahmen}
          selectedYear={selectedYear}
          privacyMode={privacyMode}
        />
      );

    // ── Gesamt-Elemente (alle Jahre) ──────────────────────────────────────────
    case 'kpi-gesamt-einnahmen':
      return (
        <KPICard loading={loading} title="Einnahmen gesamt"
          value={fmtCurrency(gesamtEinnahmen, privacyMode)}
          icon={<TrendingUp className="h-4 w-4 text-green-600" />}
          tooltip="Summe aller Einnahmen über alle Jahre" />
      );
    case 'kpi-gesamt-ausgaben':
      return (
        <KPICard loading={loading} title="Ausgaben gesamt"
          value={fmtCurrency(gesamtAusgaben, privacyMode)}
          icon={<TrendingDown className="h-4 w-4 text-red-600" />}
          tooltip="Summe aller Ausgaben über alle Jahre" />
      );
    case 'kpi-gesamt-saldo':
      return (
        <KPICard loading={loading} title="Saldo gesamt"
          value={fmtCurrency(gesamtSaldo, privacyMode)}
          icon={<Euro className="h-4 w-4 text-primary" />}
          tooltip="Einnahmen minus Ausgaben über alle Jahre" />
      );
    case 'kpi-gesamt-belege':
      return (
        <KPICard loading={loading} title="Belege gesamt"
          value={String(gesamtBelege)}
          icon={<FileText className="h-4 w-4 text-muted-foreground" />}
          tooltip="Gesamtanzahl aller erfassten Belege" />
      );
    case 'kpi-gesamt-bestes-jahr':
      return (
        <KPICard loading={loading} title="Bestes Jahr"
          value={gesamtBestesJahr ? String(gesamtBestesJahr.year) : '–'}
          icon={<Star className="h-4 w-4 text-amber-500" />}
          tooltip={gesamtBestesJahr ? `${gesamtBestesJahr.year} hatte die höchsten Einnahmen: ${fmtCurrency(gesamtBestesJahr.einnahmen, privacyMode)}` : 'Noch keine Daten'} />
      );
    case 'kpi-gesamt-avg-yearly-einnahmen':
      return (
        <KPICard loading={loading} title="Ø Einnahmen / Jahr"
          value={fmtCurrency(gesamtAvgYearlyEinnahmen, privacyMode)}
          icon={<TrendingUp className="h-4 w-4 text-green-600" />}
          tooltip="Durchschnittliche Einnahmen pro Jahr" />
      );
    case 'kpi-gesamt-avg-yearly-ausgaben':
      return (
        <KPICard loading={loading} title="Ø Ausgaben / Jahr"
          value={fmtCurrency(gesamtAvgYearlyAusgaben, privacyMode)}
          icon={<TrendingDown className="h-4 w-4 text-red-600" />}
          tooltip="Durchschnittliche Ausgaben pro Jahr" />
      );
    case 'kpi-gesamt-marge': {
      return (
        <KPICard loading={loading} title="Ø Gewinnmarge (gesamt)"
          value={`${gesamtMarge.toFixed(1)} %`}
          icon={<BarChart3 className="h-4 w-4 text-violet-500" />}
          tooltip="Durchschnittliche Gewinnmarge über alle Jahre: (Einnahmen − Ausgaben) / Einnahmen × 100" />
      );
    }
    case 'chart-gesamt-revenue':
      return (
        <GesamtRevenueChart loading={loading} data={gesamtByYear} privacyMode={privacyMode} />
      );
    case 'chart-gesamt-cashflow':
      return (
        <GesamtCashflowChart loading={loading} invoices={invoices} privacyMode={privacyMode} />
      );
    case 'list-abos':
      return (
        <AboList loading={loading} invoices={invoices} privacyMode={privacyMode} />
      );
    case 'card-partner':
      return (
        <PartnerCard
          loading={loading}
          invoices={invoices}
          selectedYear={selectedYear}
          selectedMonth={selectedMonth}
          privacyMode={privacyMode}
          editMode={ctx.editMode}
          settingsOpen={settingsOpen}
          onSettingsClose={onSettingsClose}
        />
      );
    case 'chart-jahresprognose':
      return (
        <JahresprognoseChart
          loading={loading}
          invoices={invoices}
          selectedYear={selectedYear}
          privacyMode={privacyMode}
        />
      );

    default:
      return <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">Unbekanntes Element</div>;
  }
}

export const ELEMENT_LABELS: Record<ElementType, string> = {
  'kpi-einnahmen-ytd': 'Einnahmen YTD',
  'kpi-ausgaben-ytd': 'Ausgaben YTD',
  'kpi-saldo-ytd': 'Saldo YTD',
  'kpi-betriebsergebnis': 'Betriebsergebnis',
  'kpi-belege-30d': 'Belege (30 Tage)',
  'kpi-einnahmen-monat': 'Einnahmen (Monat)',
  'kpi-ausgaben-monat': 'Ausgaben (Monat)',
  'kpi-saldo-monat': 'Saldo (Monat)',
  'kpi-saldo-prognose': 'Saldo inkl. Prognose',
  'chart-revenue': 'Umsatzchart',
  'chart-cashflow': 'Cashflow (kumuliert)',
  'chart-category-donut': 'Kategorien-Donut',
  'chart-last28days': '28-Tage-Chart',
  'chart-month': 'Monatschart',
  'card-sonderausgaben': 'Sonderausgaben',
  'list-top-ausgaben': 'Top Ausgaben',
  'list-top-partner': 'Top Kunden',
  'kpi-ust-jahr': 'USt-Zahllast (Jahr)',
  'kpi-avg-einnahmen-monat': 'Ø Einnahmen / Monat',
  'kpi-avg-ausgaben-monat': 'Ø Ausgaben / Monat',
  'kpi-marge': 'Gewinnmarge',
  'kpi-steuerruecklage': 'Steuerrücklage (30 %)',
  'list-top-einnahmen': 'Top Einnahmen',
  'card-monatsuebersicht': 'Monatsübersicht',
  'card-jahresvergleich': 'Jahresvergleich',
  'list-forecast': 'Prognose (Monat)',
  'list-forecast-28d': 'Prognose (28 Tage)',
  'list-recent-emails': 'Letzte E-Mails',
  'list-recent-invoices': 'Letzte 10 Belege',
  'kpi-kleinunternehmer': 'Kleinunternehmergrenze',
  // Gesamt
  'kpi-gesamt-einnahmen': 'Einnahmen gesamt',
  'kpi-gesamt-ausgaben': 'Ausgaben gesamt',
  'kpi-gesamt-saldo': 'Saldo gesamt',
  'kpi-gesamt-belege': 'Belege gesamt',
  'kpi-gesamt-bestes-jahr': 'Bestes Jahr',
  'kpi-gesamt-avg-yearly-einnahmen': 'Ø Einnahmen / Jahr',
  'kpi-gesamt-avg-yearly-ausgaben': 'Ø Ausgaben / Jahr',
  'kpi-gesamt-marge': 'Ø Gewinnmarge (gesamt)',
  'chart-gesamt-revenue': 'Jahresvergleich-Chart (gesamt)',
  'chart-gesamt-cashflow': 'Cashflow-Chart (alle Jahre)',
  'list-abos': 'Aktive Abos',
  'card-partner': 'Partner-Umsatz',
  'chart-jahresprognose': 'Jahresprognose (Abo-Cashflow)',
};

