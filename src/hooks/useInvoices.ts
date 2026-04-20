import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAllInvoices, getInvoiceById, insertInvoice, updateInvoice, deleteInvoice } from '@/lib/db';
import { queryKeys } from '@/lib/queryKeys';
import type { Invoice } from '@/types';

/** Alle Rechnungen lesen (gecacht) */
export function useInvoices() {
  return useQuery({
    queryKey: queryKeys.invoices.all,
    queryFn: getAllInvoices,
  });
}

/** Einzelne Rechnung lesen */
export function useInvoice(id: string) {
  return useQuery({
    queryKey: queryKeys.invoices.detail(id),
    queryFn: () => getInvoiceById(id),
    enabled: !!id,
  });
}

/** Rechnung anlegen */
export function useCreateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (inv: Invoice) => insertInvoice(inv),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.invoices.all });
    },
  });
}

/** Rechnung aktualisieren */
export function useUpdateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (inv: Invoice) => updateInvoice(inv),
    onSuccess: (_data, inv) => {
      qc.invalidateQueries({ queryKey: queryKeys.invoices.all });
      qc.invalidateQueries({ queryKey: queryKeys.invoices.detail(inv.id) });
    },
  });
}

/** Rechnung löschen */
export function useDeleteInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteInvoice(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.invoices.all });
    },
  });
}

