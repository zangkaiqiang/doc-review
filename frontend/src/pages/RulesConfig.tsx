import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Plus, Save, Settings2, Trash2 } from "lucide-react";
import {
  createRedline,
  deleteRedline,
  getRulesConfig,
  getScoringConfig,
  listRedlines,
  saveRulesConfig,
  saveScoringConfig,
  updateRedline,
} from "../lib/api";
import type { Level, Redline, RuleConfig, RuleConfigByStance, ScoringConfig, ScoringConfigByStance } from "../types";
import { STANCE_LABEL } from "../lib/labels";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Skeleton } from "../components/ui/Skeleton";
import { useToast } from "../components/ui/toast";
import { RuleTemplateEditor, normalizeRuleConfig } from "../components/RuleTemplateEditor";
import { ScoringEditor, normalizeScoringConfig } from "../components/ScoringEditor";

const EMPTY_REDLINE: Omit<Redline, "id"> = {
  code: "",
  content: "",
  keywords: "",
  doc_type: "contract",
  stance: "any",
  level: "high",
  enabled: true,
};

const STANCE_KEYS = ["party_a", "party_b", "neutral", "tenderee"];

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="text-xs font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}

function inputClass(extra = "") {
  return `h-9 rounded-control border border-line bg-surface px-3 text-sm text-ink2 outline-none transition-colors focus:border-brand/50 ${extra}`;
}

