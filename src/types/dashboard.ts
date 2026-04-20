// ─── Node Types ────────────────────────────────────────────────────────────────

export type ElementType =
  | 'kpi-einnahmen-ytd'
  | 'kpi-ausgaben-ytd'
  | 'kpi-saldo-ytd'
  | 'kpi-betriebsergebnis'
  | 'kpi-betriebsergebnis-afa'
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
  // ── Gesamt (alle Jahre) ──
  | 'kpi-gesamt-einnahmen'
  | 'kpi-gesamt-ausgaben'
  | 'kpi-gesamt-saldo'
  | 'kpi-gesamt-belege'
  | 'kpi-gesamt-bestes-jahr'
  | 'kpi-gesamt-avg-yearly-einnahmen'
  | 'kpi-gesamt-avg-yearly-ausgaben'
  | 'kpi-gesamt-marge'
  | 'chart-gesamt-revenue'
  | 'chart-gesamt-cashflow'
  | 'list-abos'
  | 'card-partner'
  | 'chart-jahresprognose'
  | 'card-afa-uebersicht'
  | 'kpi-afa-jahres'
  | 'chart-afa-typ'
  | 'chart-afa-donut'
  | 'chart-afa-timeline'
  | 'card-vermoegenscheck'
  | 'card-investitionsspiegel';

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
  | 'kpi-betriebsergebnis-afa'
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
  // ── Gesamt (alle Jahre) ──
  | 'kpi-gesamt-einnahmen'
  | 'kpi-gesamt-ausgaben'
  | 'kpi-gesamt-saldo'
  | 'kpi-gesamt-belege'
  | 'kpi-gesamt-bestes-jahr'
  | 'kpi-gesamt-avg-yearly-einnahmen'
  | 'kpi-gesamt-avg-yearly-ausgaben'
  | 'kpi-gesamt-marge'
  | 'chart-gesamt-revenue'
  | 'chart-gesamt-cashflow'
  | 'list-abos'
  | 'card-partner'
  | 'chart-jahresprognose'
  | 'card-afa-uebersicht'
  | 'kpi-afa-jahres'
  | 'chart-afa-typ'
  | 'chart-afa-donut'
  | 'chart-afa-timeline'
  | 'card-vermoegenscheck'
  | 'card-investitionsspiegel'
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
    // ── Seite 1: Übersicht ──────────────────────────────────────────────────
    {
      id: 'page1',
      label: '📊 Übersicht',
      children: [
        {
          id: 'b1',
          type: 'grid-bento',
          props: { columns: 4 },
          children: [
            // Zeile 1 – Kernkennzahlen
            { id: 'e1', type: 'kpi-einnahmen-monat',        props: { colSpan: 1 } },
            { id: 'e2', type: 'kpi-ausgaben-monat',          props: { colSpan: 1 } },
            { id: 'e3', type: 'kpi-betriebsergebnis',        props: { colSpan: 1 } },
            { id: 'e4', type: 'kpi-betriebsergebnis-afa',    props: { colSpan: 1 } },
            // Zeile 2 – 28-Tage-Chart + Letzte Belege
            { id: 'e5', type: 'chart-last28days',            props: { colSpan: 2 } },
            { id: 'e6', type: 'list-recent-invoices',        props: { colSpan: 2 } },
            // Zeile 3 – Prognose + Abos
            { id: 'e7', type: 'list-forecast',               props: { colSpan: 2 } },
            { id: 'e8', type: 'list-recent-emails',          props: { colSpan: 2 } },
          ],
        },
      ],
    },

    // ── Seite 2: Monat ──────────────────────────────────────────────────────
    {
      id: 'page2',
      label: '📅 Monat',
      children: [
        {
          id: 'b2',
          type: 'grid-bento',
          props: { columns: 4 },
          children: [
            { id: 'm1', type: 'kpi-einnahmen-monat',  props: { colSpan: 1 } },
            { id: 'm2', type: 'kpi-ausgaben-monat',    props: { colSpan: 1 } },
            { id: 'm3', type: 'kpi-saldo-monat',       props: { colSpan: 1 } },
            { id: 'm4', type: 'kpi-saldo-prognose',    props: { colSpan: 1 } },
            { id: 'm5', type: 'chart-month',            props: { colSpan: 3 } },
            { id: 'm6', type: 'list-forecast',          props: { colSpan: 1 } },
            { id: 'm7', type: 'chart-last28days',       props: { colSpan: 2 } },
            { id: 'm8', type: 'list-forecast-28d',      props: { colSpan: 2 } },
          ],
        },
      ],
    },

    // ── Seite 3: Jahr ───────────────────────────────────────────────────────
    {
      id: 'page3',
      label: '📈 Jahr',
      children: [
        {
          id: 'b3',
          type: 'grid-bento',
          props: { columns: 4 },
          children: [
            // YTD-KPIs
            { id: 'j1', type: 'kpi-einnahmen-ytd',        props: { colSpan: 1 } },
            { id: 'j2', type: 'kpi-ausgaben-ytd',          props: { colSpan: 1 } },
            { id: 'j3', type: 'kpi-saldo-ytd',             props: { colSpan: 1 } },
            { id: 'j4', type: 'kpi-betriebsergebnis-afa',  props: { colSpan: 1 } },
            // Umsatz-Chart + Donut
            { id: 'j5', type: 'chart-revenue',             props: { colSpan: 3 } },
            { id: 'j6', type: 'chart-category-donut',      props: { colSpan: 1 } },
            // Cashflow kumuliert + Jahresprognose
            { id: 'j7', type: 'chart-cashflow',            props: { colSpan: 2 } },
            { id: 'j8', type: 'chart-jahresprognose',      props: { colSpan: 2 } },
            // Jahresvergleich + Monatsübersicht
            { id: 'j9',  type: 'card-jahresvergleich',     props: { colSpan: 2 } },
            { id: 'j10', type: 'card-monatsuebersicht',    props: { colSpan: 2 } },
          ],
        },
      ],
    },

    // ── Seite 4: Steuer & AfA ───────────────────────────────────────────────
    {
      id: 'page4',
      label: '🧾 Steuer & AfA',
      children: [
        {
          id: 'b4',
          type: 'grid-bento',
          props: { columns: 4 },
          children: [
            // Steuer-KPIs
            { id: 's1', type: 'kpi-betriebsergebnis-afa',  props: { colSpan: 1 } },
            { id: 's2', type: 'kpi-steuerruecklage',        props: { colSpan: 1 } },
            { id: 's3', type: 'kpi-ust-jahr',               props: { colSpan: 1 } },
            { id: 's4', type: 'kpi-afa-jahres',             props: { colSpan: 1 } },
            // AfA-Charts
            { id: 's5', type: 'chart-afa-timeline',          props: { colSpan: 3 } },
            { id: 's6', type: 'chart-afa-donut',             props: { colSpan: 1 } },
            // AfA-Übersicht + Sonderausgaben
            { id: 's7', type: 'card-afa-uebersicht',         props: { colSpan: 3 } },
            { id: 's8', type: 'card-sonderausgaben',         props: { colSpan: 1 } },
            // Kleinunternehmergrenze + Marge
            { id: 's9',  type: 'kpi-kleinunternehmer',       props: { colSpan: 2 } },
            { id: 's10', type: 'kpi-marge',                   props: { colSpan: 2 } },
          ],
        },
      ],
    },

    // ── Seite 5: Cashflow & Prognose ────────────────────────────────────────
    {
      id: 'page5',
      label: '💰 Cashflow',
      children: [
        {
          id: 'b5',
          type: 'grid-bento',
          props: { columns: 4 },
          children: [
            { id: 'c1', type: 'kpi-saldo-monat',       props: { colSpan: 1 } },
            { id: 'c2', type: 'kpi-saldo-prognose',    props: { colSpan: 1 } },
            { id: 'c3', type: 'kpi-betriebsergebnis',  props: { colSpan: 1 } },
            { id: 'c4', type: 'kpi-steuerruecklage',   props: { colSpan: 1 } },
            { id: 'c5', type: 'chart-cashflow',         props: { colSpan: 4 } },
            { id: 'c6', type: 'chart-last28days',       props: { colSpan: 2 } },
            {
              id: 'cv1',
              type: 'grid-vertical',
              props: { colSpan: 2 },
              children: [
                { id: 'c7', type: 'list-forecast' },
                { id: 'c8', type: 'list-forecast-28d' },
              ],
            },
          ],
        },
      ],
    },

    // ── Seite 6: Analyse & Top-Listen ───────────────────────────────────────
    {
      id: 'page6',
      label: '📋 Analyse',
      children: [
        {
          id: 'sb1',
          type: 'grid-sidebar',
          children: [
            {
              id: 'aside',
              type: 'grid-vertical',
              children: [
                { id: 'a1', type: 'kpi-belege-30d' },
                { id: 'a2', type: 'kpi-avg-einnahmen-monat' },
                { id: 'a3', type: 'kpi-avg-ausgaben-monat' },
                { id: 'a4', type: 'kpi-marge' },
                { id: 'a5', type: 'chart-afa-typ' },
              ],
            },
            {
              id: 'amain',
              type: 'grid-vertical',
              children: [
                {
                  id: 'ah1',
                  type: 'grid-horizontal',
                  children: [
                    { id: 'a6', type: 'list-top-einnahmen' },
                    { id: 'a7', type: 'list-top-ausgaben' },
                  ],
                },
                {
                  id: 'ah2',
                  type: 'grid-horizontal',
                  children: [
                    { id: 'a8', type: 'list-top-partner' },
                    { id: 'a9', type: 'card-partner' },
                  ],
                },
                { id: 'a10', type: 'list-abos' },
              ],
            },
          ],
        },
      ],
    },

    // ── Seite 7: Gesamt (alle Jahre) ────────────────────────────────────────
    {
      id: 'page7',
      label: '🌍 Gesamt',
      children: [
        {
          id: 'b7',
          type: 'grid-bento',
          props: { columns: 4 },
          children: [
            { id: 'g1', type: 'kpi-gesamt-einnahmen',              props: { colSpan: 1 } },
            { id: 'g2', type: 'kpi-gesamt-ausgaben',               props: { colSpan: 1 } },
            { id: 'g3', type: 'kpi-gesamt-saldo',                  props: { colSpan: 1 } },
            { id: 'g4', type: 'kpi-gesamt-belege',                 props: { colSpan: 1 } },
            { id: 'g5', type: 'chart-gesamt-revenue',              props: { colSpan: 3 } },
            { id: 'g6', type: 'kpi-gesamt-bestes-jahr',            props: { colSpan: 1 } },
            { id: 'g7', type: 'chart-gesamt-cashflow',             props: { colSpan: 4 } },
            { id: 'g8', type: 'kpi-gesamt-avg-yearly-einnahmen',   props: { colSpan: 1 } },
            { id: 'g9', type: 'kpi-gesamt-avg-yearly-ausgaben',    props: { colSpan: 1 } },
            { id: 'g10', type: 'kpi-gesamt-marge',                 props: { colSpan: 2 } },
            { id: 'g11', type: 'card-vermoegenscheck',               props: { colSpan: 2 } },
            { id: 'g12', type: 'card-investitionsspiegel',            props: { colSpan: 2 } },
          ],
        },
      ],
    },
  ],
};
