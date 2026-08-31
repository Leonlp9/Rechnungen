// ─── Der Vorlagen-Baukasten ──────────────────────────────────────────────────
//
// Vorher stand hier ein Pixel-Editor: jedes Element mit eigenem x, y, Breite und
// Höhe auf einer A4-Fläche, dazu drei Spalten nebeneinander. Wer eine Zeile
// einfügte, musste alles darunter von Hand nachschieben, und bei 800 Pixeln
// Fensterbreite blieben für das Blatt noch neunzig übrig. Auf dem Handy gab es
// die Seite gar nicht erst. Ergebnis: in Monaten keine einzige eigene Vorlage.
//
// Deshalb hier das Gegenteil. Eine Vorlage ist eine Reihenfolge von Bausteinen –
// Kopfzeile, Anschriftfeld, Positionen, Fußzeile –, die man sortiert, ein- und
// ausschaltet. Wo etwas landet, rechnet `layoutRechnung` aus.
//
// Frei ist der Baukasten trotzdem, und zwar an zwei Stellen: Jeder Baustein
// trägt eine Feineinstellung, die die Gestaltung des Dokuments punktuell
// übersteuert, und der Spalten-Baustein nimmt andere Bausteine auf und stellt
// sie nebeneinander. Damit lässt sich fast jedes Blatt bauen, ohne dass man
// dafür wieder Pixel schieben müsste.
//
// Die Vorschau ist die Hauptsache und bekommt den meisten Platz: Sie zeigt die
// eigenen Absenderdaten aus den Einstellungen, damit man die eigene Rechnung
// sieht und nicht ein Muster.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import {
  ChevronsUpDown, Copy, FilePlus2, ImagePlus, Minus, Pencil, Plus, RotateCcw, Trash2, ZoomIn,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import { ResponsiveModal } from '@/components/ui/responsive-modal';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ListGroup, ListRow } from '@/components/ui/list-group';
import { FormFullRow, FormGroup } from '@/components/ui/form-list';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageHeader } from '@/components/layout/PageHeader';
import { Blattvorschau } from '@/components/rechnung/Blattvorschau';
import { useKneifzoom } from '@/components/rechnung/useKneifzoom';

import {
  Farbzeile, Feldgruppe, Feldzeile, HandyKontext, Marke, Reglerzeile, Vollzeile,
} from '@/components/rechnung/designer/Bedienelemente';
import { BausteinEinstellungen } from '@/components/rechnung/designer/BausteinEinstellungen';
import { Bausteinliste, type ListenAktionen } from '@/components/rechnung/designer/Bausteinliste';

import { useIsMobile } from '@/hooks/useIsMobile';
import { useAppStore } from '@/store';
import { useVorlagenStore } from '@/store/vorlagenStore';
import { layoutRechnung } from '@/lib/rechnung/layout';
import { kopiere, leereVorlage, neuerBaustein } from '@/lib/rechnung/vorlagen';
import { alleBausteine, bausteinSuchen, belegteTypen, listeVon, spaltenZiele } from '@/lib/rechnung/baum';
import { getSetting } from '@/lib/db';
import { cn } from '@/lib/utils';

import type { BausteinTyp, Rechnungsvorlage } from '@/types/rechnungsvorlage';
import {
  A4_BREITE, A4_HOEHE, BAUSTEIN_BESCHREIBUNG, BAUSTEIN_LABELS, NICHT_IN_SPALTEN, NUR_EINMAL,
} from '@/types/rechnungsvorlage';
import type { LineItem } from '@/types/template';

// ─── Feste Größen ────────────────────────────────────────────────────────────

/** Pixel je Millimeter bei 96 dpi – der Maßstab, den „100 %" meint. */
const PIXEL_JE_MM = 3.78;

// Feste Stufen statt fester Schrittweite. Vorher ging es in Zehnerschritten
// aufwärts: Von 44 auf 54 Prozent ist ein Viertel mehr und deutlich zu sehen,
// von 290 auf 300 fast nichts. Wer tippt, will jedes Mal einen sichtbaren
// Unterschied bekommen – Dokumentenbetrachter machen es genauso.
const ZOOMSTUFEN = [25, 33, 50, 67, 75, 100, 125, 150, 200, 300];
const ZOOM_MIN = ZOOMSTUFEN[0];
const ZOOM_MAX = ZOOMSTUFEN[ZOOMSTUFEN.length - 1];

/** Die nächste Stufe über bzw. unter dem aktuellen Wert. */
function naechsteStufe(jetzt: number, richtung: 1 | -1): number {
  if (richtung > 0) return ZOOMSTUFEN.find((s) => s > jetzt + 0.5) ?? ZOOM_MAX;
  return [...ZOOMSTUFEN].reverse().find((s) => s < jetzt - 0.5) ?? ZOOM_MIN;
}

const SCHRIFTEN = [
  { wert: 'Helvetica, Arial, sans-serif', label: 'Serifenlos' },
  { wert: 'Georgia, "Times New Roman", serif', label: 'Serif' },
  { wert: '"Courier New", Courier, monospace', label: 'Schreibmaschine' },
];

/**
 * Die Auswahl „Baustein hinzufügen". Gruppiert, weil fünfzehn Einträge
 * hintereinander niemand liest: oben, was auf der Rechnung steht, unten, was
 * den Aufbau ordnet.
 */
const TYP_GRUPPEN: Array<{ titel: string; typen: BausteinTyp[] }> = [
  {
    titel: 'Inhalt',
    typen: ['kopf', 'anschrift', 'eckdaten', 'betreff', 'text', 'positionen', 'zahlung', 'liste', 'fusszeile'],
  },
  {
    titel: 'Aufbau und Zierrat',
    typen: ['spalten', 'abstand', 'linie', 'bild', 'unterschrift', 'seitenumbruch'],
  },
];

/** Die drei Beispielleistungen der Vorschau – eine kurz, eine lang, eine pauschal. */
const BEISPIEL_POSITIONEN: LineItem[] = [
  { id: 'beispiel-1', description: 'Konzeption und Beratung', quantity: 4, unit: 'Std.', unitPrice: 95 },
  {
    id: 'beispiel-2',
    description: 'Umsetzung der Startseite inklusive Bildauswahl und einer Korrekturschleife',
    quantity: 12, unit: 'Std.', unitPrice: 85,
  },
  { id: 'beispiel-3', description: 'Einrichtung und Übergabe', quantity: 1, unit: 'Pausch.', unitPrice: 240 },
];

