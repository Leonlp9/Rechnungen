// ─── Node Types ────────────────────────────────────────────────────────────────

export type ElementType =
  | 'kpi-einnahmen-ytd'
  | 'kpi-ausgaben-ytd'
  | 'kpi-saldo-ytd'
  | 'kpi-betriebsergebnis'
  | 'kpi-belege-30d'
  | 'kpi-einnahmen-monat'
  | 'kpi-ausgaben-monat'
  | 'kpi-saldo-monat'
  | 'kpi-saldo-prognose'
  | 'chart-revenue'
  | 'chart-category-donut'
  | 'chart-last28days'
  | 'chart-month'
  | 'card-sonderausgaben'
  | 'list-forecast'
  | 'list-forecast-28d'
  | 'list-recent-emails'
  | 'list-recent-invoices'
  | 'chart-cashflow'
  | 'list-top-ausgaben'
  | 'list-top-partner'
  | 'kpi-ust-jahr'
  | 'kpi-avg-einnahmen-monat'
  | 'kpi-avg-ausgaben-monat'
  | 'kpi-marge'
  | 'kpi-steuerruecklage'
  | 'list-top-einnahmen'
  | 'card-monatsuebersicht'
  | 'card-jahresvergleich'
  | 'kpi-kleinunternehmer';

export type GridType =
  | 'grid-vertical'
  | 'grid-horizontal'
  | 'grid-pages'
  | 'grid-masonry'
  | 'grid-accordion'
  | 'grid-sidebar'
  | 'grid-bento';

export type NodeType =
  | 'kpi-einnahmen-ytd'
  | 'kpi-ausgaben-ytd'
  | 'kpi-saldo-ytd'
  | 'kpi-betriebsergebnis'
  | 'kpi-belege-30d'
  | 'kpi-einnahmen-monat'
  | 'kpi-ausgaben-monat'
  | 'kpi-saldo-monat'
  | 'kpi-saldo-prognose'
  | 'chart-revenue'
  | 'chart-category-donut'
  | 'chart-last28days'
  | 'chart-month'
  | 'card-sonderausgaben'
  | 'list-forecast'
  | 'list-forecast-28d'
  | 'list-recent-emails'
  | 'list-recent-invoices'
  | 'chart-cashflow'
  | 'list-top-ausgaben'
  | 'list-top-partner'
  | 'kpi-ust-jahr'
  | 'kpi-avg-einnahmen-monat'
  | 'kpi-avg-ausgaben-monat'
  | 'kpi-marge'
  | 'kpi-steuerruecklage'
  | 'list-top-einnahmen'
  | 'card-monatsuebersicht'
  | 'card-jahresvergleich'
  | 'kpi-kleinunternehmer'
  | 'grid-vertical'
  | 'grid-horizontal'
  | 'grid-pages'
  | 'grid-masonry'
  | 'grid-accordion'
  | 'grid-sidebar'
  | 'grid-bento';

export interface PageDef {
  id: string;
  label: string;
  children: DashboardNode[];
}

export interface DashboardNode {
  id: string;
  type: NodeType;
  children?: DashboardNode[];  // grid-vertical, grid-horizontal
  pages?: PageDef[];            // grid-pages
  props?: Record<string, unknown>;
}

// ─── ID Generation ──────────────────────────────────────────────────────────

let _c = 0;
export function genId(): string {
  return `n${Date.now()}${_c++}`;
}

export function createNode(type: NodeType): DashboardNode {
  const id = genId();
  if (
    type === 'grid-vertical' ||
    type === 'grid-horizontal' ||
    type === 'grid-masonry' ||
    type === 'grid-accordion' ||
    type === 'grid-sidebar' ||
    type === 'grid-bento'
  ) {
    return { id, type, children: [] };
  }
  if (type === 'grid-pages') {
    return { id, type, pages: [{ id: genId(), label: 'Seite 1', children: [] }] };
  }
  return { id, type };
}

