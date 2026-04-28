import type { LineItem } from '@/types/template';

export type LineItemRenderEntry =
  | { kind: 'group'; item: LineItem; depth: number }
  | { kind: 'item'; item: LineItem; depth: number; position: number }
  | { kind: 'subtotal'; groupId: string; label: string; amount: number; depth: number };

const ROOT_KEY = '__root__';

export function lineItemTotal(item: LineItem): number {
  if (item.isGroupHeader) return 0;
  const base = item.quantity * item.unitPrice;
  return item.discount ? base * (1 - item.discount / 100) : base;
}

export function getParentGroupId(item: LineItem): string | null {
  return item.parentGroupId ?? null;
}

function byParent(items: LineItem[]): Map<string, LineItem[]> {
  const map = new Map<string, LineItem[]>();
  const ensure = (k: string) => {
    if (!map.has(k)) map.set(k, []);
    return map.get(k)!;
  };

  for (const item of items) {
    const parentKey = item.parentGroupId ?? ROOT_KEY;
    ensure(parentKey).push(item);
  }

  return map;
}

export function buildLineItemRenderEntries(items: LineItem[]): LineItemRenderEntry[] {
  const children = byParent(items);
  const entries: LineItemRenderEntry[] = [];
  const visited = new Set<string>();
  let pos = 0;

  const walk = (parentId: string | null, depth: number): number => {
    const key = parentId ?? ROOT_KEY;
    const nodes = children.get(key) ?? [];
    let subtotal = 0;

    for (const node of nodes) {
      if (visited.has(node.id)) continue;
      visited.add(node.id);

      if (node.isGroupHeader) {
        entries.push({ kind: 'group', item: node, depth });
        const groupTotal = walk(node.id, depth + 1);
        entries.push({
          kind: 'subtotal',
          groupId: node.id,
          label: node.description || 'Gruppe',
          amount: groupTotal,
          depth,
        });
        subtotal += groupTotal;
      } else {
        const amount = lineItemTotal(node);
        pos += 1;
        entries.push({ kind: 'item', item: node, depth, position: pos });
        subtotal += amount;
      }
    }

    return subtotal;
  };

  walk(null, 0);

  // Fallback for orphaned nodes: append at root to avoid data loss in UI.
  for (const item of items) {
    if (visited.has(item.id)) continue;
    if (item.isGroupHeader) {
      entries.push({ kind: 'group', item, depth: 0 });
      entries.push({ kind: 'subtotal', groupId: item.id, label: item.description || 'Gruppe', amount: 0, depth: 0 });
    } else {
      pos += 1;
      entries.push({ kind: 'item', item, depth: 0, position: pos });
    }
  }

  return entries;
}

export function getGroupDescendantIds(items: LineItem[], groupId: string): Set<string> {
  const descendants = new Set<string>();
  const children = byParent(items);
  const stack = [groupId];

  while (stack.length > 0) {
    const current = stack.pop()!;
    const direct = children.get(current) ?? [];
    for (const item of direct) {
      if (descendants.has(item.id)) continue;
      descendants.add(item.id);
      if (item.isGroupHeader) stack.push(item.id);
    }
  }

  return descendants;
}

export function flattenLineItems(items: LineItem[]): LineItem[] {
  return buildLineItemRenderEntries(items)
    .filter((e): e is Extract<LineItemRenderEntry, { kind: 'group' | 'item' }> => e.kind === 'group' || e.kind === 'item')
    .map((e) => e.item);
}

export function estimateLineItemRows(items: LineItem[]): number {
  return buildLineItemRenderEntries(items).length;
}

export function lineItemsNetTotal(items: LineItem[]): number {
  return items.filter((i) => !i.isGroupHeader).reduce((sum, item) => sum + lineItemTotal(item), 0);
}

