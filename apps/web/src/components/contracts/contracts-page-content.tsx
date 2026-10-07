'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { EmploymentContractListItem, EmploymentContractListQuery } from '@unity/types';
import { archiveContract, downloadContractPdf, fetchContracts } from '@/lib/contracts-api';
import { isSuperAdmin } from '@/lib/auth/authorization';
import { useAuth } from '@/lib/auth/auth-context';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState } from '@/components/dashboard/dashboard-states';
import { Input, Select } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

export function ContractsPageContent() {
  const { user } = useAuth();
  const allowed = isSuperAdmin(user);
  const [query, setQuery] = useState<EmploymentContractListQuery>({ page: 1, pageSize: 20 });
  const [items, setItems] = useState<EmploymentContractListItem[]>([]);
  const [meta, setMeta] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchContracts(query);
      setItems(response.data);
      setMeta(response.meta);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load contracts');
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    if (allowed) void load();
  }, [allowed, load]);

  if (!allowed) {
    return <EmptyState title="Access restricted" description="Employment contracts are available only to Super Admin." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Contracts</h1>
          <p className="text-sm text-muted-foreground">
            Employment contracts under Kosovo Labour Law, or collaboration agreements for instructors paid a percentage.
          </p>
        </div>
        <Link href="/contracts/new">
          <Button>New contract</Button>
        </Link>
      </div>

      <div className="grid gap-3 rounded-xl border p-4 md:grid-cols-3">
        <Input
          placeholder="Search employee, job, number..."
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setQuery((prev) => ({
                ...prev,
                page: 1,
                search: (e.target as HTMLInputElement).value || undefined,
              }));
            }
          }}
        />
        <Select
          value={query.type ?? ''}
          onChange={(e) =>
            setQuery((prev) => ({
              ...prev,
              page: 1,
              type: (e.target.value as EmploymentContractListQuery['type']) || undefined,
            }))
          }
        >
          <option value="">All types</option>
          <option value="COLLABORATION">Collaboration</option>
          <option value="INDEFINITE">Indefinite</option>
          <option value="FIXED_TERM">Fixed term</option>
          <option value="SPECIFIC_TASK">Specific task</option>
        </Select>
        <Select
          value={query.status ?? ''}
          onChange={(e) =>
            setQuery((prev) => ({
              ...prev,
              page: 1,
              status: (e.target.value as EmploymentContractListQuery['status']) || undefined,
            }))
          }
        >
          <option value="">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="ISSUED">Issued</option>
          <option value="ACTIVE">Active</option>
          <option value="EXPIRED">Expired</option>
          <option value="TERMINATED">Terminated</option>
        </Select>
      </div>

      {loading ? (
        <Skeleton className="h-48 w-full" />
      ) : error ? (
        <ErrorState title="Unable to load contracts" description={error} onRetry={() => void load()} />
      ) : items.length === 0 ? (
        <EmptyState title="No contracts yet" description="Create a contract after you agree terms with the employee." />
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="min-w-full text-sm">
            <thead className="border-b bg-muted/40 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Number</th>
                <th className="px-4 py-3 font-medium">Employee</th>
                <th className="px-4 py-3 font-medium">Job</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Period</th>
                <th className="px-4 py-3 font-medium">Pay</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/contracts/${item.id}`} className="hover:underline">
                      {item.contractNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{item.employeeName}</td>
                  <td className="px-4 py-3">{item.jobTitle}</td>
                  <td className="px-4 py-3">
                    {item.type === 'COLLABORATION'
                      ? 'Collaboration'
                      : item.type === 'INDEFINITE'
                        ? 'Indefinite'
                        : item.type === 'FIXED_TERM'
                          ? 'Fixed term'
                          : 'Specific task'}
                  </td>
                  <td className="px-4 py-3">
                    {item.startDate}
                    {item.endDate ? ` – ${item.endDate}` : item.type === 'COLLABORATION' ? ' – open' : ' – indefinite'}
                  </td>
                  <td className="px-4 py-3">
                    {item.type === 'COLLABORATION' && item.collaborationPercentage
                      ? `${item.collaborationPercentage}%`
                      : `EUR ${item.baseSalary}`}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline">{item.status}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          void downloadContractPdf(item.id, item.contractNumber).catch((err: Error) =>
                            setError(err.message),
                          )
                        }
                      >
                        PDF
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          void archiveContract(item.id)
                            .then(() => load())
                            .catch((err: Error) => setError(err.message))
                        }
                      >
                        Archive
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Page {meta.page} of {meta.totalPages} · {meta.total} contracts
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={meta.page <= 1}
            onClick={() => setQuery((prev) => ({ ...prev, page: (prev.page ?? 1) - 1 }))}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={meta.page >= meta.totalPages}
            onClick={() => setQuery((prev) => ({ ...prev, page: (prev.page ?? 1) + 1 }))}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