const PROFIL_SCHLUESSEL = [
  'profile_name', 'profile_address', 'profile_street', 'profile_zip', 'profile_city',
  'profile_email', 'profile_phone', 'profile_tax_number', 'profile_w_idnr', 'profile_vat_id',
  'profile_finanzamt', 'profile_iban', 'profile_bic',
];

// ─── Die Seite ───────────────────────────────────────────────────────────────

type Reiter = 'aufbau' | 'aussehen' | 'vorschau';

export default function InvoiceDesigner() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const steuerregelung = useAppStore((s) => s.steuerregelung);

  const {
    vorlagen, offeneVorlage, setOffeneVorlage,
    hinzufuegen, aendern, loeschen, zuruecksetzen,
    gestaltungAendern, bausteinAendern, bausteinHinzufuegen, bausteinLoeschen, bausteinVerschieben,
    bausteinUmhaengenIn, spalteHinzufuegen, spalteEntfernen,
  } = useVorlagenStore();

  const vorlage = vorlagen.find((v) => v.id === offeneVorlage) ?? vorlagen[0] ?? null;

  const [reiter, setReiter] = useState<Reiter>('aufbau');
  const [gewaehlterBaustein, setGewaehlterBaustein] = useState<string | null>(null);
  const [zoom, setZoom] = useState<number | 'passend'>('passend');

  const [neuOffen, setNeuOffen] = useState(false);
  const [neuName, setNeuName] = useState('');
  const [neuArt, setNeuArt] = useState<'rechnung' | 'gutschrift'>('rechnung');
  const [bearbeitenOffen, setBearbeitenOffen] = useState(false);
  const [neuerTitel, setNeuerTitel] = useState('');
  const [neueArt, setNeueArt] = useState<'rechnung' | 'gutschrift'>('rechnung');
  const [loeschenOffen, setLoeschenOffen] = useState(false);
  const [vorlagenlisteOffen, setVorlagenlisteOffen] = useState(false);

  // Die Auswahl merkt sich, wohin der neue Baustein soll: `null` heißt in die
  // Hauptliste, sonst in genau diese Spalte.
  const [auswahlOffen, setAuswahlOffen] = useState(false);
  const [auswahlZiel, setAuswahlZiel] = useState<string | null>(null);

  const logoFeld = useRef<HTMLInputElement>(null);
  const rahmen = useRef<HTMLDivElement>(null);

  // Der Vorschaubereich als Zustand, nicht als Ref: Am Handy entsteht er erst
  // beim Wechsel auf den Vorschau-Reiter. An einem Ref hätte weder die Messung
  // noch die Fingergeste gemerkt, dass es ihn jetzt gibt.
  const [blattbereich, setBlattbereich] = useState<HTMLDivElement | null>(null);
  const [bereich, setBereich] = useState({ breite: 0, hoehe: 0 });
  const [rahmenBreite, setRahmenBreite] = useState(0);

  // Zwei Spalten lohnen sich erst ab einer gewissen Breite. Genau daran ist der
  // alte Designer gescheitert: In einem schmalen Fenster blieben für das Blatt
  // neunzig Pixel übrig. Wird es eng, steht deshalb immer nur eine Sache da –
  // Aufbau, Aussehen oder Vorschau –, dafür in voller Breite.
  const eng = !isMobile && rahmenBreite > 0 && rahmenBreite < 880;

  // Wird das Fenster wieder breit, gibt es die Ansicht „Vorschau" nicht mehr –
  // sie steht dann ohnehin dauerhaft daneben.
  useEffect(() => {
    if (!isMobile && !eng && reiter === 'vorschau') setReiter('aufbau');
  }, [isMobile, eng, reiter]);

  // ── Absenderdaten aus den Einstellungen ──
  // Die Vorschau zeigt die eigene Rechnung, nicht die eines erfundenen Betriebs.
  const [profil, setProfil] = useState<Record<string, string>>({});
  useEffect(() => {
    let abgebrochen = false;
    Promise.all(PROFIL_SCHLUESSEL.map(async (k) => [k, (await getSetting(k)) ?? ''] as const))
      .then((paare) => {
        if (!abgebrochen) setProfil(Object.fromEntries(paare));
      })
      .catch(() => { /* Ohne Profil zeigt die Vorschau leere Absenderzeilen – kein Grund abzubrechen. */ });
    return () => { abgebrochen = true; };
  }, []);

  // ── Die Größe des Vorschaubereichs ──
  //
  // Bewusst vor dem Zeichnen: Als gewöhnlicher Effekt lief die Messung erst
  // danach, und beim ersten Blick auf die Vorschau stand das Blatt eine
  // Bildfolge lang auf 100 Prozent, bevor es auf den passenden Maßstab sprang.
  useLayoutEffect(() => {
    if (!blattbereich) return;
    const messen = () =>
      setBereich({ breite: blattbereich.clientWidth, hoehe: blattbereich.clientHeight });
    messen();
    const beobachter = new ResizeObserver(messen);
    beobachter.observe(blattbereich);
    return () => beobachter.disconnect();
  }, [blattbereich]);

  // ── Die Größe der Seite selbst ──
  useEffect(() => {
    const knoten = rahmen.current;
    if (!knoten) return;
    const messen = () => setRahmenBreite(knoten.clientWidth);
    messen();
    const beobachter = new ResizeObserver(messen);
    beobachter.observe(knoten);
    return () => beobachter.disconnect();
  }, [isMobile]);

  const beispielwerte = useMemo(() => {
    const heute = new Date();
    const spaeter = new Date(heute.getTime() + 14 * 86_400_000);
    // Mit führenden Nullen: Auf einer Rechnung steht 27.08.2026, nicht 27.8.2026.
    const datum = (d: Date) =>
      d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const anschrift = [profil.profile_street, [profil.profile_zip, profil.profile_city].filter(Boolean).join(' ')]
      .filter(Boolean)
      .join(', ');
    const gutschrift = vorlage?.art === 'gutschrift';

    return {
      sender_name: profil.profile_name || 'Dein Name',
      // Einzeilig: Diese Angabe steht auch in der schmalen Absenderzeile über
      // dem Anschriftfeld, und dort ist für einen Umbruch kein Platz.
      sender_address: anschrift || profil.profile_address || 'Musterstraße 1, 12345 Musterstadt',
      sender_email: profil.profile_email,
      sender_phone: profil.profile_phone,
      sender_tax_number: profil.profile_tax_number,
      sender_w_idnr: profil.profile_w_idnr,
      sender_vat_id: profil.profile_vat_id,
      sender_finanzamt: profil.profile_finanzamt,
      sender_iban: profil.profile_iban || 'DE02 1203 0000 0000 2020 51',
      sender_bic: profil.profile_bic || 'BYLADEM1001',
      receiver_name: 'Muster & Partner GmbH',
      receiver_address: 'Frau Anna Beispiel\nLindenstraße 14\n10115 Berlin',
      customer_number: 'K-1042',
      doc_number: gutschrift ? 'GS-2026-0007' : 'RE-2026-0042',
      doc_date: datum(heute),
      due_date: datum(spaeter),
      delivery_date: datum(heute),
      payment_terms: `Zahlbar ohne Abzug bis zum ${datum(spaeter)}.`,
      legal_notice:
        steuerregelung === 'kleinunternehmer'
          ? 'Steuerfreie Leistung eines Kleinunternehmers nach § 19 UStG.'
          : 'Es gilt das Leistungsdatum als Zeitpunkt der Lieferung bzw. Leistung.',
      notes:
        'Sehr geehrte Frau Beispiel,\n\nvielen Dank für Ihren Auftrag. Wie besprochen stelle ich Ihnen die folgenden Leistungen in Rechnung.',
    } as Record<string, string>;
  }, [profil, steuerregelung, vorlage?.art]);

  const layout = useMemo(() => {
    if (!vorlage) return null;
    return layoutRechnung({ vorlage, werte: beispielwerte, positionen: BEISPIEL_POSITIONEN });
  }, [vorlage, beispielwerte]);

  // ── Maßstab der Vorschau ──
  const rand = isMobile ? 24 : 64;
  const passendermassstab = useMemo(() => {
    if (bereich.breite === 0) return PIXEL_JE_MM;
    const nachBreite = (bereich.breite - rand) / A4_BREITE;
    // Am Desktop soll zu Beginn eine ganze Seite zu sehen sein, am Handy zählt
    // die Breite – dort scrollt man ohnehin.
    if (isMobile) return Math.max(0.5, nachBreite);
    const nachHoehe = (bereich.hoehe - rand) / A4_HOEHE;
    return Math.max(0.5, Math.min(nachBreite, nachHoehe));
  }, [bereich, isMobile, rand]);

  const massstab = zoom === 'passend' ? passendermassstab : (zoom / 100) * PIXEL_JE_MM;
  const zoomProzent = Math.round((massstab / PIXEL_JE_MM) * 100);

  const setzeProzent = useCallback((p: number) => setZoom(Math.round(p)), []);

  // Doppeltippen bringt einen an die Schrift heran und beim zweiten Mal wieder
  // aufs ganze Blatt zurück.
  const doppeltippen = useCallback(() => {
    setZoom((vorher) => (vorher === 'passend' ? 100 : 'passend'));
  }, []);

  // Am Handy passt eine A4-Seite nur bei rund 44 Prozent in die Breite, und
  // dann ist der Fließtext vier Pixel groß. Lesbar wird das erst, wenn man wie
  // in jedem Dokumentenbetrachter mit zwei Fingern hineingehen kann.
  const { merkeStelle } = useKneifzoom({
    knoten: blattbereich,
    massstab,
    prozent: zoomProzent,
    setzeProzent,
    aufDoppeltippen: doppeltippen,
    min: ZOOM_MIN,
    max: ZOOM_MAX,
    aktiv: isMobile,
  });

  // Der neue Wert muss aus dem vorigen Zustand kommen, nicht aus dem gerade
  // gerenderten. Wer am Handy fünfmal schnell hintereinander tippt, löst fünf
  // Änderungen in einem Rutsch aus – die lasen vorher alle denselben veralteten
  // Prozentwert, und aus fünf Schritten wurde einer. Genau das sah aus, als
  // täte der Zoom nichts.
  const zoomen = useCallback((richtung: 1 | -1) => {
    // Auch der Knopf braucht einen Anker. Ohne ihn wächst das Blatt nach rechts
    // unten aus dem Fenster, weil der Scrollstand stehen bleibt – man drückt
    // auf „Größer" und verliert dabei die Stelle, die man ansieht. Gehalten
    // wird die Mitte des Sichtfensters.
    if (blattbereich) {
      const r = blattbereich.getBoundingClientRect();
      merkeStelle(r.left + r.width / 2, r.top + r.height / 2);
    }
    setZoom((vorher) => naechsteStufe(
      vorher === 'passend' ? Math.round((passendermassstab / PIXEL_JE_MM) * 100) : vorher,
      richtung,
    ));
  }, [passendermassstab, blattbereich, merkeStelle]);

  // ── Änderungen ──
  //
  // Es gibt keinen Speichern-Knopf: Jede Änderung geht sofort in den Speicher.
  // Nur mitgelieferte Vorlagen sind geschützt – die erste Änderung legt still
  // eine eigene Kopie an und arbeitet darin weiter.
  const eigeneVorlage = (): string | null => {
    if (!vorlage) return null;
    if (!vorlage.mitgeliefert) return vorlage.id;

    // Bewusst nicht `kopiere`: Das vergibt neue Kennungen für die Bausteine,
    // und dann zeigte das gerade offene Einstellfeld ins Leere. Flach kopiert
    // reicht, weil alle Änderungen am Baum neue Äste bauen statt zu verändern.
    const jetzt = new Date().toISOString();
    const gabelung: Rechnungsvorlage = {
      ...vorlage,
      id: Math.random().toString(36).slice(2, 10),
      name: `${vorlage.name} (Kopie)`,
      mitgeliefert: false,
      gestaltung: { ...vorlage.gestaltung },
      bausteine: vorlage.bausteine.map((b) => ({ ...b })),
      erstelltAm: jetzt,
      geaendertAm: jetzt,
    };
    hinzufuegen(gabelung);
    setOffeneVorlage(gabelung.id);
    toast.info(`„${vorlage.name}" ist mitgeliefert`, {
      description: `Deine Änderungen laufen ab jetzt in „${gabelung.name}" – die Vorlage bleibt unangetastet.`,
    });
    return gabelung.id;
  };

  const mitZiel = (tun: (id: string) => void) => {
    const id = eigeneVorlage();
    if (id) tun(id);
  };

  const sensoren = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  /**
   * Sortiert per Ziehen um. Beide Bausteine müssen in derselben Liste liegen –
   * über Ebenen hinweg zu ziehen ginge zwar, träfe aber am Handy nie und
   * müsste zusätzlich prüfen, ob der Baustein überhaupt in eine Spalte darf.
   * Dafür ist das Menü der Zeile da.
   */
  const sortiert = (ereignis: DragEndEvent) => {
    const { active, over } = ereignis;
    if (!vorlage || !over || active.id === over.id) return;
    const her = listeVon(vorlage.bausteine, String(active.id));
    const hin = listeVon(vorlage.bausteine, String(over.id));
    if (!her || !hin || her.spalteId !== hin.spalteId) return;
    const von = her.bausteine.findIndex((b) => b.id === active.id);
    const nach = hin.bausteine.findIndex((b) => b.id === over.id);
    if (von < 0 || nach < 0) return;
    mitZiel((id) => bausteinVerschieben(id, her.spalteId, von, nach));
  };

  /**
   * Lädt das Logo und misst dabei gleich sein Seitenverhältnis. Vorher stand
   * dafür ein fester Wert im Layout, und hohe Logos wurden in die Breite
   * gezogen.
   */
  const logoLaden = (datei: File | undefined) => {
    if (!datei) return;
    if (datei.size > 2_000_000) {
      toast.error('Das Logo ist größer als 2 MB', { description: 'Ein kleineres Bild lädt schneller und druckt genauso gut.' });
      return;
    }
    const leser = new FileReader();
    leser.onload = () => {
      const daten = String(leser.result);
      const bild = new Image();
      const uebernehmen = (verhaeltnis?: number) =>
        mitZiel((id) => gestaltungAendern(id, { logo: daten, logoVerhaeltnis: verhaeltnis }));
      bild.onload = () =>
        uebernehmen(bild.naturalHeight > 0 ? bild.naturalWidth / bild.naturalHeight : undefined);
      bild.onerror = () => uebernehmen(undefined);
      bild.src = daten;
    };
    leser.onerror = () => toast.error('Das Bild konnte nicht gelesen werden');
    leser.readAsDataURL(datei);
  };

  const bausteinEinfuegen = (typ: BausteinTyp) => {
    mitZiel((id) => {
      const neuer = neuerBaustein(typ);
      bausteinHinzufuegen(id, neuer, auswahlZiel);
      setGewaehlterBaustein(neuer.id);
    });
    setAuswahlOffen(false);
  };

  const vorlageAnlegen = () => {
    const name = neuName.trim() || (neuArt === 'rechnung' ? 'Meine Rechnung' : 'Meine Gutschrift');
    const neu = leereVorlage(name, neuArt);
    hinzufuegen(neu);
    setOffeneVorlage(neu.id);
    setGewaehlterBaustein(null);
    setNeuOffen(false);
    setNeuName('');
    toast.success(`„${name}" angelegt`);
  };

  const vorlageKopieren = () => {
    if (!vorlage) return;
    const kopie = kopiere(vorlage, `${vorlage.name} (Kopie)`);
    hinzufuegen(kopie);
    setOffeneVorlage(kopie.id);
    setGewaehlterBaustein(null);
    toast.success(`„${kopie.name}" angelegt`);
  };

  // Eine eigene Vorlage ist Arbeit, und gelöscht ist sie endgültig – dafür
  // reicht ein einzelner Klick auf ein Mülleimer-Symbol nicht.
  const vorlageLoeschen = () => {
    if (!vorlage || vorlage.mitgeliefert) return;
    const name = vorlage.name;
    loeschen(vorlage.id);
    setOffeneVorlage(vorlagen.find((v) => v.id !== vorlage.id)?.id ?? null);
    setGewaehlterBaustein(null);
    setLoeschenOffen(false);
    toast.success(`„${name}" gelöscht`);
  };

  const vorlageZuruecksetzen = () => {
    if (!vorlage) return;
    zuruecksetzen(vorlage.id);
    setGewaehlterBaustein(null);
    toast.success(`„${vorlage.name}" auf den Auslieferungsstand zurückgesetzt`);
  };

  // Eine mitgelieferte Vorlage trägt ihren Namen fest. Statt sie über die
  // automatische Kopie umzubenennen – wobei der Nutzer eine Meldung über
  // „Klar (Kopie)" läse, die einen Wimpernschlag später nicht mehr stimmt –
  // entsteht sie hier gleich unter dem gewünschten Namen als eigene Vorlage.
  const vorlageUebernehmen = () => {
    const name = neuerTitel.trim();
    if (!vorlage || !name) return;
    if (vorlage.mitgeliefert) {
      const kopie = { ...kopiere(vorlage, name), art: neueArt };
      hinzufuegen(kopie);
      setOffeneVorlage(kopie.id);
      setGewaehlterBaustein(null);
      toast.success(`„${name}" angelegt`, {
        description: `„${vorlage.name}" ist mitgeliefert und bleibt unverändert daneben stehen.`,
      });
    } else {
      aendern(vorlage.id, { name, art: neueArt });
    }
    setBearbeitenOffen(false);
  };

  // Die Kennung steht in der Adresse, damit „Rechnung schreiben" mit genau
  // dieser Vorlage aufgeht. Merken tut sich der Speicher sie zusätzlich, damit
  // der Baukasten beim Zurückkommen wieder dort steht, wo man ihn verlassen hat.
  const rechnungSchreiben = () => {
    if (!vorlage) return;
    setOffeneVorlage(vorlage.id);
    navigate(`/write-invoice?vorlage=${encodeURIComponent(vorlage.id)}`);
  };

  if (!vorlage) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
        Keine Vorlage vorhanden.
      </div>
    );
  }

  const g = vorlage.gestaltung;

  // ── Was es in dieser Vorlage schon gibt ──
  const vorhandeneTypen = belegteTypen(vorlage.bausteine);
  const offenerBaustein = bausteinSuchen(vorlage.bausteine, gewaehlterBaustein ?? '');
  const ziele = spaltenZiele(vorlage.bausteine);
  const spaltenBausteine = alleBausteine(vorlage.bausteine).filter((b) => b.typ === 'spalten').length;

  // ── Aufbau: die Liste der Bausteine ──
  const listenAktionen: ListenAktionen = {
    gewaehlt: gewaehlterBaustein,
    waehlen: setGewaehlterBaustein,
    schalten: (id, an) => mitZiel((v) => bausteinAendern(v, id, { aus: !an })),
    loeschen: (id) => {
      mitZiel((v) => bausteinLoeschen(v, id));
      if (gewaehlterBaustein === id) setGewaehlterBaustein(null);
    },
    umhaengen: (id, spalteId) => mitZiel((v) => bausteinUmhaengenIn(v, id, spalteId)),
    hinzufuegen: (spalteId) => { setAuswahlZiel(spalteId); setAuswahlOffen(true); },
    aendern: (id, patch) => mitZiel((v) => bausteinAendern(v, id, patch)),
    spalteHinzufuegen: (spaltenId) => mitZiel((v) => spalteHinzufuegen(v, spaltenId)),
    spalteEntfernen: (spaltenId, spalteId) => mitZiel((v) => spalteEntfernen(v, spaltenId, spalteId)),
    ziele,
    spaltenBausteine,
    einstellungen: (b) => (
      <BausteinEinstellungen
        baustein={b}
        g={g}
        aendern={(patch) => mitZiel((v) => bausteinAendern(v, b.id, patch))}
      />
    ),
  };

  const aufbau = (
    <div className="space-y-4">
      <DndContext sensors={sensoren} collisionDetection={closestCenter} onDragEnd={sortiert}>
        <Bausteinliste bausteine={vorlage.bausteine} spalteId={null} aktionen={listenAktionen} />
      </DndContext>

      <p className={cn('px-1 leading-snug text-muted-foreground', isMobile ? 'text-[13px]' : 'text-[11px]')}>
        Am Griff links ziehst du einen Baustein an eine andere Stelle. Über das Menü rechts wandert er in
        eine Spalte – oder wieder heraus.
      </p>

      <Button
        variant="outline"
        className={isMobile ? 'h-[50px] w-full text-[17px]' : 'w-full'}
        onClick={() => { setAuswahlZiel(null); setAuswahlOffen(true); }}
      >
        <Plus /> Baustein hinzufügen
      </Button>
    </div>
  );

  // ── Aussehen: was für das ganze Blatt gilt ──
  const aussehen = (
    <div className={isMobile ? 'space-y-6' : 'space-y-3'}>
      <Feldgruppe titel="Farben">
        <Farbzeile
          label="Akzent"
          hinweis="Titel, Tabellenkopf und Linien"
          wert={g.akzent}
          setzen={(v) => { if (v) mitZiel((id) => gestaltungAendern(id, { akzent: v })); }}
        />
        <Farbzeile
          label="Text"
          wert={g.text}
          setzen={(v) => { if (v) mitZiel((id) => gestaltungAendern(id, { text: v })); }}
        />
        <Farbzeile
          label="Gedämpft"
          hinweis="Beschriftungen und Fußzeile"
          wert={g.gedaempft}
          setzen={(v) => { if (v) mitZiel((id) => gestaltungAendern(id, { gedaempft: v })); }}
        />
      </Feldgruppe>

      <Feldgruppe titel="Schrift" fuss="Alle anderen Größen leiten sich hiervon ab – Überschriften größer, Beschriftungen kleiner.">
        <Feldzeile label="Schriftart">
          <Select
            value={g.schriftart}
            onValueChange={(v) => mitZiel((id) => gestaltungAendern(id, { schriftart: v }))}
          >
            <SelectTrigger className={isMobile ? 'h-9 w-44' : 'h-8 w-40 text-xs'}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SCHRIFTEN.map((s) => (
                <SelectItem key={s.wert} value={s.wert}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Feldzeile>
        <Reglerzeile
          label="Grundgröße"
          wert={g.schriftgroesse}
          min={7} max={14} schritt={0.5} einheit="pt"
          setzen={(v) => mitZiel((id) => gestaltungAendern(id, { schriftgroesse: v }))}
        />
        <Reglerzeile
          label="Zeilenabstand"
          hinweis="Vielfaches der Schriftgröße"
          wert={g.zeilenabstand ?? 1.35}
          min={1} max={2.4} schritt={0.05} einheit="×"
          setzen={(v) => mitZiel((id) => gestaltungAendern(id, { zeilenabstand: v }))}
        />
      </Feldgruppe>

      <Feldgruppe titel="Seitenränder" fuss="Für Fensterumschläge sind 25 mm links und 20 mm rechts üblich (DIN 5008).">
        <Vollzeile>
          <div className="flex flex-wrap gap-1.5">
            {[
              { label: 'Eng', werte: { randOben: 15, randUnten: 12, randLinks: 18, randRechts: 15 } },
              { label: 'Normal', werte: { randOben: 20, randUnten: 18, randLinks: 25, randRechts: 20 } },
              { label: 'Weit', werte: { randOben: 28, randUnten: 24, randLinks: 30, randRechts: 28 } },
            ].map((satz) => (
              <Marke
                key={satz.label}
                label={satz.label}
                an={
                  g.randOben === satz.werte.randOben && g.randUnten === satz.werte.randUnten &&
                  g.randLinks === satz.werte.randLinks && g.randRechts === satz.werte.randRechts
                }
                umschalten={() => mitZiel((id) => gestaltungAendern(id, satz.werte))}
              />
            ))}
          </div>
        </Vollzeile>
        <Reglerzeile label="Oben" wert={g.randOben} min={5} max={45} einheit="mm" setzen={(v) => mitZiel((id) => gestaltungAendern(id, { randOben: v }))} />
        <Reglerzeile label="Unten" wert={g.randUnten} min={5} max={45} einheit="mm" setzen={(v) => mitZiel((id) => gestaltungAendern(id, { randUnten: v }))} />
        <Reglerzeile label="Links" wert={g.randLinks} min={5} max={45} einheit="mm" setzen={(v) => mitZiel((id) => gestaltungAendern(id, { randLinks: v }))} />
        <Reglerzeile label="Rechts" wert={g.randRechts} min={5} max={45} einheit="mm" setzen={(v) => mitZiel((id) => gestaltungAendern(id, { randRechts: v }))} />
      </Feldgruppe>

      <Feldgruppe titel="Abstände" fuss="Gilt zwischen zwei Bausteinen, solange keiner davon etwas anderes sagt.">
        <Reglerzeile
          label="Zwischen Bausteinen"
          wert={g.bausteinAbstand}
          min={0} max={25} einheit="mm"
          setzen={(v) => mitZiel((id) => gestaltungAendern(id, { bausteinAbstand: v }))}
        />
      </Feldgruppe>

      <Feldgruppe titel="Logo" fuss="PNG mit durchsichtigem Hintergrund sieht auf dem Ausdruck am besten aus.">
        <Vollzeile>
          {g.logo ? (
            <div className="space-y-2">
              <div className="flex items-center justify-center rounded-lg border border-border bg-white p-3">
                <img src={g.logo} alt="Logo" className="max-h-20 max-w-full object-contain" />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className={cn('flex-1', isMobile && 'h-11 text-[15px]')}
                  onClick={() => logoFeld.current?.click()}
                >
                  Anderes Logo
                </Button>
                <Button
                  variant="destructive"
                  className={cn('flex-1', isMobile && 'h-11 text-[15px]')}
                  onClick={() => mitZiel((id) => gestaltungAendern(id, { logo: '' }))}
                >
                  Entfernen
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              className={cn('w-full', isMobile && 'h-12 text-[17px]')}
              onClick={() => logoFeld.current?.click()}
            >
              <ImagePlus /> Logo hochladen
            </Button>
          )}
          <input
            ref={logoFeld}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml"
            className="hidden"
            onChange={(e) => { logoLaden(e.target.files?.[0]); e.target.value = ''; }}
          />
        </Vollzeile>
        <Reglerzeile
          label="Seitenverhältnis"
          hinweis="Breite geteilt durch Höhe – beim Hochladen gemessen"
          wert={Math.round((g.logoVerhaeltnis ?? 2.6) * 100) / 100}
          min={0.2} max={8} schritt={0.05} einheit=":1"
          setzen={(v) => mitZiel((id) => gestaltungAendern(id, { logoVerhaeltnis: v }))}
        />
      </Feldgruppe>
    </div>
  );

  // ── Die Vorschau ──
  const zoomleiste = (
    // Rechts blieb Platz für den schwebenden KI-Knopf – aber nur am Desktop:
    // Am Handy wird der gar nicht erst gerendert, und die 64 Pixel hielten dort
    // Platz für nichts frei, während die Knöpfe daneben zusammenrückten.
    //
    // Unten ebenso. Im Apple-Theme ist die Navigationsleiste keine Leiste am
    // Rand, sondern eine Kapsel, die über dem Inhalt schwebt – und die lag
    // genau auf diesen Knöpfen. Den Platz dafür kennt --app-main-pb. Wo es die
    // Variable nicht gibt, steht die Leiste im Fluss darunter und kein Sockel
    // ist nötig – deshalb 0 statt eines geratenen Wertes.
    <div
      className={cn(
        'flex shrink-0 items-center gap-1.5 border-t border-border bg-background py-1.5 pl-3',
        isMobile ? 'pr-3' : 'pr-16',
      )}
      style={isMobile ? { paddingBottom: 'var(--app-main-pb, 0px)' } : undefined}
    >
      <span className="mr-auto truncate text-xs text-muted-foreground">
        {isMobile ? '' : 'DIN A4 · '}
        {layout?.seiten.length ?? 1} {(layout?.seiten.length ?? 1) === 1 ? 'Seite' : 'Seiten'}
      </span>
      {/* Am Handy sind das Fingerziele, keine Mausziele – 28 Pixel trifft man
          nicht zuverlässig. */}
      <Button
        variant="ghost" size="icon-sm" aria-label="Kleiner"
        className={cn(isMobile && 'h-11 w-11')}
        disabled={zoomProzent <= ZOOM_MIN}
        onClick={() => zoomen(-1)}
      >
        <Minus />
      </Button>
      <span className="w-11 text-center text-xs tabular-nums">{zoomProzent} %</span>
      <Button
        variant="ghost" size="icon-sm" aria-label="Größer"
        className={cn(isMobile && 'h-11 w-11')}
        disabled={zoomProzent >= ZOOM_MAX}
        onClick={() => zoomen(1)}
      >
        <Plus />
      </Button>
      <Button
        variant={zoom === 'passend' ? 'secondary' : 'ghost'}
        size="sm"
        className={cn(isMobile && 'h-11')}
        onClick={() => setZoom('passend')}
      >
        <ZoomIn /> Passend
      </Button>
    </div>
  );

  const vorschau = (
    <>
      <div
        ref={setBlattbereich}
        className="min-h-0 flex-1 overflow-auto overscroll-contain bg-muted/40"
        // Wischen soll scrollen, Aufziehen dagegen nur das Blatt vergrößern und
        // nicht die ganze Oberfläche – deshalb nimmt der Webview hier die Hände
        // vom Zoom und `useKneifzoom` rechnet ihn selbst.
        style={isMobile ? { touchAction: 'pan-x pan-y' } : undefined}
      >
        <div className={cn('flex min-h-full w-fit min-w-full justify-center', isMobile ? 'p-3' : 'p-8')}>
          {/*
            Kein `aktiverBaustein`: Die fertigen Kästen tragen keine Kennung
            mehr, aus der sich ihr Baustein ablesen ließe. Hervorgehoben wird
            deshalb in der Liste, nicht auf dem Blatt.
          */}
          <Blattvorschau
            seiten={layout?.seiten ?? []}
            schriftart={g.schriftart}
            massstab={massstab}
          />
        </div>
      </div>
      {zoomleiste}
    </>
  );

  // ── Die Vorlagenwahl ──
  const vorlagenzeilen = (
    <ListGroup title="Vorlagen">
      {vorlagen.map((v) => (
        <ListRow
          key={v.id}
          label={v.name}
          hint={v.art === 'gutschrift' ? 'Gutschrift' : 'Rechnung'}
          active={v.id === vorlage.id}
          onClick={() => {
            setOffeneVorlage(v.id);
            setGewaehlterBaustein(null);
            setVorlagenlisteOffen(false);
          }}
        />
      ))}
    </ListGroup>
  );

  const bearbeitenOeffnen = () => {
    setNeuerTitel(vorlage.name);
    setNeueArt(vorlage.art);
    setBearbeitenOffen(true);
  };

  const vorlagenaktionen = (
    <ListGroup title="Diese Vorlage">
      <ListRow icon={<Plus />} tint="blue" label="Neue Vorlage" noChevron onClick={() => { setVorlagenlisteOffen(false); setNeuOffen(true); }} />
      <ListRow icon={<Copy />} tint="teal" label="Kopieren" noChevron onClick={() => { vorlageKopieren(); setVorlagenlisteOffen(false); }} />
      <ListRow
        icon={<Pencil />} tint="gray" label="Name und Art" noChevron
        onClick={() => { setVorlagenlisteOffen(false); bearbeitenOeffnen(); }}
      />
      {vorlage.mitgeliefert ? (
        <ListRow icon={<RotateCcw />} tint="orange" label="Auf Auslieferungsstand zurücksetzen" noChevron onClick={() => { vorlageZuruecksetzen(); setVorlagenlisteOffen(false); }} />
      ) : (
        <ListRow icon={<Trash2 />} tint="red" label="Löschen" destructive noChevron onClick={() => { setVorlagenlisteOffen(false); setLoeschenOffen(true); }} />
      )}
    </ListGroup>
  );

  // ── Dialoge, die beide Fassungen teilen ──
  const dialoge = (
    <>
      <ConfirmDialog
        open={loeschenOffen}
        title={`„${vorlage.name}" löschen?`}
        description="Die Vorlage ist danach weg. Rechnungen, die du damit geschrieben hast, bleiben erhalten."
        confirmLabel="Löschen"
        destructive
        onConfirm={vorlageLoeschen}
        onCancel={() => setLoeschenOffen(false)}
      />

      <ResponsiveModal
        open={auswahlOffen}
        onClose={() => setAuswahlOffen(false)}
        title="Baustein hinzufügen"
        description={
          auswahlZiel === null
            ? 'Der neue Baustein kommt ans Ende – ziehen kannst du ihn danach.'
            : 'Der neue Baustein kommt in die gewählte Spalte.'
        }
        desktopClassName="max-w-md"
      >
        <div className="space-y-5">
          {TYP_GRUPPEN.map((gruppe) => (
            <div key={gruppe.titel} className="space-y-1.5">
              <h3 className="px-1 text-[13px] font-medium text-muted-foreground">{gruppe.titel}</h3>
              {gruppe.typen.map((typ) => {
                const belegt = NUR_EINMAL.includes(typ) && vorhandeneTypen.has(typ);
                const zuBreit = auswahlZiel !== null && NICHT_IN_SPALTEN.includes(typ);
                const gesperrt = belegt || zuBreit;
                return (
                  <button
                    key={typ}
                    type="button"
                    disabled={gesperrt}
                    onClick={() => bausteinEinfuegen(typ)}
                    className={cn(
                      'w-full rounded-lg border border-border bg-card px-3 py-2.5 text-left transition-colors',
                      gesperrt ? 'opacity-40' : 'hover:border-primary/40 hover:bg-muted',
                    )}
                  >
                    <span className="block text-[15px] font-medium">{BAUSTEIN_LABELS[typ]}</span>
                    <span className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">
                      {zuBreit
                        ? 'Braucht die volle Seitenbreite und passt nicht in eine Spalte.'
                        : belegt
                          ? 'Kommt nur einmal vor und ist schon da.'
                          : BAUSTEIN_BESCHREIBUNG[typ]}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </ResponsiveModal>

      <ResponsiveModal
        open={neuOffen}
        onClose={() => setNeuOffen(false)}
        title="Neue Vorlage"
        description="Du beginnst mit dem üblichen Aufbau einer deutschen Rechnung und änderst ihn danach."
      >
        <div className="space-y-4">
          <FormGroup>
            <FormFullRow>
              <span className="mb-1 block text-[13px] text-muted-foreground">Name</span>
              <input
                autoFocus
                value={neuName}
                onChange={(e) => setNeuName(e.target.value)}
                placeholder="Meine Rechnung"
                className="w-full bg-transparent text-[17px] outline-none placeholder:text-muted-foreground/60"
              />
            </FormFullRow>
            <FormFullRow>
              <Segmented
                value={neuArt}
                onChange={setNeuArt}
                options={[{ value: 'rechnung', label: 'Rechnung' }, { value: 'gutschrift', label: 'Gutschrift' }]}
              />
            </FormFullRow>
          </FormGroup>
          <Button className="h-[50px] w-full text-[17px] font-semibold" onClick={vorlageAnlegen}>Anlegen</Button>
        </div>
      </ResponsiveModal>

      <ResponsiveModal
        open={bearbeitenOffen}
        onClose={() => setBearbeitenOffen(false)}
        title="Name und Art"
        description="Die Art entscheidet, ob die Vorschau eine Rechnung oder eine Gutschrift zeigt."
      >
        <div className="space-y-4">
          <FormGroup>
            <FormFullRow>
              <input
                autoFocus
                value={neuerTitel}
                onChange={(e) => setNeuerTitel(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') vorlageUebernehmen(); }}
                className="w-full bg-transparent text-[17px] outline-none"
              />
            </FormFullRow>
            <FormFullRow>
              <Segmented
                value={neueArt}
                onChange={setNeueArt}
                options={[{ value: 'rechnung', label: 'Rechnung' }, { value: 'gutschrift', label: 'Gutschrift' }]}
              />
            </FormFullRow>
          </FormGroup>
          <Button className="h-[50px] w-full text-[17px] font-semibold" onClick={vorlageUebernehmen}>Übernehmen</Button>
        </div>
      </ResponsiveModal>

      <ResponsiveModal open={vorlagenlisteOffen} onClose={() => setVorlagenlisteOffen(false)} title="Vorlage">
        <div className="space-y-6">
          {vorlagenzeilen}
          {vorlagenaktionen}
        </div>
      </ResponsiveModal>

      <ResponsiveModal
        open={isMobile && offenerBaustein !== null}
        onClose={() => setGewaehlterBaustein(null)}
        title={offenerBaustein ? BAUSTEIN_LABELS[offenerBaustein.typ] : ''}
        description={offenerBaustein ? BAUSTEIN_BESCHREIBUNG[offenerBaustein.typ] : undefined}
        closeLabel="Fertig"
      >
        {offenerBaustein && (
          <BausteinEinstellungen
            baustein={offenerBaustein}
            g={g}
            aendern={(patch) => mitZiel((id) => bausteinAendern(id, offenerBaustein.id, patch))}
            entfernen={() => {
              mitZiel((id) => bausteinLoeschen(id, offenerBaustein.id));
              setGewaehlterBaustein(null);
            }}
          />
        )}
      </ResponsiveModal>
    </>
  );

  // ── Handy ──
  //
  // Drei Ansichten hintereinander statt drei Spalten nebeneinander. Der
  // Umschalter oben ist die einzige Navigation, die es dafür braucht.
  if (isMobile) {
    return (
      <HandyKontext.Provider value>
        <div className="flex h-full flex-col overflow-hidden">
          <div className="shrink-0 space-y-3 px-4 pb-3">
            <PageHeader
              title="Vorlagen"
              subtitle={vorlage.name}
              actions={
                // Ein Stift verspricht „umbenennen". Hier wird gewechselt, und
                // dafür ist das Zeichen der Auswahlfelder das richtige.
                //
                // Beschriftet und 44 Pixel hoch: Hinter diesem einen Knopf
                // liegen Vorlagenwechsel, Kopieren, Umbenennen und Löschen –
                // als unbeschriftetes 32-Pixel-Symbol war das weder zu finden
                // noch zuverlässig zu treffen.
                <Button
                  variant="outline"
                  className="h-11 gap-1.5 px-3 text-[15px]"
                  onClick={() => setVorlagenlisteOffen(true)}
                >
                  Wechseln
                  <ChevronsUpDown className="h-4 w-4" />
                </Button>
              }
            />
            {/* Beim Blick auf das Blatt ändert man nichts – dort ist der Hinweis
                nur eine Zeile, die dem Blatt Platz wegnimmt. */}
            {vorlage.mitgeliefert && reiter !== 'vorschau' && (
              <p className="text-[13px] leading-snug text-muted-foreground">
                Mitgelieferte Vorlage – die erste Änderung legt automatisch eine eigene Kopie an.
              </p>
            )}
            <Segmented
              value={reiter}
              onChange={setReiter}
              options={[
                { value: 'aufbau', label: 'Aufbau' },
                { value: 'aussehen', label: 'Aussehen' },
                { value: 'vorschau', label: 'Vorschau' },
              ]}
            />
          </div>

          {reiter === 'vorschau' ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{vorschau}</div>
          ) : (
            <div
              className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-4"
              style={{ paddingBottom: 'var(--app-main-pb, 2rem)' }}
            >
              {reiter === 'aufbau' ? aufbau : aussehen}
              <Button variant="secondary" className="h-[50px] w-full text-[17px]" onClick={rechnungSchreiben}>
                <FilePlus2 /> Rechnung damit schreiben
              </Button>
            </div>
          )}

          {dialoge}
        </div>
      </HandyKontext.Provider>
    );
  }

  // ── Desktop ──
  //
  // Zwei Spalten: links gebaut, rechts gesehen. Die Vorschau bekommt alles,
  // was übrig bleibt – vorher war es genau andersherum.
  return (
    <HandyKontext.Provider value={false}>
      <div ref={rahmen} className="flex h-full overflow-hidden">
        <aside
          className={cn(
            'flex flex-col overflow-hidden border-border bg-background',
            eng
              ? reiter === 'vorschau' ? 'hidden' : 'min-w-0 flex-1'
              : 'w-[380px] shrink-0 border-r',
          )}
        >
          <div data-tutorial="designer-template-list" className="shrink-0 space-y-2 border-b border-border p-3">
            <Select
              value={vorlage.id}
              onValueChange={(v) => { setOffeneVorlage(v); setGewaehlterBaustein(null); }}
            >
              <SelectTrigger className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {vorlagen.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.name}{v.art === 'gutschrift' ? ' · Gutschrift' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex gap-1">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => setNeuOffen(true)} title="Neue Vorlage anlegen">
                <Plus /> Neu
              </Button>
              <Button variant="outline" size="icon-sm" onClick={vorlageKopieren} title="Vorlage kopieren">
                <Copy />
              </Button>
              <Button variant="outline" size="icon-sm" title="Name und Art ändern" onClick={bearbeitenOeffnen}>
                <Pencil />
              </Button>
              {vorlage.mitgeliefert ? (
                <Button variant="outline" size="icon-sm" onClick={vorlageZuruecksetzen} title="Auf Auslieferungsstand zurücksetzen">
                  <RotateCcw />
                </Button>
              ) : (
                <Button variant="outline" size="icon-sm" onClick={() => setLoeschenOffen(true)} title="Vorlage löschen">
                  <Trash2 className="text-destructive" />
                </Button>
              )}
            </div>

            <Button variant="secondary" size="sm" className="w-full" onClick={rechnungSchreiben}>
              <FilePlus2 /> Rechnung damit schreiben
            </Button>

            {vorlage.mitgeliefert && (
              <p className="px-0.5 text-[11px] leading-snug text-muted-foreground">
                Mitgelieferte Vorlage – die erste Änderung legt automatisch eine eigene Kopie an.
              </p>
            )}
          </div>

          <div className="shrink-0 px-3 pt-3">
            <Segmented
              value={reiter}
              onChange={setReiter}
              options={
                eng
                  ? [
                    { value: 'aufbau', label: 'Aufbau' },
                    { value: 'aussehen', label: 'Aussehen' },
                    { value: 'vorschau', label: 'Vorschau' },
                  ]
                  : [{ value: 'aufbau', label: 'Aufbau' }, { value: 'aussehen', label: 'Aussehen' }]
              }
            />
          </div>

          <div data-tutorial="designer-toolbar" className="min-h-0 flex-1 overflow-y-auto p-3">
            {reiter === 'aussehen' ? aussehen : aufbau}
          </div>
        </aside>

        <main
          data-tutorial="designer-canvas"
          className={cn(
            'flex min-w-0 flex-1 flex-col overflow-hidden',
            eng && reiter !== 'vorschau' && 'hidden',
          )}
        >
          {eng && (
            // Im schmalen Fenster ist die Vorschau eine eigene Ansicht – der
            // Weg zurück zum Aufbau muss dann sichtbar sein.
            <div className="shrink-0 border-b border-border bg-background p-3">
              <Segmented
                value={reiter}
                onChange={setReiter}
                options={[
                  { value: 'aufbau', label: 'Aufbau' },
                  { value: 'aussehen', label: 'Aussehen' },
                  { value: 'vorschau', label: 'Vorschau' },
                ]}
              />
            </div>
          )}
          {vorschau}
        </main>

        {dialoge}
      </div>
    </HandyKontext.Provider>
  );
}