export function isGridType(type: NodeType): type is GridType {
  return (
    type === 'grid-vertical' ||
    type === 'grid-horizontal' ||
    type === 'grid-pages' ||
    type === 'grid-masonry' ||
    type === 'grid-accordion' ||
    type === 'grid-sidebar' ||
    type === 'grid-bento'
  );
}

// ─── Tree Helpers ────────────────────────────────────────────────────────────

export function findNodeById(root: DashboardNode, id: string): DashboardNode | null {
  if (root.id === id) return root;
  if (root.children) {
    for (const c of root.children) {
      const f = findNodeById(c, id);
      if (f) return f;
    }
  }
  if (root.pages) {
    for (const p of root.pages) {
      for (const c of p.children) {
        const f = findNodeById(c, id);
        if (f) return f;
      }
    }
  }
  return null;
}

export interface ParentInfo {
  container: DashboardNode;
  pageId?: string;
  index: number;
}

export function findParentInfo(root: DashboardNode, nodeId: string): ParentInfo | null {
  function search(node: DashboardNode): ParentInfo | null {
    if (node.children) {
      const idx = node.children.findIndex((c) => c.id === nodeId);
      if (idx !== -1) return { container: node, index: idx };
      for (const c of node.children) {
        const f = search(c);
        if (f) return f;
      }
    }
    if (node.pages) {
      for (const p of node.pages) {
        const idx = p.children.findIndex((c) => c.id === nodeId);
        if (idx !== -1) return { container: node, pageId: p.id, index: idx };
        for (const c of p.children) {
          const f = search(c);
          if (f) return f;
        }
      }
    }
    return null;
  }
  return search(root);
}

function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

export function removeNodeById(
  root: DashboardNode,
  nodeId: string,
): [DashboardNode, DashboardNode | null] {
  const r = deepClone(root);
  let removed: DashboardNode | null = null;

  function doRemove(node: DashboardNode): boolean {
    if (node.children) {
      const idx = node.children.findIndex((c) => c.id === nodeId);
      if (idx !== -1) {
        removed = node.children.splice(idx, 1)[0];
        return true;
      }
      for (const c of node.children) if (doRemove(c)) return true;
    }
    if (node.pages) {
      for (const p of node.pages) {
        const idx = p.children.findIndex((c) => c.id === nodeId);
        if (idx !== -1) {
          removed = p.children.splice(idx, 1)[0];
          return true;
        }
        for (const c of p.children) if (doRemove(c)) return true;
      }
    }
    return false;
  }
  doRemove(r);
  return [r, removed];
}

export function insertNodeIntoContainer(
  root: DashboardNode,
  containerId: string,
  pageId: string | undefined,
  index: number,
  node: DashboardNode,
): DashboardNode {
  const r = deepClone(root);

  function doInsert(n: DashboardNode): boolean {
    if (n.id === containerId) {
      if (pageId && n.pages) {
        const page = n.pages.find((p) => p.id === pageId);
        if (page) {
          const clampedIdx = Math.min(index, page.children.length);
          page.children.splice(clampedIdx, 0, node);
          return true;
        }
      } else if (n.children !== undefined) {
        const clampedIdx = Math.min(index, n.children.length);
        n.children.splice(clampedIdx, 0, node);
        return true;
      }
    }
    if (n.children) for (const c of n.children) if (doInsert(c)) return true;
    if (n.pages) for (const p of n.pages) for (const c of p.children) if (doInsert(c)) return true;
    return false;
  }
  doInsert(r);
  return r;
}

export function moveNode(
  root: DashboardNode,
  nodeId: string,
  targetContainerId: string,
  targetPageId: string | undefined,
  targetIndex: number,
): DashboardNode {
  // If moving within same container, adjust index
  const parentInfo = findParentInfo(root, nodeId);
  let adjustedIndex = targetIndex;
  if (
    parentInfo &&
    parentInfo.container.id === targetContainerId &&
    parentInfo.pageId === targetPageId &&
    parentInfo.index < targetIndex
  ) {
    adjustedIndex = targetIndex - 1;
  }

  const [newRoot, movedNode] = removeNodeById(root, nodeId);
  if (!movedNode) return root;
  return insertNodeIntoContainer(newRoot, targetContainerId, targetPageId, adjustedIndex, movedNode);
}

