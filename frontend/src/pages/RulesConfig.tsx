import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Plus, Save, Settings2, Trash2 } from "lucide-react";
import {
  createRedline,
  deleteRedline,
  getReviewTemplates,
  getRulesConfig,
  getScoringConfig,
  listRedlines,
  saveReviewTemplates,
  saveRulesConfig,
  saveScoringConfig,
  updateRedline,
} from "../lib/api";
import type {
  Level,
  Redline,
  ReviewTemplate,
  RuleConfig,
  RuleConfigByTemplate,
  ScoringConfig,
  ScoringConfigByTemplate,
} from "../types";
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

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function alignRuleConfig(config: Record<string, RuleConfig>, templates: ReviewTemplate[]): RuleConfigByTemplate {
  const fallback = config[templates[0]?.key] ?? Object.values(config)[0];
  if (!fallback) return {};
  return Object.fromEntries(
    templates.map((template) => [template.key, cloneValue(config[template.key] ?? fallback)])
  ) as RuleConfigByTemplate;
}

function alignScoringConfig(config: Record<string, ScoringConfig>, templates: ReviewTemplate[]): ScoringConfigByTemplate {
  const fallback = config[templates[0]?.key] ?? Object.values(config)[0];
  if (!fallback) return {};
  return Object.fromEntries(
    templates.map((template) => [template.key, cloneValue(config[template.key] ?? fallback)])
  ) as ScoringConfigByTemplate;
}

function nextTemplateKey(templates: ReviewTemplate[]) {
  let index = templates.length + 1;
  const keys = new Set(templates.map((item) => item.key));
  while (keys.has(`template_${index}`)) index += 1;
  return `template_${index}`;
}

