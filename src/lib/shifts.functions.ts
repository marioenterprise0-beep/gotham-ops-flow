import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// Gotham Halal — Performance Checklist Packet
// Opening (10–15 min) · Prep (60–75 min) · Closing (35–50 min) · Inventory (15–25 min)
const TEMPLATES = {
  opening: [
    // Open Trailer + Power On Equipment
    { section: "OPEN + POWER ON",   title: "Open trailer",                       assignee_role: "shift_lead", requires_signoff: false },
    { section: "OPEN + POWER ON",   title: "Turn on lights",                     assignee_role: "shift_lead", requires_signoff: false },
    { section: "OPEN + POWER ON",   title: "Turn on propane valves",             assignee_role: "shift_lead", requires_signoff: true  },
    { section: "OPEN + POWER ON",   title: "Turn on grills",                     assignee_role: "grill",      requires_signoff: false },
    { section: "OPEN + POWER ON",   title: "Turn on deep fryers",                assignee_role: "grill",      requires_signoff: false },
    // Tray + Station Check
    { section: "TRAY + STATION",    title: "Check all trays and stations for prep needs", assignee_role: "prep", requires_signoff: false },
    // Opening Sign-Off
    { section: "OPENING SIGN-OFF",  title: "Trailer open and ready",             assignee_role: "shift_lead", requires_signoff: true  },
    { section: "OPENING SIGN-OFF",  title: "Lights on",                          assignee_role: "shift_lead", requires_signoff: false },
    { section: "OPENING SIGN-OFF",  title: "Propane on",                         assignee_role: "shift_lead", requires_signoff: true  },
    { section: "OPENING SIGN-OFF",  title: "Grill heating",                      assignee_role: "grill",      requires_signoff: false },
    { section: "OPENING SIGN-OFF",  title: "Fryers heating",                     assignee_role: "grill",      requires_signoff: false },
    { section: "OPENING SIGN-OFF",  title: "Prep list identified",               assignee_role: "shift_lead", requires_signoff: true  },
  ],
  mid: [
    // Initial Tray Check + Setup
    { section: "TRAY CHECK + SETUP",  title: "Check all trays",                            assignee_role: "prep", requires_signoff: false },
    { section: "TRAY CHECK + SETUP",  title: "Organize prep priorities",                   assignee_role: "prep", requires_signoff: false },
    // Bacon + Onion Prep
    { section: "BACON + ONION PREP",  title: "Cut bacon in half",                          assignee_role: "prep", requires_signoff: false },
    { section: "BACON + ONION PREP",  title: "Start bacon on grill",                       assignee_role: "grill", requires_signoff: false },
    { section: "BACON + ONION PREP",  title: "Fill bacon trays to par — 2 full trays",     assignee_role: "prep", requires_signoff: false },
    { section: "BACON + ONION PREP",  title: "Fill onion trays to par — 2 full trays",     assignee_role: "prep", requires_signoff: false },
    // Lettuce + Jalapeño Prep
    { section: "LETTUCE + JALAPEÑO",  title: "Cut 4 heads of lettuce",                     assignee_role: "prep", requires_signoff: false },
    { section: "LETTUCE + JALAPEÑO",  title: "Put lettuce in quarter tray — 1 quarter tray", assignee_role: "prep", requires_signoff: false },
    { section: "LETTUCE + JALAPEÑO",  title: "Cut 2 bags of jalapeños",                    assignee_role: "prep", requires_signoff: false },
    { section: "LETTUCE + JALAPEÑO",  title: "Put jalapeños in tray — 1.5 full trays",     assignee_role: "prep", requires_signoff: false },
    // Ground Beef Prep
    { section: "GROUND BEEF PREP",    title: "Check ground beef inventory — 4–5 full trays", assignee_role: "grill", requires_signoff: false },
    { section: "GROUND BEEF PREP",    title: "Take out 2 bags of ground beef",             assignee_role: "grill", requires_signoff: false },
    { section: "GROUND BEEF PREP",    title: "Cook ground beef to 80–90%",                 assignee_role: "grill", requires_signoff: true  },
    { section: "GROUND BEEF PREP",    title: "Leave a little juice in beef",               assignee_role: "grill", requires_signoff: false },
    { section: "GROUND BEEF PREP",    title: "Put cooked beef into 2 half trays",          assignee_role: "grill", requires_signoff: false },
    // Sauce + Condiment Refill
    { section: "SAUCE + CONDIMENT",   title: "Fill 32 oz sauce bottles — 10–12 filled",    assignee_role: "prep", requires_signoff: false },
    { section: "SAUCE + CONDIMENT",   title: "Fill small sauce containers",                assignee_role: "prep", requires_signoff: false },
    { section: "SAUCE + CONDIMENT",   title: "Fill 1 full tray of container sauces",       assignee_role: "prep", requires_signoff: false },
    { section: "SAUCE + CONDIMENT",   title: "Fill 1 quarter tray of ketchup containers",  assignee_role: "prep", requires_signoff: false },
    // Dishwashing + Workspace Reset
    { section: "DISHES + RESET",      title: "Wash dishes as needed",                      assignee_role: "prep", requires_signoff: false },
    { section: "DISHES + RESET",      title: "Clean and tidy workspace",                   assignee_role: "prep", requires_signoff: false },
    // Prep Par / Final Sign-Off
    { section: "PREP PAR SIGN-OFF",   title: "Bacon = 2 full trays",                       assignee_role: "shift_lead", requires_signoff: true },
    { section: "PREP PAR SIGN-OFF",   title: "Onions = 2 full trays",                      assignee_role: "shift_lead", requires_signoff: true },
    { section: "PREP PAR SIGN-OFF",   title: "Lettuce = 1 quarter tray",                   assignee_role: "shift_lead", requires_signoff: true },
    { section: "PREP PAR SIGN-OFF",   title: "Jalapeños = 1.5 full trays",                 assignee_role: "shift_lead", requires_signoff: true },
    { section: "PREP PAR SIGN-OFF",   title: "Ground beef = 4–5 full trays",               assignee_role: "shift_lead", requires_signoff: true },
    { section: "PREP PAR SIGN-OFF",   title: "Cooked ground beef = 2 half trays",          assignee_role: "shift_lead", requires_signoff: true },
    { section: "PREP PAR SIGN-OFF",   title: "Sauce bottles = 10–12 filled",               assignee_role: "shift_lead", requires_signoff: true },
    { section: "PREP PAR SIGN-OFF",   title: "Container sauces = 1 full tray",             assignee_role: "shift_lead", requires_signoff: true },
    { section: "PREP PAR SIGN-OFF",   title: "Ketchup containers = 1 quarter tray",        assignee_role: "shift_lead", requires_signoff: true },
    { section: "PREP PAR SIGN-OFF",   title: "Dishes handled",                             assignee_role: "shift_lead", requires_signoff: false },
    { section: "PREP PAR SIGN-OFF",   title: "Workspace shift-ready",                      assignee_role: "shift_lead", requires_signoff: true },
  ],
  closing: [
    // Shutdown Equipment
    { section: "SHUTDOWN EQUIPMENT",  title: "Turn off both grills",                       assignee_role: "grill",      requires_signoff: true  },
    { section: "SHUTDOWN EQUIPMENT",  title: "Turn off deep fryers",                       assignee_role: "grill",      requires_signoff: true  },
    { section: "SHUTDOWN EQUIPMENT",  title: "Turn off steam table from knobs",            assignee_role: "grill",      requires_signoff: true  },
    // Clean + Cover
    { section: "CLEAN + COVER",       title: "Clean workstations",                         assignee_role: "prep",       requires_signoff: false },
    { section: "CLEAN + COVER",       title: "Cover all vegetables and meat",              assignee_role: "prep",       requires_signoff: true  },
    // Next-Day Meat Pull
    { section: "NEXT-DAY MEAT PULL",  title: "Pull ground beef from freezer — 20–25 bags (4 bags = 1 tray)", assignee_role: "grill", requires_signoff: true },
    { section: "NEXT-DAY MEAT PULL",  title: "Pull bacon from freezer — 2–3 bags",         assignee_role: "grill",      requires_signoff: true  },
    { section: "NEXT-DAY MEAT PULL",  title: "Move ground beef & bacon to fridge if weather is warm", assignee_role: "grill", requires_signoff: false },
    // Dishes + Sinks
    { section: "DISHES + SINKS",      title: "Wash all dishes",                            assignee_role: "prep",       requires_signoff: false },
    { section: "DISHES + SINKS",      title: "Clean sinks",                                assignee_role: "prep",       requires_signoff: false },
    // Floors + Mats + Trash
    { section: "FLOORS + TRASH",      title: "Sweep floors",                               assignee_role: "prep",       requires_signoff: false },
    { section: "FLOORS + TRASH",      title: "Take out mats and remove debris",            assignee_role: "prep",       requires_signoff: false },
    { section: "FLOORS + TRASH",      title: "Remove all filled garbage bags",             assignee_role: "prep",       requires_signoff: false },
    { section: "FLOORS + TRASH",      title: "Install new empty garbage bags",             assignee_role: "prep",       requires_signoff: false },
    { section: "FLOORS + TRASH",      title: "Throw discarded boxes in dumpster",          assignee_role: "prep",       requires_signoff: false },
    // Final Readiness
    { section: "FINAL READINESS",     title: "Check inventory for next day",               assignee_role: "shift_lead", requires_signoff: true  },
    { section: "FINAL READINESS",     title: "Ensure enough 6QT sauce buckets",            assignee_role: "shift_lead", requires_signoff: false },
    { section: "FINAL READINESS",     title: "Plug work phone into charger",               assignee_role: "shift_lead", requires_signoff: false },
    { section: "FINAL READINESS",     title: "Plug wireless card reader into charger",     assignee_role: "shift_lead", requires_signoff: false },
    { section: "FINAL READINESS",     title: "Trailer ready for next day",                 assignee_role: "shift_lead", requires_signoff: true  },
    // Closing Sign-Off
    { section: "CLOSING SIGN-OFF",    title: "Grills off",                                 assignee_role: "shift_lead", requires_signoff: true  },
    { section: "CLOSING SIGN-OFF",    title: "Fryers off",                                 assignee_role: "shift_lead", requires_signoff: true  },
    { section: "CLOSING SIGN-OFF",    title: "Steam table off",                            assignee_role: "shift_lead", requires_signoff: true  },
    { section: "CLOSING SIGN-OFF",    title: "Workstations cleaned",                       assignee_role: "shift_lead", requires_signoff: false },
    { section: "CLOSING SIGN-OFF",    title: "Vegetables & meat covered",                  assignee_role: "shift_lead", requires_signoff: true  },
    { section: "CLOSING SIGN-OFF",    title: "Ground beef pulled — 20–25 bags",            assignee_role: "shift_lead", requires_signoff: true  },
    { section: "CLOSING SIGN-OFF",    title: "Bacon pulled — 2–3 bags",                    assignee_role: "shift_lead", requires_signoff: true  },
    { section: "CLOSING SIGN-OFF",    title: "Dishes washed, sinks cleaned",               assignee_role: "shift_lead", requires_signoff: false },
    { section: "CLOSING SIGN-OFF",    title: "Floors swept, mats cleaned",                 assignee_role: "shift_lead", requires_signoff: false },
    { section: "CLOSING SIGN-OFF",    title: "Trash removed, new bags installed",          assignee_role: "shift_lead", requires_signoff: false },
    { section: "CLOSING SIGN-OFF",    title: "Boxes discarded",                            assignee_role: "shift_lead", requires_signoff: false },
    { section: "CLOSING SIGN-OFF",    title: "Inventory checked, 6QT buckets stocked",     assignee_role: "shift_lead", requires_signoff: true  },
    { section: "CLOSING SIGN-OFF",    title: "Trailer ready for next day",                 assignee_role: "shift_lead", requires_signoff: true  },
  ],
  emergency: [
    // Inventory Check Checklist (15–25 minutes)
    // Vegetables / Perishables
    { section: "VEGETABLES / PERISHABLES", title: "Lettuce — 10 heads",                    assignee_role: "shift_lead", requires_signoff: false },
    { section: "VEGETABLES / PERISHABLES", title: "Tomatoes — 20 tomatoes",                assignee_role: "shift_lead", requires_signoff: false },
    { section: "VEGETABLES / PERISHABLES", title: "Onions — 1/2 bag minimum",              assignee_role: "shift_lead", requires_signoff: false },
    { section: "VEGETABLES / PERISHABLES", title: "Pickles — 3 jars",                      assignee_role: "shift_lead", requires_signoff: false },
    { section: "VEGETABLES / PERISHABLES", title: "American Cheese — 6 packs",             assignee_role: "shift_lead", requires_signoff: false },
    { section: "VEGETABLES / PERISHABLES", title: "Pepper Jack Cheese — 2 packs",          assignee_role: "shift_lead", requires_signoff: false },
    { section: "VEGETABLES / PERISHABLES", title: "Jalapeños — 3 bags",                    assignee_role: "shift_lead", requires_signoff: false },
    { section: "VEGETABLES / PERISHABLES", title: "Unsalted Butter — 3 packs",             assignee_role: "shift_lead", requires_signoff: false },
    { section: "VEGETABLES / PERISHABLES", title: "Brioche Buns — 7 cases",                assignee_role: "shift_lead", requires_signoff: false },
    // Meats
    { section: "MEATS",                    title: "Bacon — 6 bags",                        assignee_role: "shift_lead", requires_signoff: false },
    { section: "MEATS",                    title: "Ground Beef — 50 bags",                 assignee_role: "shift_lead", requires_signoff: false },
    // Sauces
    { section: "SAUCES",                   title: "Chipotle Sauce — 6 containers",         assignee_role: "shift_lead", requires_signoff: false },
    { section: "SAUCES",                   title: "Sweet Relish — 3 jars",                 assignee_role: "shift_lead", requires_signoff: false },
    { section: "SAUCES",                   title: "Ketchup — 3 containers",                assignee_role: "shift_lead", requires_signoff: false },
    { section: "SAUCES",                   title: "Mild Cheddar Cheese Sauce — 1 container min", assignee_role: "shift_lead", requires_signoff: false },
    { section: "SAUCES",                   title: "Sazon Seasoning — 1 full box min",      assignee_role: "shift_lead", requires_signoff: false },
    { section: "SAUCES",                   title: "Hellmann's Mayonnaise — 2 containers",  assignee_role: "shift_lead", requires_signoff: false },
    { section: "SAUCES",                   title: "Cajun Seasoning — 1 container min",     assignee_role: "shift_lead", requires_signoff: false },
    // Takeout / Supplies
    { section: "TAKEOUT + SUPPLIES",       title: "9x6\" container — 1 case min",          assignee_role: "shift_lead", requires_signoff: false },
    { section: "TAKEOUT + SUPPLIES",       title: "6x6\" container — 1 case min",          assignee_role: "shift_lead", requires_signoff: false },
    { section: "TAKEOUT + SUPPLIES",       title: "8x8\" container — 1 case min",          assignee_role: "shift_lead", requires_signoff: false },
    { section: "TAKEOUT + SUPPLIES",       title: "16 oz cups — 15 bags",                  assignee_role: "shift_lead", requires_signoff: false },
    { section: "TAKEOUT + SUPPLIES",       title: "Dome lids — 15 bags",                   assignee_role: "shift_lead", requires_signoff: false },
    { section: "TAKEOUT + SUPPLIES",       title: "White straws — 3 boxes",                assignee_role: "shift_lead", requires_signoff: false },
    { section: "TAKEOUT + SUPPLIES",       title: "Heavy duty forks — 1 box",              assignee_role: "shift_lead", requires_signoff: false },
    { section: "TAKEOUT + SUPPLIES",       title: "Sauce containers + lids — 5 bags",      assignee_role: "shift_lead", requires_signoff: false },
    { section: "TAKEOUT + SUPPLIES",       title: "Black napkins — 8 packages",            assignee_role: "shift_lead", requires_signoff: false },
    { section: "TAKEOUT + SUPPLIES",       title: "4 cup tray holder — 6 bags",            assignee_role: "shift_lead", requires_signoff: false },
    { section: "TAKEOUT + SUPPLIES",       title: "2 cup tray holder — 6 bags",            assignee_role: "shift_lead", requires_signoff: false },
    { section: "TAKEOUT + SUPPLIES",       title: "33 gallon garbage bags — 2 boxes",      assignee_role: "shift_lead", requires_signoff: false },
    { section: "TAKEOUT + SUPPLIES",       title: "13 gallon garbage bags — 1 box",        assignee_role: "shift_lead", requires_signoff: false },
    { section: "TAKEOUT + SUPPLIES",       title: "Black gloves — 2 boxes",                assignee_role: "shift_lead", requires_signoff: false },
    { section: "TAKEOUT + SUPPLIES",       title: "Cintas towels — 1 roll",                assignee_role: "shift_lead", requires_signoff: false },
    { section: "TAKEOUT + SUPPLIES",       title: "T-shirt take-out bags — 5 boxes",       assignee_role: "shift_lead", requires_signoff: false },
    { section: "TAKEOUT + SUPPLIES",       title: "Food service cling film — 1 package",   assignee_role: "shift_lead", requires_signoff: false },
    { section: "TAKEOUT + SUPPLIES",       title: "Black checkered sheets 12x12\" — 1 box", assignee_role: "shift_lead", requires_signoff: false },
    { section: "TAKEOUT + SUPPLIES",       title: "Logan wrap 15x10 3/4\" — 2 boxes",      assignee_role: "shift_lead", requires_signoff: false },
    { section: "TAKEOUT + SUPPLIES",       title: "Aluminum foil 1000 sq ft — 1 box",      assignee_role: "shift_lead", requires_signoff: false },
    // Dirty Sodas
    { section: "DIRTY SODAS",              title: "Vanilla Syrup — 6",                     assignee_role: "shift_lead", requires_signoff: false },
    { section: "DIRTY SODAS",              title: "Coconut Syrup — 3",                     assignee_role: "shift_lead", requires_signoff: false },
    { section: "DIRTY SODAS",              title: "Blue Raspberry Syrup — 3",              assignee_role: "shift_lead", requires_signoff: false },
    { section: "DIRTY SODAS",              title: "Strawberry Syrup — 3",                  assignee_role: "shift_lead", requires_signoff: false },
    { section: "DIRTY SODAS",              title: "Watermelon Syrup — 3",                  assignee_role: "shift_lead", requires_signoff: false },
    { section: "DIRTY SODAS",              title: "Mango Syrup — 3",                       assignee_role: "shift_lead", requires_signoff: false },
    { section: "DIRTY SODAS",              title: "Pineapple Syrup — 3",                   assignee_role: "shift_lead", requires_signoff: false },
    { section: "DIRTY SODAS",              title: "Peach Syrup — 3",                       assignee_role: "shift_lead", requires_signoff: false },
    { section: "DIRTY SODAS",              title: "Green Apple Syrup — 3",                 assignee_role: "shift_lead", requires_signoff: false },
    { section: "DIRTY SODAS",              title: "Ice bags — 3 bags",                     assignee_role: "shift_lead", requires_signoff: false },
    { section: "DIRTY SODAS",              title: "Sprite — 6 cases",                      assignee_role: "shift_lead", requires_signoff: false },
    { section: "DIRTY SODAS",              title: "Cold Foam — 12 bottles",                assignee_role: "shift_lead", requires_signoff: false },
    // French Fries
    { section: "FRENCH FRIES",             title: "Canola Creamy Fry Oil — 2 boxes",       assignee_role: "shift_lead", requires_signoff: false },
    { section: "FRENCH FRIES",             title: "Excalibur Premium Fries — 8 boxes / 40 bags", assignee_role: "shift_lead", requires_signoff: false },
    // Cleaning
    { section: "CLEANING SUPPLIES",        title: "Dawn Dish Sanitizer — 1 bucket",        assignee_role: "shift_lead", requires_signoff: false },
    { section: "CLEANING SUPPLIES",        title: "Cleaning towels — 1 bag",               assignee_role: "shift_lead", requires_signoff: false },
    { section: "CLEANING SUPPLIES",        title: "Cleaning Spray — 1 bottle",             assignee_role: "shift_lead", requires_signoff: false },
    // Final Sign-Off
    { section: "INVENTORY SIGN-OFF",       title: "Vegetables/perishables at min stock",   assignee_role: "manager",    requires_signoff: true  },
    { section: "INVENTORY SIGN-OFF",       title: "Meats at min stock",                    assignee_role: "manager",    requires_signoff: true  },
    { section: "INVENTORY SIGN-OFF",       title: "Sauces at min stock",                   assignee_role: "manager",    requires_signoff: true  },
    { section: "INVENTORY SIGN-OFF",       title: "Takeout containers/supplies at min",    assignee_role: "manager",    requires_signoff: true  },
    { section: "INVENTORY SIGN-OFF",       title: "Dirty soda inventory at min",           assignee_role: "manager",    requires_signoff: true  },
    { section: "INVENTORY SIGN-OFF",       title: "French fry inventory at min",           assignee_role: "manager",    requires_signoff: true  },
    { section: "INVENTORY SIGN-OFF",       title: "Cleaning supplies at min",              assignee_role: "manager",    requires_signoff: true  },
    { section: "INVENTORY SIGN-OFF",       title: "Low items identified",                  assignee_role: "manager",    requires_signoff: true  },
    { section: "INVENTORY SIGN-OFF",       title: "Restock needs noted",                   assignee_role: "manager",    requires_signoff: true  },
    { section: "INVENTORY SIGN-OFF",       title: "Next-day needs communicated",           assignee_role: "manager",    requires_signoff: true  },
  ],
} as const;

