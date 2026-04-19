import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ElementType } from '@/types/dashboard';
import { useDashboardContext } from './DashboardContext';
import { KPICard } from './KPICard';
import { RevenueChart } from './RevenueChart';
import { CategoryDonut } from './CategoryDonut';
import { SonderausgabenCard } from './SonderausgabenCard';
import { ForecastList } from './ForecastList';
import { Last28DaysChart } from './Last28DaysChart';
import { RecentEmailsCard } from './RecentEmailsCard';
import { CashflowChart } from './CashflowChart';
import { TopAusgabenCard } from './TopAusgabenCard';
import { TopPartnerCard } from './TopPartnerCard';
import { JahresvergleichCard } from './JahresvergleichCard';
import {
  Euro, TrendingUp, TrendingDown, FileText, Calculator, Sparkles,
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
}

export function DashboardElementNode({ type }: DashboardElementNodeProps) {
  const ctx = useDashboardContext();
  const navigate = useNavigate();
  const [ctxMenu, setCtxMenu] = useState<{ invoice: Invoice; x: number; y: number } | null>(null);

  const {
    loading, privacyMode,
    einnahmen, ausgaben, saldo, betriebsergebnis, recentCount,
    deltaEin, deltaAus, deltaSaldo,
    monatEin, monatAus, monatSaldo, monatSaldoMitPrognose,
    deltaMonatEin, deltaMonatAus, deltaMonatSaldo,
    forecastEin, forecastAus,
    yearInvoices, invoices, lastTen, prevYearInvoices,
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
      const ustSum = yearInvoices.reduce((s, i) => s + (i.ust ?? 0), 0);
      return (
        <KPICard loading={loading} title="USt (Jahr)"
          value={fmtCurrency(ustSum, privacyMode)}
          icon={<FileText className="h-4 w-4 text-muted-foreground" />}
          tooltip="Summe der ausgewiesenen Umsatzsteuer für das ausgewählte Jahr" />
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
    case 'chart-revenue':
      return <RevenueChart loading={loading} invoices={yearInvoices} privacyMode={privacyMode} />;
    case 'chart-cashflow':
      return <CashflowChart loading={loading} invoices={yearInvoices} privacyMode={privacyMode} />;
    case 'chart-category-donut':
      return <CategoryDonut loading={loading} invoices={yearInvoices} privacyMode={privacyMode} />;
    case 'chart-last28days':
      return <Last28DaysChart loading={loading} invoices={invoices} privacyMode={privacyMode} />;
    case 'card-sonderausgaben':
      return <SonderausgabenCard loading={loading} invoices={yearInvoices} privacyMode={privacyMode} />;
    case 'list-top-ausgaben':
      return <TopAusgabenCard loading={loading} invoices={yearInvoices} privacyMode={privacyMode} />;
    case 'list-top-partner':
      return <TopPartnerCard loading={loading} invoices={yearInvoices} privacyMode={privacyMode} />;
    case 'list-forecast':
      return <ForecastList loading={loading} invoices={invoices} privacyMode={privacyMode} />;
    case 'list-recent-emails':
      return <RecentEmailsCard editMode={ctx.editMode} />;
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
  'card-sonderausgaben': 'Sonderausgaben',
  'list-top-ausgaben': 'Top Ausgaben',
  'list-top-partner': 'Top Kunden',
  'kpi-ust-jahr': 'USt (Jahr)',
  'kpi-avg-einnahmen-monat': 'Ø Einnahmen / Monat',
  'card-jahresvergleich': 'Jahresvergleich',
  'list-forecast': 'Prognose',
  'list-recent-emails': 'Letzte E-Mails',
  'list-recent-invoices': 'Letzte 10 Belege',
};

