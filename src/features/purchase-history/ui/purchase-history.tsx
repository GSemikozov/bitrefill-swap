import { CodePanel, useOrder } from '@entities/invoice';
import { explorerTxUrl } from '@shared/config';
import { formatUsd } from '@shared/lib';
import { loadPurchaseHistory, type PurchaseRecord } from '@shared/lib/purchase-history';
import { Button, Card, CardContent, CardHeader, CardTitle, Skeleton } from '@shared/ui';
import { ChevronDown, ExternalLink } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useAccount } from 'wagmi';

function HistoryRow({ record }: { record: PurchaseRecord }) {
  const [open, setOpen] = useState(false);
  const { redemptionCode, isLoading, isError, refetch } = useOrder(record.orderId, open);

  const date = new Date(record.completedAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  return (
    <li className="rounded-lg border border-border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-accent/50"
      >
        <span className="text-muted-foreground text-xs tabular-nums">{date}</span>
        <span className="font-medium">{formatUsd(record.denomination)} Balance card</span>
        {record.demo && (
          <span className="rounded-full border border-warning/40 px-1.5 text-warning text-xs">
            demo
          </span>
        )}
        <ChevronDown
          className={`ml-auto h-4 w-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>

      {open && (
        <div className="mt-0.5 flex flex-col gap-3 px-3 pb-3">
          {isLoading && <Skeleton className="h-16 w-full" />}
          {isError && (
            <div className="flex items-center gap-3 text-sm">
              <p className="text-muted-foreground">Couldn't load the code.</p>
              <Button size="sm" variant="outline" onClick={() => refetch()}>
                Retry
              </Button>
            </div>
          )}
          {redemptionCode && <CodePanel code={redemptionCode} />}
          {record.payTxHash && (
            <a
              href={explorerTxUrl(record.payTxHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary text-xs hover:underline"
            >
              View payment on BaseScan
              <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
          )}
        </div>
      )}
    </li>
  );
}

/** Completed purchases for the connected wallet, codes re-fetchable any time. */
export function PurchaseHistory() {
  const { address } = useAccount();
  const records = useMemo(() => (address ? loadPurchaseHistory(address) : []), [address]);

  if (records.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Past purchases</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-2">
          {records.map((record) => (
            <HistoryRow key={record.orderId} record={record} />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