async function resolveTrailer(supabase: any, userId: string, trailerId?: string | null) {
  if (trailerId) return trailerId;
  const { data: profile } = await supabase.from("profiles").select("trailer_id").eq("id", userId).maybeSingle();
  if (profile?.trailer_id) return profile.trailer_id as string;
  const { data: trailer } = await supabase.from("trailers").select("id").order("created_at").limit(1).maybeSingle();
  return trailer?.id ?? null;
}

export const getActiveShift = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ trailerId: z.string().uuid().nullable().optional() }).optional().parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: store } = await supabase.from("stores").select("id, name").order("created_at").limit(1).maybeSingle();
    const trailerId = await resolveTrailer(supabase, userId, data?.trailerId ?? null);

    let q = supabase.from("shifts").select("*").is("archived_at", null).eq("status", "active").order("opened_at", { ascending: false }).limit(1);
    if (trailerId) q = q.eq("trailer_id", trailerId);
    const { data: shift } = await q.maybeSingle();
    return { shift, store, trailerId };
  });

async function seedPhaseIfMissing(
  supabase: any,
  shiftId: string,
  trailerId: string | null,
  phase: "opening" | "mid" | "closing" | "emergency",
  actorId?: string,
  trigger: "open_shift" | "reopen_shift" | "seed_phase" = "open_shift",
) {
  const { count } = await supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("shift_id", shiftId)
    .eq("phase", phase);
  if ((count ?? 0) > 0) return 0;
  const rows = TEMPLATES[phase].map((t) => ({
    shift_id: shiftId,
    phase,
    title: t.title,
    description: t.section,
    assignee_role: t.assignee_role,
    requires_signoff: t.requires_signoff,
    status: "todo" as const,
    trailer_id: trailerId,
  }));
  await supabase.from("tasks").insert(rows);
  if (rows.length > 0 && (phase === "opening" || phase === "closing")) {
    await supabase.from("audit_log").insert({
      actor_id: actorId ?? null,
      action: "seed_required_checklist",
      entity: "shift",
      entity_id: shiftId,
      payload: { phase, trigger, seeded: rows.length, trailer_id: trailerId },
    });
  }
  return rows.length;
}