export default function RulesConfigPage() {
  const { toast } = useToast();
  const [rulesByStance, setRulesByStance] = useState<RuleConfigByStance | null>(null);
  const [activeStance, setActiveStance] = useState("party_a");
  const [scoringStance, setScoringStance] = useState("party_a");
  const [scoringByStance, setScoringByStance] = useState<ScoringConfigByStance | null>(null);
  const [redlines, setRedlines] = useState<Redline[]>([]);
  const [newRedline, setNewRedline] = useState<Omit<Redline, "id">>(EMPTY_REDLINE);
  const [error, setError] = useState<string | null>(null);
  const [savingRules, setSavingRules] = useState(false);
  const [savingScoring, setSavingScoring] = useState(false);

  useEffect(() => {
    Promise.all([getRulesConfig(), getScoringConfig(), listRedlines()])
      .then(([ruleConfig, scoringConfig, redlineItems]) => {
        setRulesByStance(ruleConfig);
        setScoringByStance(scoringConfig);
        setRedlines(redlineItems);
      })
      .catch((e) => setError(String(e.message ?? e)));
  }, []);

  const redlineStats = useMemo(() => {
    const enabled = redlines.filter((item) => item.enabled).length;
    return { enabled, disabled: redlines.length - enabled };
  }, [redlines]);

  const activeRules = rulesByStance?.[activeStance] ?? null;
  const activeScoring = scoringByStance?.[scoringStance] ?? null;

  function setActiveRules(next: RuleConfig) {
    if (!rulesByStance) return;
    setRulesByStance({ ...rulesByStance, [activeStance]: next });
  }

  function setActiveScoring(next: ScoringConfig) {
    if (!scoringByStance) return;
    setScoringByStance({ ...scoringByStance, [scoringStance]: next });
  }

  async function persistRules() {
    if (!rulesByStance) return;
    setSavingRules(true);
    try {
      const normalized = Object.fromEntries(
        Object.entries(rulesByStance).map(([key, value]) => [key, normalizeRuleConfig(value)])
      ) as RuleConfigByStance;
      const saved = await saveRulesConfig(normalized);
      setRulesByStance(saved);
      toast("默认规则模板已保存");
    } catch (e) {
      toast(String(e instanceof Error ? e.message : e), "error");
    } finally {
      setSavingRules(false);
    }
  }

  async function persistScoring() {
    if (!scoringByStance) return;
    setSavingScoring(true);
    try {
      const normalized = Object.fromEntries(
        Object.entries(scoringByStance).map(([key, value]) => [key, normalizeScoringConfig(value)])
      ) as ScoringConfigByStance;
      const saved = await saveScoringConfig(normalized);
      setScoringByStance(saved);
      toast("评分规则已保存");
    } catch (e) {
      toast(String(e instanceof Error ? e.message : e), "error");
    } finally {
      setSavingScoring(false);
    }
  }

  async function persistRedline(item: Redline) {
    try {
      const saved = await updateRedline(item.id, stripId(item));
      setRedlines((prev) => prev.map((row) => (row.id === item.id ? saved : row)));
      toast("红线已保存");
    } catch (e) {
      toast(String(e instanceof Error ? e.message : e), "error");
    }
  }

  async function addRedline() {
    try {
      const saved = await createRedline(newRedline);
      setRedlines((prev) => [...prev, saved]);
      setNewRedline(EMPTY_REDLINE);
      toast("红线已新增");
    } catch (e) {
      toast(String(e instanceof Error ? e.message : e), "error");
    }
  }

  async function removeRedline(id: number) {
    try {
      await deleteRedline(id);
      setRedlines((prev) => prev.filter((row) => row.id !== id));
      toast("红线已删除");
    } catch (e) {
      toast(String(e instanceof Error ? e.message : e), "error");
    }
  }

  if (error) {
    return <div className="p-8 text-sm text-high">{error}</div>;
  }

  if (!rulesByStance || !activeRules || !scoringByStance || !activeScoring) {
    return (
      <div className="mx-auto max-w-7xl px-6 py-8">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="mt-6 h-72 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Badge tone="brand" className="mb-2">
            <Settings2 size={13} /> 规则配置
          </Badge>
          <h1 className="text-2xl font-semibold text-ink">审查规则配置</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone="good">启用红线 {redlineStats.enabled}</Badge>
          <Badge tone="neutral">停用 {redlineStats.disabled}</Badge>
        </div>
      </div>

      <div className="grid gap-6">
        <section className="rounded-card border border-line bg-surface shadow-soft">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-panel px-4 py-3">
            <div>
              <div className="text-sm font-semibold text-ink">确定性默认模板</div>
              <div className="mt-1 text-xs text-muted">每个立场维护一套默认规则；新建审查时会复制到本合同，并可在提交前单独修改。</div>
            </div>
            <Button onClick={persistRules} disabled={savingRules}>
              <Save size={15} /> {savingRules ? "保存中" : "保存模板"}
            </Button>
          </div>

          <div className="border-b border-line px-4 py-3">
            <div className="flex flex-wrap gap-2">
              {STANCE_KEYS.map((key) => (
                <button
                  key={key}
                  onClick={() => setActiveStance(key)}
                  className={`h-8 rounded-control border px-3 text-sm transition-colors ${
                    activeStance === key ? "border-brand bg-brand text-white" : "border-line bg-surface text-muted hover:border-brand/40 hover:text-ink2"
                  }`}
                >
                  {STANCE_LABEL[key]}
                </button>
              ))}
            </div>
          </div>

          <div className="p-4">
            <RuleTemplateEditor value={activeRules} onChange={setActiveRules} />
          </div>
        </section>

        <section className="rounded-card border border-line bg-surface shadow-soft">
          <div className="border-b border-line bg-panel px-4 py-3">
            <div className="text-sm font-semibold text-ink">红线库</div>
            <div className="mt-1 text-xs text-muted">启用的红线会参与“红线命中”检查，关键词用逗号分隔。</div>
          </div>
          <div className="grid gap-3 p-4">
            {redlines.map((item) => (
              <RedlineEditor
                key={item.id}
                item={item}
                onChange={(next) => setRedlines((prev) => prev.map((row) => (row.id === next.id ? next : row)))}
                onSave={() => persistRedline(item)}
                onDelete={() => removeRedline(item.id)}
              />
            ))}
            <div className="rounded-card border border-dashed border-line-strong bg-panel p-3">
              <div className="mb-3 text-sm font-medium text-ink2">新增红线</div>
              <RedlineFields value={newRedline} onChange={setNewRedline} />
              <Button className="mt-3" onClick={addRedline} disabled={!newRedline.code.trim() || !newRedline.content.trim()}>
                <Plus size={15} /> 新增红线
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-card border border-line bg-surface shadow-soft">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-panel px-4 py-3">
            <div>
              <div className="text-sm font-semibold text-ink">评分规则</div>
              <div className="mt-1 text-xs text-muted">每个立场维护一套评分口径：按严重度扣分、一票否决类别与风险分档阈值。</div>
            </div>
            <Button onClick={persistScoring} disabled={savingScoring}>
              <Save size={15} /> {savingScoring ? "保存中" : "保存评分"}
            </Button>
          </div>

          <div className="border-b border-line px-4 py-3">
            <div className="flex flex-wrap gap-2">
              {STANCE_KEYS.map((key) => (
                <button
                  key={key}
                  onClick={() => setScoringStance(key)}
                  className={`h-8 rounded-control border px-3 text-sm transition-colors ${
                    scoringStance === key ? "border-brand bg-brand text-white" : "border-line bg-surface text-muted hover:border-brand/40 hover:text-ink2"
                  }`}
                >
                  {STANCE_LABEL[key]}
                </button>
              ))}
            </div>
          </div>

          <div className="p-4">
            <ScoringEditor value={activeScoring} onChange={setActiveScoring} />
          </div>
        </section>
      </div>
    </div>
  );
}

function RedlineEditor({
  item,
  onChange,
  onSave,
  onDelete,
}: {
  item: Redline;
  onChange: (value: Redline) => void;
  onSave: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-card border border-line bg-panel p-3">
      <RedlineFields value={stripId(item)} onChange={(next) => onChange({ ...item, ...next })} />
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="ghost" onClick={onSave}>
          <Save size={15} /> 保存
        </Button>
        <Button variant="danger" onClick={onDelete}>
          <Trash2 size={15} /> 删除
        </Button>
      </div>
    </div>
  );
}

function RedlineFields({
  value,
  onChange,
}: {
  value: Omit<Redline, "id">;
  onChange: (value: Omit<Redline, "id">) => void;
}) {
  return (
    <div className="grid gap-3 lg:grid-cols-[100px_minmax(180px,1fr)_110px_120px_96px_90px]">
      <Field label="编号">
        <input value={value.code} onChange={(e) => onChange({ ...value, code: e.target.value })} className={inputClass()} />
      </Field>
      <Field label="描述">
        <input value={value.content} onChange={(e) => onChange({ ...value, content: e.target.value })} className={inputClass()} />
      </Field>
      <Field label="严重度">
        <select value={value.level} onChange={(e) => onChange({ ...value, level: e.target.value as Level })} className={inputClass()}>
          <option value="high">高危</option>
          <option value="mid">中危</option>
          <option value="low">低危</option>
        </select>
      </Field>
      <Field label="立场">
        <select value={value.stance} onChange={(e) => onChange({ ...value, stance: e.target.value })} className={inputClass()}>
          <option value="any">全部</option>
          {Object.entries(STANCE_LABEL).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </Field>
      <Field label="文档类型">
        <input value={value.doc_type} onChange={(e) => onChange({ ...value, doc_type: e.target.value })} className={inputClass()} />
      </Field>
      <label className="flex items-end gap-2 pb-2 text-sm text-muted">
        <input type="checkbox" checked={value.enabled} onChange={(e) => onChange({ ...value, enabled: e.target.checked })} />
        启用
      </label>
      <div className="lg:col-span-6">
        <Field label="关键词">
          <input value={value.keywords} onChange={(e) => onChange({ ...value, keywords: e.target.value })} className={inputClass("w-full")} />
        </Field>
      </div>
    </div>
  );
}

function stripId({ id: _id, ...rest }: Redline): Omit<Redline, "id"> {
  return rest;
}
