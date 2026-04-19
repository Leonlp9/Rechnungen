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
  | 'card-sonderausgaben'
  | 'list-forecast'
  | 'list-recent-emails'
  | 'list-recent-invoices'
  | 'chart-cashflow'
  | 'list-top-ausgaben'
  | 'list-top-partner'
  | 'kpi-ust-jahr'
  | 'kpi-avg-einnahmen-monat'
  | 'card-jahresvergleich';

export type GridType = 'grid-vertical' | 'grid-horizontal' | 'grid-pages';
export type NodeType = GridType | ElementType;

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
  if (type === 'grid-vertical' || type === 'grid-horizontal') {
    return { id, type, children: [] };
  }
  if (type === 'grid-pages') {
    return { id, type, pages: [{ id: genId(), label: 'Seite 1', children: [] }] };
  }
  return { id, type };
}

export function isGridType(type: NodeType): type is GridType {
  return type === 'grid-vertical' || type === 'grid-horizontal' || type === 'grid-pages';
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
    {
      id: 'page1',
      label: 'Übersicht',
      children: [
        {
          id: 'v1',
          type: 'grid-vertical',
          children: [
            {
              id: 'h1',
              type: 'grid-horizontal',
              children: [
                { id: 'e1', type: 'kpi-einnahmen-monat' },
                { id: 'e2', type: 'kpi-ausgaben-monat' },
                { id: 'e3', type: 'kpi-saldo-monat' },
                { id: 'e4', type: 'kpi-saldo-prognose' },
              ],
            },
            {
              id: 'h2',
              type: 'grid-horizontal',
              children: [
                { id: 'e5', type: 'chart-cashflow' },
                { id: 'e6', type: 'chart-last28days' },
              ],
            },
            {
              id: 'h3',
              type: 'grid-horizontal',
              children: [
                { id: 'e7', type: 'list-forecast' },
                { id: 'e8', type: 'list-recent-invoices' },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 'page2',
      label: 'Analyse & YTD',
      children: [
        {
          id: 'v2',
          type: 'grid-vertical',
          children: [
            {
              id: 'h4',
              type: 'grid-horizontal',
              children: [
                { id: 'e9', type: 'kpi-einnahmen-ytd' },
                { id: 'e10', type: 'kpi-ausgaben-ytd' },
                { id: 'e11', type: 'kpi-saldo-ytd' },
                { id: 'e12', type: 'kpi-betriebsergebnis' },
                { id: 'e13', type: 'kpi-ust-jahr' },
              ],
            },
            {
              id: 'h5',
              type: 'grid-horizontal',
              children: [
                { id: 'e14', type: 'chart-revenue' },
                { id: 'e15', type: 'chart-category-donut' },
              ],
            },
            {
              id: 'h6',
              type: 'grid-horizontal',
              children: [
                { id: 'e16', type: 'card-jahresvergleich' },
                { id: 'e17', type: 'card-sonderausgaben' },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 'page3',
      label: 'Details',
      children: [
        {
          id: 'v3',
          type: 'grid-vertical',
          children: [
            {
              id: 'h7',
              type: 'grid-horizontal',
              children: [
                { id: 'e18', type: 'kpi-avg-einnahmen-monat' },
                { id: 'e19', type: 'kpi-belege-30d' },
              ],
            },
            {
              id: 'h8',
              type: 'grid-horizontal',
              children: [
                { id: 'e20', type: 'list-top-partner' },
                { id: 'e21', type: 'list-top-ausgaben' },
              ],
            },
            { id: 'e22', type: 'list-recent-emails' },
          ],
        },
      ],
    },
  ],
};