export const openShift = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    phase: z.enum(["opening", "mid", "closing", "emergency"]).default("opening"),
    trailerId: z.string().uuid().optional(),
  }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: store } = await supabase.from("stores").select("id").order("created_at").limit(1).maybeSingle();
    if (!store) throw new Error("No store configured");
    const trailerId = await resolveTrailer(supabase, userId, data.trailerId);
    if (!trailerId) throw new Error("No trailer assigned");

    const { data: existing } = await supabase
      .from("shifts").select("*")
      .eq("trailer_id", trailerId).eq("status", "active").maybeSingle();

    let shift = existing;
    if (!shift) {
      const { data: created, error } = await supabase
        .from("shifts").insert({ store_id: store.id, trailer_id: trailerId, phase: data.phase, opened_by: userId, status: "active" })
        .select().single();
      if (error) throw error;
      shift = created;
    }

    // Opening + Closing checklists are mandatory every shift; seed the current phase too.
    const required: Array<"opening" | "mid" | "closing" | "emergency"> = ["opening", "closing"];
    if (!required.includes(data.phase)) required.push(data.phase);
    let totalSeeded = 0;
    for (const ph of required) {
      totalSeeded += await seedPhaseIfMissing(supabase, shift.id, trailerId, ph, userId, existing ? "reopen_shift" : "open_shift");
    }

    await supabase.from("audit_log").insert({
      actor_id: userId,
      action: existing ? "reopen_shift" : "open_shift",
      entity: "shift",
      entity_id: shift.id,
      payload: { phase: data.phase, trailer_id: trailerId, seeded: totalSeeded, reused: !!existing },
    });
    return shift;
  });

