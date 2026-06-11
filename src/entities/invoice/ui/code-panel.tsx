import { Button } from '@shared/ui';
import { Check, Copy, Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';

/** Masked-by-default redemption code with reveal and copy-without-reveal. */
export function CodePanel({ code }: { code: string }) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2_000);
  }

  return (
    <div className="rounded-lg border border-border bg-secondary/50 p-4">
      <p className="mb-2 text-muted-foreground text-xs uppercase tracking-wide">Redemption code</p>
      <div className="flex items-center gap-2">
        <code className="flex-1 select-all break-all font-mono text-sm">
          {revealed ? code : '•'.repeat(Math.min(code.length, 24))}
        </code>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setRevealed((v) => !v)}
          aria-label={revealed ? 'Hide code' : 'Reveal code'}
          aria-pressed={revealed}
        >
          {revealed ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
        </Button>
        <Button variant="ghost" size="icon" onClick={copy} aria-label="Copy code to clipboard">
          {copied ? <Check className="text-success" aria-hidden /> : <Copy aria-hidden />}
        </Button>
      </div>
      <span aria-live="polite" className="sr-only">
        {copied ? 'Code copied to clipboard' : ''}
      </span>
    </div>
  );
}