/** Returns true if ancestorId is an ancestor of nodeId in the tree */
export function isAncestor(root: DashboardNode, ancestorId: string, nodeId: string): boolean {
  const node = findNodeById(root, ancestorId);
  if (!node) return false;
  return findNodeById(node, nodeId) !== null;
}

// ─── Default Layout ──────────────────────────────────────────────────────────

export const DEFAULT_LAYOUT: DashboardNode = {
  id: 'root',
  type: 'grid-pages',
  pages: [
    // ── Seite 1: Aktueller Monat (Bento 4-spaltig) ──────────────────────────
    {
      id: 'page1',
      label: '📊 Monat',
      children: [
        {
          id: 'b1',
          type: 'grid-bento',
          props: { columns: 4 },
          children: [
            // Zeile 1 – 4 KPI-Kacheln
            { id: 'e1', type: 'kpi-einnahmen-monat', props: { colSpan: 1 } },
            { id: 'e2', type: 'kpi-ausgaben-monat',  props: { colSpan: 1 } },
            { id: 'e3', type: 'kpi-saldo-monat',     props: { colSpan: 1 } },
            { id: 'e4', type: 'kpi-saldo-prognose',  props: { colSpan: 1 } },
            // Zeile 2 – Cashflow-Chart breit + Prognose-Liste schmal
            { id: 'e5', type: 'chart-cashflow',      props: { colSpan: 3 } },
            { id: 'e6', type: 'list-forecast',       props: { colSpan: 1 } },
            // Zeile 3 – Letzte 28 Tage + Letzte Rechnungen
            { id: 'e7', type: 'chart-last28days',      props: { colSpan: 2 } },
            { id: 'e8', type: 'list-recent-invoices',  props: { colSpan: 2 } },
          ],
        },
      ],
    },

    // ── Seite 2: Jahresanalyse (Bento 4-spaltig) ────────────────────────────
    {
      id: 'page2',
      label: '📈 Jahr',
      children: [
        {
          id: 'b2',
          type: 'grid-bento',
          props: { columns: 4 },
          children: [
            // Zeile 1 – YTD-KPIs
            { id: 'e9',  type: 'kpi-einnahmen-ytd',      props: { colSpan: 1 } },
            { id: 'e10', type: 'kpi-ausgaben-ytd',        props: { colSpan: 1 } },
            { id: 'e11', type: 'kpi-saldo-ytd',           props: { colSpan: 1 } },
            { id: 'e12', type: 'kpi-betriebsergebnis',    props: { colSpan: 1 } },
            // Zeile 2 – Umsatz-Chart groß + Donut-Chart klein
            { id: 'e13', type: 'chart-revenue',           props: { colSpan: 3 } },
            { id: 'e14', type: 'chart-category-donut',    props: { colSpan: 1 } },
            // Zeile 3 – Jahresvergleich + Monatsübersicht
            { id: 'e15', type: 'card-jahresvergleich',    props: { colSpan: 2 } },
            { id: 'e16', type: 'card-monatsuebersicht',   props: { colSpan: 2 } },
            // Zeile 4 – Steuerkennzahlen
            { id: 'e17', type: 'kpi-ust-jahr',            props: { colSpan: 1 } },
            { id: 'e18', type: 'kpi-steuerruecklage',     props: { colSpan: 1 } },
            { id: 'e19', type: 'kpi-marge',               props: { colSpan: 1 } },
            { id: 'e20', type: 'card-sonderausgaben',     props: { colSpan: 1 } },
            // Zeile 5 – Kleinunternehmergrenze (volle Breite für gute Lesbarkeit)
            { id: 'e20b', type: 'kpi-kleinunternehmer',  props: { colSpan: 2 } },
          ],
        },
      ],
    },

    // ── Seite 3: Details (Sidebar-Layout) ───────────────────────────────────
    {
      id: 'page3',
      label: '🔍 Details',
      children: [
        {
          id: 'sb1',
          type: 'grid-sidebar',
          children: [
            // Seitenleiste (erstes Kind = 240 px breit)
            {
              id: 'vside',
              type: 'grid-vertical',
              children: [
                { id: 'e21', type: 'kpi-belege-30d' },
                { id: 'e22', type: 'kpi-avg-einnahmen-monat' },
                { id: 'e23', type: 'kpi-avg-ausgaben-monat' },
                { id: 'e24', type: 'list-top-partner' },
              ],
            },
            // Hauptbereich
            {
              id: 'vmain',
              type: 'grid-vertical',
              children: [
                {
                  id: 'hd1',
                  type: 'grid-horizontal',
                  children: [
                    { id: 'e25', type: 'list-top-einnahmen' },
                    { id: 'e26', type: 'list-top-ausgaben' },
                  ],
                },
                {
                  id: 'hd2',
                  type: 'grid-horizontal',
                  children: [
                    { id: 'e27', type: 'list-forecast-28d' },
                    { id: 'e28', type: 'list-recent-emails' },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    // ── Seite 4: Cashflow & Prognose ────────────────────────────────────────
    {
      id: 'page4',
      label: '💰 Cashflow',
      children: [
        {
          id: 'b4',
          type: 'grid-bento',
          props: { columns: 4 },
          children: [
            // Zeile 1 – Liquiditätskennzahlen
            { id: 'f1', type: 'kpi-saldo-monat',      props: { colSpan: 1 } },
            { id: 'f2', type: 'kpi-saldo-prognose',   props: { colSpan: 1 } },
            { id: 'f3', type: 'kpi-steuerruecklage',  props: { colSpan: 1 } },
            { id: 'f4', type: 'kpi-marge',            props: { colSpan: 1 } },
            // Zeile 2 – kumulierter Cashflow über das Jahr (breit)
            { id: 'f5', type: 'chart-cashflow',       props: { colSpan: 4 } },
            // Zeile 3 – 28-Tage-Tagesansicht + Prognose-Listen
            { id: 'f6', type: 'chart-last28days',     props: { colSpan: 2 } },
            {
              id: 'fv1',
              type: 'grid-vertical',
              props: { colSpan: 2 },
              children: [
                { id: 'f7', type: 'list-forecast' },
                { id: 'f8', type: 'list-forecast-28d' },
              ],
            },
          ],
        },
      ],
    },

    // ── Seite 5: Top-Analyse ─────────────────────────────────────────────────
    {
      id: 'page5',
      label: '📋 Analyse',
      children: [
        {
          id: 'b5',
          type: 'grid-bento',
          props: { columns: 4 },
          children: [
            // Zeile 1 – Kategorien-Donut + Betriebsergebnis-KPIs
            { id: 'g1', type: 'chart-category-donut',     props: { colSpan: 1 } },
            { id: 'g2', type: 'kpi-betriebsergebnis',     props: { colSpan: 1 } },
            { id: 'g3', type: 'kpi-ust-jahr',             props: { colSpan: 1 } },
            { id: 'g4', type: 'card-sonderausgaben',      props: { colSpan: 1 } },
            // Zeile 2 – Top-Listen nebeneinander
            { id: 'g5', type: 'list-top-einnahmen',       props: { colSpan: 2 } },
            { id: 'g6', type: 'list-top-ausgaben',        props: { colSpan: 2 } },
            // Zeile 3 – Partner + Monatsübersicht
            { id: 'g7', type: 'list-top-partner',         props: { colSpan: 2 } },
            { id: 'g8', type: 'card-monatsuebersicht',    props: { colSpan: 2 } },
          ],
        },
      ],
    },
  ],
};