export const reopenShift = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ shiftId: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: shift, error } = await supabase
      .from("shifts")
      .update({ status: "active", closed_at: null, closed_by: null })
      .eq("id", data.shiftId)
      .select()
      .single();
    if (error) throw error;
    let totalSeeded = 0;
    for (const ph of ["opening", "closing"] as const) {
      totalSeeded += await seedPhaseIfMissing(supabase, shift.id, shift.trailer_id ?? null, ph, userId, "reopen_shift");
    }
    await supabase.from("audit_log").insert({
      actor_id: userId,
      action: "reopen_shift",
      entity: "shift",
      entity_id: shift.id,
      payload: { seeded: totalSeeded },
    });
    return shift;
  });

export const closeShift = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ shiftId: z.string().uuid(), notes: z.string().optional() }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: shift, error } = await supabase
      .from("shifts").update({ status: "closed", closed_by: userId, closed_at: new Date().toISOString(), notes: data.notes })
      .eq("id", data.shiftId).select().single();
    if (error) throw error;
    await supabase.from("audit_log").insert({ actor_id: userId, action: "close_shift", entity: "shift", entity_id: shift.id });
    return shift;
  });

export const ensureShiftPhase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ shiftId: z.string().uuid(), phase: z.enum(["opening", "mid", "closing", "emergency"]) }).parse(d))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { count } = await supabase.from("tasks").select("id", { count: "exact", head: true })
      .eq("shift_id", data.shiftId).eq("phase", data.phase);
    if ((count ?? 0) > 0) return { seeded: 0 };
    const { data: shift } = await supabase.from("shifts").select("trailer_id").eq("id", data.shiftId).maybeSingle();
    const rows = TEMPLATES[data.phase].map((t) => ({
      shift_id: data.shiftId, phase: data.phase, title: t.title, description: t.section,
      assignee_role: t.assignee_role, requires_signoff: t.requires_signoff, status: "todo" as const,
      trailer_id: shift?.trailer_id ?? null,
    }));
    await supabase.from("tasks").insert(rows);
    await supabase.from("shifts").update({ phase: data.phase }).eq("id", data.shiftId);
    await supabase.from("audit_log").insert({ actor_id: userId, action: "seed_phase", entity: "shift", entity_id: data.shiftId, payload: { phase: data.phase } });
    return { seeded: rows.length };
  });