export default function RulesConfigPage() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<ReviewTemplate[] | null>(null);
  const [activeTemplate, setActiveTemplate] = useState("");
  const [rulesByTemplate, setRulesByTemplate] = useState<RuleConfigByTemplate | null>(null);
  const [scoringByTemplate, setScoringByTemplate] = useState<ScoringConfigByTemplate | null>(null);
  const [redlines, setRedlines] = useState<Redline[]>([]);
  const [newRedline, setNewRedline] = useState<Omit<Redline, "id">>(EMPTY_REDLINE);
  const [error, setError] = useState<string | null>(null);
  const [savingTemplates, setSavingTemplates] = useState(false);

  useEffect(() => {
    Promise.all([getReviewTemplates(), getRulesConfig(), getScoringConfig(), listRedlines()])
      .then(([templateItems, ruleConfig, scoringConfig, redlineItems]) => {
        setTemplates(templateItems);
        setRulesByTemplate(alignRuleConfig(ruleConfig, templateItems));
        setScoringByTemplate(alignScoringConfig(scoringConfig, templateItems));
        setActiveTemplate(templateItems[0]?.key ?? "");
        setRedlines(redlineItems);
      })
      .catch((e) => setError(String(e.message ?? e)));
  }, []);

  const redlineStats = useMemo(() => {
    const enabled = redlines.filter((item) => item.enabled).length;
    return { enabled, disabled: redlines.length - enabled };
  }, [redlines]);

  const activeTemplateItem = templates?.find((item) => item.key === activeTemplate) ?? null;
  const activeRules = rulesByTemplate?.[activeTemplate] ?? null;
  const activeScoring = scoringByTemplate?.[activeTemplate] ?? null;

  function setActiveRules(next: RuleConfig) {
    if (!rulesByTemplate) return;
    setRulesByTemplate({ ...rulesByTemplate, [activeTemplate]: next });
  }

  function setActiveScoring(next: ScoringConfig) {
    if (!scoringByTemplate) return;
    setScoringByTemplate({ ...scoringByTemplate, [activeTemplate]: next });
  }

  function updateActiveTemplate(patch: Partial<ReviewTemplate>) {
    if (!templates) return;
    setTemplates(templates.map((item) => (item.key === activeTemplate ? { ...item, ...patch } : item)));
  }

  function addTemplate() {
    if (!templates || !rulesByTemplate || !scoringByTemplate) return;
    const key = nextTemplateKey(templates);
    const sourceRules = activeRules ?? Object.values(rulesByTemplate)[0];
    const sourceScoring = activeScoring ?? Object.values(scoringByTemplate)[0];
    if (!sourceRules || !sourceScoring) return;
    const next = { key, label: `新模板 ${templates.length + 1}`, hint: "" };
    setTemplates([...templates, next]);
    setRulesByTemplate({ ...rulesByTemplate, [key]: cloneValue(sourceRules) });
    setScoringByTemplate({ ...scoringByTemplate, [key]: cloneValue(sourceScoring) });
    setActiveTemplate(key);
  }

  function removeTemplate(key: string) {
    if (!templates || !rulesByTemplate || !scoringByTemplate) return;
    if (templates.length <= 1) {
      toast("至少保留一个审查模板", "error");
      return;
    }
    const nextTemplates = templates.filter((item) => item.key !== key);
    const { [key]: _removedRules, ...nextRules } = rulesByTemplate;
    const { [key]: _removedScoring, ...nextScoring } = scoringByTemplate;
    setTemplates(nextTemplates);
    setRulesByTemplate(nextRules);
    setScoringByTemplate(nextScoring);
    if (activeTemplate === key) {
      setActiveTemplate(nextTemplates[0]?.key ?? "");
    }
  }

  async function persistTemplates() {
    if (!templates || !rulesByTemplate || !scoringByTemplate) return;
    const cleanedTemplates = templates.map((item) => ({
      key: item.key,
      label: item.label.trim(),
      hint: item.hint.trim(),
    }));
    if (cleanedTemplates.some((item) => !item.label)) {
      toast("模板名称不能为空", "error");
      return;
    }
    setSavingTemplates(true);
    try {
      const normalizedRules = Object.fromEntries(
        cleanedTemplates.map((item) => [item.key, normalizeRuleConfig(rulesByTemplate[item.key])])
      ) as RuleConfigByTemplate;
      const normalizedScoring = Object.fromEntries(
        cleanedTemplates.map((item) => [item.key, normalizeScoringConfig(scoringByTemplate[item.key])])
      ) as ScoringConfigByTemplate;
      const [savedTemplates, savedRules, savedScoring] = await Promise.all([
        saveReviewTemplates(cleanedTemplates),
        saveRulesConfig(normalizedRules),
        saveScoringConfig(normalizedScoring),
      ]);
      setTemplates(savedTemplates);
      setRulesByTemplate(alignRuleConfig(savedRules, savedTemplates));
      setScoringByTemplate(alignScoringConfig(savedScoring, savedTemplates));
      setActiveTemplate(savedTemplates.some((item) => item.key === activeTemplate) ? activeTemplate : savedTemplates[0]?.key ?? "");
      toast("审查模板已保存");
    } catch (e) {
      toast(String(e instanceof Error ? e.message : e), "error");
    } finally {
      setSavingTemplates(false);
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

  if (!templates || !rulesByTemplate || !activeRules || !scoringByTemplate || !activeScoring || !activeTemplateItem) {
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
          <h1 className="text-2xl font-semibold text-ink">审查模板配置</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone="neutral">模板 {templates.length}</Badge>
          <Badge tone="good">启用红线 {redlineStats.enabled}</Badge>
          <Badge tone="neutral">停用 {redlineStats.disabled}</Badge>
        </div>
      </div>

      <div className="grid gap-6">
        <section className="rounded-card border border-line bg-surface shadow-soft">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-panel px-4 py-3">
            <div>
              <div className="text-sm font-semibold text-ink">审查模板</div>
              <div className="mt-1 text-xs text-muted">每个模板包含名称、条款规则和评分口径；新建审查时会复制为本次任务快照。</div>
            </div>
            <Button onClick={persistTemplates} disabled={savingTemplates}>
              <Save size={15} /> {savingTemplates ? "保存中" : "保存模板"}
            </Button>
          </div>

          <div className="grid gap-4 border-b border-line p-4 lg:grid-cols-[240px_minmax(0,1fr)]">
            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="text-sm font-medium text-ink2">模板列表</div>
                <Button variant="ghost" size="sm" onClick={addTemplate}>
                  <Plus size={14} /> 新增
                </Button>
              </div>
              <div className="grid gap-2">
                {templates.map((item) => (
                  <button
                    key={item.key}
                    onClick={() => setActiveTemplate(item.key)}
                    className={`rounded-control border px-3 py-2.5 text-left transition-colors ${
                      activeTemplate === item.key
                        ? "border-brand bg-brand-soft text-brand"
                        : "border-line bg-panel text-ink2 hover:border-brand/40 hover:bg-surface"
                    }`}
                  >
                    <span className="block truncate text-sm font-medium">{item.label || "未命名模板"}</span>
                    <span className="mt-1 block truncate text-xs text-muted">{item.hint || item.key}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-control border border-line bg-panel p-3">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-ink">模板信息</div>
                  <div className="mt-1 text-xs text-muted">模板 key 用于历史任务关联，创建后保持稳定。</div>
                </div>
                <Button variant="danger" size="sm" onClick={() => removeTemplate(activeTemplate)} disabled={templates.length <= 1}>
                  <Trash2 size={14} /> 删除模板
                </Button>
              </div>
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <Field label="模板名称">
                  <input
                    value={activeTemplateItem.label}
                    onChange={(e) => updateActiveTemplate({ label: e.target.value })}
                    className={inputClass("w-full bg-surface")}
                  />
                </Field>
                <Field label="模板说明">
                  <input
                    value={activeTemplateItem.hint}
                    onChange={(e) => updateActiveTemplate({ hint: e.target.value })}
                    className={inputClass("w-full bg-surface")}
                    placeholder="例如：采购方风险、保密审查"
                  />
                </Field>
              </div>
              <div className="mt-3 rounded-control border border-line bg-surface px-3 py-2 text-xs text-muted">
                模板 key：<span className="font-mono text-ink2">{activeTemplateItem.key}</span>
              </div>
            </div>
          </div>

          <div className="space-y-6 p-4">
            <RuleTemplateEditor value={activeRules} onChange={setActiveRules} />
            <div className="border-t border-line pt-5">
              <div className="mb-3 text-sm font-medium text-ink2">评分口径</div>
              <ScoringEditor value={activeScoring} onChange={setActiveScoring} />
            </div>
          </div>
        </section>

        <section className="rounded-card border border-line bg-surface shadow-soft">
          <div className="border-b border-line bg-panel px-4 py-3">
            <div className="text-sm font-semibold text-ink">红线库</div>
            <div className="mt-1 text-xs text-muted">启用的红线会参与“红线命中”检查，适用模板为“全部”或当前审查模板时生效。</div>
          </div>
          <div className="grid gap-3 p-4">
            {redlines.map((item) => (
              <RedlineEditor
                key={item.id}
                item={item}
                templates={templates}
                onChange={(next) => setRedlines((prev) => prev.map((row) => (row.id === next.id ? next : row)))}
                onSave={() => persistRedline(item)}
                onDelete={() => removeRedline(item.id)}
              />
            ))}
            <div className="rounded-card border border-dashed border-line-strong bg-panel p-3">
              <div className="mb-3 text-sm font-medium text-ink2">新增红线</div>
              <RedlineFields value={newRedline} templates={templates} onChange={setNewRedline} />
              <Button className="mt-3" onClick={addRedline} disabled={!newRedline.code.trim() || !newRedline.content.trim()}>
                <Plus size={15} /> 新增红线
              </Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function RedlineEditor({
  item,
  templates,
  onChange,
  onSave,
  onDelete,
}: {
  item: Redline;
  templates: ReviewTemplate[];
  onChange: (value: Redline) => void;
  onSave: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-card border border-line bg-panel p-3">
      <RedlineFields value={stripId(item)} templates={templates} onChange={(next) => onChange({ ...item, ...next })} />
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
  templates,
  onChange,
}: {
  value: Omit<Redline, "id">;
  templates: ReviewTemplate[];
  onChange: (value: Omit<Redline, "id">) => void;
}) {
  return (
    <div className="grid gap-3 lg:grid-cols-[100px_minmax(180px,1fr)_110px_132px_96px_90px]">
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
      <Field label="适用模板">
        <select value={value.stance} onChange={(e) => onChange({ ...value, stance: e.target.value })} className={inputClass()}>
          <option value="any">全部</option>
          {templates.map((item) => (
            <option key={item.key} value={item.key}>
              {item.label}
            </option>
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
