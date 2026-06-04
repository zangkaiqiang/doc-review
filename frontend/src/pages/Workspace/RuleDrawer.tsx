import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Loader2, X } from "lucide-react";
import type { RuleConfig, ScoringConfig } from "../../types";
import { RuleTemplateEditor } from "../../components/RuleTemplateEditor";
import { ScoringEditor } from "../../components/ScoringEditor";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";

export function RuleDrawer({
  open,
  onOpenChange,
  version,
  initialRule,
  initialScoring,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  version: number;
  initialRule: RuleConfig;
  initialScoring: ScoringConfig;
  onSubmit: (rule: RuleConfig, scoring: ScoringConfig) => Promise<void>;
}) {
  const [rule, setRule] = useState<RuleConfig>(initialRule);
  const [scoring, setScoring] = useState<ScoringConfig>(initialScoring);
  const [submitting, setSubmitting] = useState(false);

  // Reset editor state to the latest snapshot on open only — depending on the
  // initial* props would reset in-progress edits if the parent re-renders (e.g.
  // SSE pushes a finding) while the drawer is open.
  useEffect(() => {
    if (open) {
      setRule(initialRule);
      setScoring(initialScoring);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function submit() {
    setSubmitting(true);
    try {
      await onSubmit(rule, scoring);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="animate-overlay-in fixed inset-0 z-40 bg-black/40" />
        <Dialog.Content className="animate-drawer-in fixed right-0 top-0 z-50 flex h-full w-[760px] max-w-[92vw] flex-col border-l border-line bg-surface shadow-pop">
          <div className="flex items-center justify-between gap-3 border-b border-line bg-panel px-5 py-4">
            <div>
              <Dialog.Title className="text-base font-semibold text-ink">调整本次审查规则</Dialog.Title>
              <Dialog.Description className="mt-1 text-xs text-muted">
                保存后基于当前文档派生新版本（v{version + 1}）并重新审查，原版本作为历史保留。
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" title="关闭">
                <X size={17} />
              </Button>
            </Dialog.Close>
          </div>

          <div className="flex-1 space-y-6 overflow-y-auto p-5">
            <RuleTemplateEditor value={rule} onChange={setRule} />
            <div className="border-t border-line pt-5">
              <div className="mb-3 text-sm font-medium text-ink2">评分口径</div>
              <ScoringEditor value={scoring} onChange={setScoring} />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-line bg-panel px-5 py-4">
            <Badge tone="neutral">当前 v{version}</Badge>
            <div className="flex items-center gap-2">
              <Dialog.Close asChild>
                <Button variant="ghost">取消</Button>
              </Dialog.Close>
              <Button onClick={submit} disabled={submitting} size="lg">
                {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
                {submitting ? "派生中" : "保存为新版本并重跑"}
              </Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
