import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { Page } from './services/api';

interface ListOpts {
  limit?: number;
  extra?: Record<string, any>;
}

/** Server-paginated list state: page/limit/search + react-query fetch. */
export function useAdminList<T>(key: string, fetcher: (p: Record<string, any>) => Promise<Page<T>>, opts: ListOpts = {}) {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(opts.limit || 20);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [filters, setFilters] = useState<Record<string, any>>(opts.extra || {});

  const setSearchDebounced = (v: string) => {
    setSearch(v);
    setPage(1);
    clearTimeout((setSearchDebounced as any)._t);
    (setSearchDebounced as any)._t = setTimeout(() => setDebounced(v), 400);
  };
  const setFilter = (k: string, v: any) => {
    setFilters((f) => ({ ...f, [k]: v }));
    setPage(1);
  };

  const query = useQuery({
    queryKey: [key, page, limit, debounced, filters],
    queryFn: () => fetcher({ page, limit, search: debounced || undefined, ...filters }),
    placeholderData: keepPreviousData,
  });

  return {
    page, limit, search, filters,
    setPage, setLimit, setSearch: setSearchDebounced, setFilter,
    ...query,
    rows: query.data?.data || [],
    total: query.data?.total || 0,
    onPage: (p: number, l: number) => { setPage(p); setLimit(l); },
  };
}

export const fmtINR = (n: any) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
export const fmtDate = (d: any) => (d ? new Date(d).toLocaleString() : '—');
export const fmtDay = (d: any) => (d ? new Date(d).toLocaleDateString() : '—');
