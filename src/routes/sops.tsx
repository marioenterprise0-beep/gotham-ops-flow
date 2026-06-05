import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/gotham/AppShell";
import { Card, SectionHeader, StatusPill } from "@/components/gotham/primitives";
import { ChefHat, Coffee, Shield, Sparkles, Heart, Search, ArrowLeft, Check, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { requireAuthBeforeLoad } from "@/lib/require-auth";
import { listSops, upsertSop, deleteSop } from "@/lib/sops.functions";
import { useRole } from "@/lib/role";
import { toast } from "sonner";

export const Route = createFileRoute("/sops")({
  ssr: false,
  beforeLoad: requireAuthBeforeLoad,
  head: () => ({ meta: [{ title: "SOP Library · Gotham OS" }] }),
  component: SOPs,
});


type Cat = "All" | "Kitchen" | "Front" | "Management" | "Cleaning" | "Hospitality";

type SOP = {
  id: string; title: string; cat: Exclude<Cat, "All">; role: string; readMin: number;
  updated: string;
  objective: string;
  steps: string[];
  standard: string;
  errors: string[];
};

const SOPS: SOP[] = [
  // Kitchen
  { id: "k1", title: "How to Smash and Cook a Burger Patty", cat: "Kitchen", role: "Grill Master", readMin: 4, updated: "2 days ago",
    objective: "Produce a 4 oz patty with crisp lace edge and pink interior at 160°F.",
    steps: ["Pull ball from cold storage", "Place on 400°F flat top", "Smash with press for 8 seconds", "Salt immediately", "Flip at 90 seconds", "Cheese at flip, melt 30s", "Plate within 15 seconds of pull"],
    standard: "Internal temp 160°F. Lace edge visible. Melted cheese.",
    errors: ["Press not held flat", "Salted before smash (steams)", "Flipped too early"] },
  { id: "k2", title: "Grill Startup and Shutdown Procedure", cat: "Kitchen", role: "Grill Master", readMin: 3, updated: "1 week ago",
    objective: "Safely bring grill to operating temp and shut down without residue buildup.",
    steps: ["Confirm hood vent on", "Ignite at low for 90s", "Ramp to 400°F", "Scrape & oil at shutdown", "Cover when cool"],
    standard: "Reaches 400°F within 8 min. No carbon buildup.",
    errors: ["Ramped before vent on", "Skipped scrape on shutdown"] },
  { id: "k3", title: "Cold Storage Temperature Protocol", cat: "Kitchen", role: "Grill Master", readMin: 2, updated: "today",
    objective: "Maintain 34–38°F at all times. Verify every shift.",
    steps: ["Open door for ≤10s", "Verify thermometer reads 34–38°F", "Log on opening checklist", "If outside range, escalate"],
    standard: "Reading 34–38°F. Logged twice daily.",
    errors: ["Door left ajar", "Reading from rear of unit only"] },
  { id: "k4", title: "Mise en Place Setup Standard", cat: "Kitchen", role: "Prep", readMin: 3, updated: "3 days ago",
    objective: "All ingredients staged before service.", steps: ["Stage sauces", "Slice toppings", "Portion patties", "Label & cover"],
    standard: "All bins labeled, dated, covered.", errors: ["Unlabeled bins", "Mixed dates"] },
  { id: "k5", title: "Protein Thaw and Holding Protocol", cat: "Kitchen", role: "Prep", readMin: 2, updated: "1 week ago",
    objective: "Thaw safely under refrigeration. Never on counter.",
    steps: ["Pull from freezer 24h prior", "Hold below 38°F", "Use within 48h"],
    standard: "FIFO. No counter thaw.",
    errors: ["Counter thaw", "Lost date tags"] },
  // Front
  { id: "f1", title: "Guest Greeting Standard", cat: "Front", role: "Cashier", readMin: 1, updated: "today",
    objective: "Greet every guest within 5 seconds.",
    steps: ["Make eye contact", "Smile", "Say: 'Welcome to Gotham Halal!'", "Offer combo upsell"],
    standard: "5-second rule. Verbal greeting + eye contact.",
    errors: ["Silent greeting", "No eye contact"] },
  { id: "f2", title: "Order Taking and Upsell Script", cat: "Front", role: "Cashier", readMin: 2, updated: "2 weeks ago",
    objective: "Confirm order and upsell drink or combo on every ticket.",
    steps: ["Repeat back order", "Ask drink", "Confirm size/combo", "Read total"],
    standard: "Upsell asked 100% of orders.",
    errors: ["Skipped upsell", "Did not confirm total"] },
  { id: "f3", title: "Drink Station Setup", cat: "Front", role: "Cashier", readMin: 2, updated: "1 week ago",
    objective: "Stage cups, lids, straws, ice for full shift.",
    steps: ["Stack cups L→S", "Lids matched", "Ice topped at start"], standard: "Station fully stocked at open.", errors: ["Ice empty", "Mismatched lids"] },
  { id: "f4", title: "Counter Cleanliness Cycle", cat: "Front", role: "Cashier", readMin: 2, updated: "today",
    objective: "Wipe-down every 15 minutes during service.",
    steps: ["Clear debris", "Sanitize wipe", "Restock napkins"], standard: "15-min cadence. No visible debris.", errors: ["Cycle skipped", "Wet counter"] },
  // Management
  { id: "m1", title: "Shift Handoff Protocol", cat: "Management", role: "Shift Lead", readMin: 3, updated: "4 days ago",
    objective: "Transfer all relevant state to next shift lead.",
    steps: ["Walk inventory together", "Review open issues", "Sign handoff log"], standard: "Both leads signed.", errors: ["Verbal-only handoff"] },
  { id: "m2", title: "Corrective Action Documentation", cat: "Management", role: "Manager", readMin: 4, updated: "1 week ago",
    objective: "Document any task failure with timestamp + action taken.",
    steps: ["Capture failure", "Note corrective action", "Sign + timestamp", "Escalate if needed"], standard: "Every fail has documented action.", errors: ["No corrective action recorded"] },
  { id: "m3", title: "Inventory Receiving Procedure", cat: "Management", role: "Shift Lead", readMin: 3, updated: "2 weeks ago",
    objective: "Verify quantity, temp, and condition at delivery.",
    steps: ["Check invoice vs items", "Temp probe proteins", "Sign receipt"], standard: "Proteins ≤40°F.", errors: ["No temp probe"] },
  { id: "m4", title: "End of Shift Summary Process", cat: "Management", role: "Shift Lead", readMin: 3, updated: "today",
    objective: "Summarize tickets, waste, hospitality, incidents.",
    steps: ["Pull POS report", "Reconcile waste log", "Submit summary"], standard: "Submitted within 30 min of close.", errors: ["Late submission"] },
  // Cleaning
  { id: "c1", title: "30-Minute Cleaning Cycle", cat: "Cleaning", role: "Cashier", readMin: 2, updated: "today",
    objective: "Rotate cleaning every 30 minutes during service.",
    steps: ["Counter wipe", "Trash check", "Floor sweep"], standard: "30-min cadence verified.", errors: ["Skipped cycles"] },
  { id: "c2", title: "Grill Deep Clean Protocol", cat: "Cleaning", role: "Grill Master", readMin: 5, updated: "1 week ago",
    objective: "Weekly deep clean of flat top.",
    steps: ["Cool to 200°F", "Scrape carbon", "Degreaser", "Rinse + season"], standard: "No residue. Seasoned.", errors: ["Cleaned hot (warps)"] },
  { id: "c3", title: "Front Counter Reset Standard", cat: "Cleaning", role: "Cashier", readMin: 2, updated: "3 days ago",
    objective: "Reset counter to spec between rushes.",
    steps: ["Clear", "Wipe", "Restock"], standard: "Spec photo matched.", errors: ["Skipped restock"] },
  // Hospitality
  { id: "h1", title: "Guest Recovery Protocol", cat: "Hospitality", role: "Shift Lead", readMin: 3, updated: "2 days ago",
    objective: "Recover any unhappy guest within 60 seconds: Acknowledge, Apologize, Act.",
    steps: ["Acknowledge issue", "Apologize sincerely", "Take action (remake / refund)", "Confirm satisfaction"], standard: "Resolved within 60s.", errors: ["Excuses instead of apology"] },
  { id: "h2", title: "Reading the Line (Queue Management)", cat: "Hospitality", role: "Shift Lead", readMin: 2, updated: "1 week ago",
    objective: "Anticipate wait pain points before guests escalate.",
    steps: ["Scan line every 60s", "Acknowledge waits >3 min", "Offer water / sample"], standard: "Every >3 min wait acknowledged.", errors: ["Wait ignored"] },
  { id: "h3", title: "Handling Special Requests", cat: "Hospitality", role: "Cashier", readMin: 2, updated: "5 days ago",
    objective: "Accommodate or politely decline with alternative.",
    steps: ["Listen fully", "Check feasibility", "Confirm or offer alt"], standard: "No flat 'no' without alt.", errors: ["Refused without alternative"] },
];

const CAT_ICON: Record<Exclude<Cat, "All">, typeof ChefHat> = {
  Kitchen: ChefHat, Front: Coffee, Management: Shield, Cleaning: Sparkles, Hospitality: Heart,
};
const CAT_COLOR: Record<Exclude<Cat, "All">, string> = {
  Kitchen: "#8B4513", Front: "#7B3FA0", Management: "#C0392B", Cleaning: "#2D6CDF", Hospitality: "#C9973A",
};

function SOPs() {
  const [cat, setCat] = useState<Cat>("All");
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const list = useMemo(() => SOPS.filter((s) => (cat === "All" || s.cat === cat) && s.title.toLowerCase().includes(q.toLowerCase())), [cat, q]);
  const active = openId ? SOPS.find((s) => s.id === openId) : null;

  if (active) return <SOPDetail sop={active} onBack={() => setOpenId(null)} />;

  return (
    <AppShell>
      <Card dark>
        <div className="label-caps text-white/55">Standard Operating Procedures</div>
        <h1 className="font-display text-3xl mt-1 text-white">SOP LIBRARY</h1>
        <div className="mt-4 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search procedures…"
            className="w-full bg-[#1C1C1C] border border-[#2A2A2A] rounded-md pl-10 pr-3 py-2.5 text-sm text-white placeholder:text-white/40 outline-none focus:border-[var(--color-gold)]" />
        </div>
      </Card>

      <div className="mt-4 -mx-4 px-4 overflow-x-auto">
        <div className="flex gap-2 min-w-max">
          {(["All","Kitchen","Front","Management","Cleaning","Hospitality"] as Cat[]).map((c) => (
            <button key={c} onClick={() => setCat(c)}
              className={cn(
                "rounded-md px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[1.2px] border transition",
                c === cat ? "bg-[#0A0A0A] text-[var(--color-gold)] border-[#0A0A0A]" : "bg-card text-muted-foreground border-border hover:text-foreground",
              )}>{c}</button>
          ))}
        </div>
      </div>

      <SectionHeader eyebrow={cat} title={`${list.length} procedures`} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {list.map((s) => {
          const Icon = CAT_ICON[s.cat]; const color = CAT_COLOR[s.cat];
          return (
            <button key={s.id} onClick={() => setOpenId(s.id)} className="text-left">
              <Card className="h-full hover:border-[var(--color-gold)] transition">
                <div className="flex items-center gap-2 mb-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: color }} />
                  <span className="label-caps" style={{ color }}>{s.cat}</span>
                </div>
                <div className="font-semibold text-[15px] leading-snug">{s.title}</div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Icon className="h-3.5 w-3.5" /> {s.role}
                  </div>
                  <div className="label-caps text-muted-foreground">{s.readMin} min</div>
                </div>
                <div className="mt-2 text-[10px] text-muted-foreground">Updated {s.updated}</div>
              </Card>
            </button>
          );
        })}
        {list.length === 0 && <div className="col-span-full text-center text-sm text-muted-foreground py-12">No matching SOPs.</div>}
      </div>

      <div className="h-6" />
    </AppShell>
  );
}

function SOPDetail({ sop, onBack }: { sop: SOP; onBack: () => void }) {
  const Icon = CAT_ICON[sop.cat]; const color = CAT_COLOR[sop.cat];
  const [signed, setSigned] = useState(false);
  return (
    <AppShell>
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> Back to library
      </button>

      <Card>
        <div className="flex items-center gap-2 mb-2">
          <Icon className="h-4 w-4" style={{ color }} />
          <span className="label-caps" style={{ color }}>{sop.cat}</span>
          <span className="label-caps text-muted-foreground">· {sop.role}</span>
        </div>
        <h1 className="font-display text-3xl text-foreground">{sop.title.toUpperCase()}</h1>
        <div className="mt-1 text-xs text-muted-foreground">Updated {sop.updated} · {sop.readMin} min read</div>

        <div className="mt-5 pl-3 border-l-2 border-[var(--color-gold)]">
          <div className="label-caps text-muted-foreground mb-1">Objective</div>
          <div className="text-sm text-foreground leading-relaxed">{sop.objective}</div>
        </div>

        <h2 className="mt-6 font-semibold text-lg">Step by step</h2>
        <ol className="mt-3 space-y-2.5">
          {sop.steps.map((step, i) => (
            <li key={i} className="flex gap-3">
              <div className="h-6 w-6 shrink-0 rounded-full bg-[#0A0A0A] text-white text-xs font-semibold grid place-items-center">{i + 1}</div>
              <div className="text-sm leading-snug pt-0.5">{step}</div>
            </li>
          ))}
        </ol>

        <div className="mt-6 rounded-md bg-[var(--color-success-bg)] border border-[var(--color-success)]/30 p-3">
          <div className="label-caps text-[var(--color-success)] mb-1">Pass Standard</div>
          <div className="text-sm text-foreground">{sop.standard}</div>
        </div>

        <div className="mt-3 rounded-md bg-[var(--color-danger-bg)] border border-[var(--color-danger)]/30 p-3">
          <div className="label-caps text-[var(--color-danger)] mb-2">Common Errors</div>
          <ul className="space-y-1 text-sm">
            {sop.errors.map((e) => <li key={e}>· {e}</li>)}
          </ul>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="aspect-video rounded-md bg-secondary border border-dashed border-border grid place-items-center text-xs text-muted-foreground">Photo slot</div>
          <div className="aspect-video rounded-md bg-secondary border border-dashed border-border grid place-items-center text-xs text-muted-foreground">Illustration slot</div>
        </div>

        <button
          onClick={() => setSigned(true)}
          disabled={signed}
          className={cn(
            "mt-6 w-full inline-flex items-center justify-center gap-2 rounded-lg px-4 py-3 font-semibold text-sm",
            signed ? "bg-[var(--color-success-bg)] text-[var(--color-success)] border border-[var(--color-success)]/40" : "bg-[var(--color-gold)] text-[#0A0A0A]",
          )}>
          {signed ? (<><Check className="h-4 w-4" /> Signed off at {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</>) : "Sign off — I've read this SOP"}
        </button>
      </Card>

      <div className="h-6" />
    </AppShell>
  );
}
