import * as XLSX from "xlsx";
import { supabase } from "@/utils/supabaseClient";

// Supabase headers and numeric columns
export const supabaseHeaders = [
  "id",
  "siteid_routeid",
  "ce_length_mtr",
  "ri_cost_per_meter",
  "material_cost_per_meter",
  "build_cost_per_meter",
  "total_ri_amount",
  "material_cost",
  "execution_cost_including_hh",
  "total_cost_without_deposit",
  "route_type",
  "survey_id",
  "existing_new",
];

export const numericColumns = new Set([
  "ce_length_mtr",
  "ri_cost_per_meter",
  "material_cost_per_meter",
  "build_cost_per_meter",
  "total_ri_amount",
  "material_cost",
  "execution_cost_including_hh",
  "total_cost_without_deposit",
  "survey_id",
  "existing_new",
]);

export type BudgetData = {
  id?: number;
  siteid_routeid: string | null;
  ce_length_mtr: number | null;
  ri_cost_per_meter: number | null;
  material_cost_per_meter: number | null;
  build_cost_per_meter: number | null;
  total_ri_amount: number | null;
  material_cost: number | null;
  execution_cost_including_hh: number | null;
  total_cost_without_deposit: number | null;
  route_type: string | null;
  survey_id: string | null;
  existing_new: string | null;
};

// Parse and clean Excel file
export function parseAndCleanExcel(file: File): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
        const cleaned = json.map(cleanRow);
        resolve(cleaned);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

// Clean a row to match Supabase schema
export function cleanRow(row: any) {
  const cleaned: any = {};
  for (const key of supabaseHeaders) {
    const foundKey = Object.keys(row).find(
      k => k.replace(/\s+/g, ' ').trim().toLowerCase() === key.replace(/\s+/g, ' ').trim().toLowerCase()
    );
    let value = foundKey ? row[foundKey] : null;
    if (value === "" || value === undefined) {
      value = null;
    } else if (numericColumns.has(key)) {
      if (typeof value === "number") {
        value = Math.round(value * 100) / 100;
      } else if (!isNaN(Number(value))) {
        value = Math.round(Number(value) * 100) / 100;
      }
    }
    cleaned[key] = value;
  }
  return cleaned;
}

// Deduplicate by SiteID (keep last occurrence)
export function dedupeBySiteId(rows: any[]) {
  return Array.from(new Map(rows.map(row => [row["siteid_routeid"], row])).values());
}

// Force all empty strings in an object to null
export function forceNulls(obj: any) {
  for (const k in obj) {
    if (obj[k] === "") obj[k] = null;
  }
  // Always remove id (autoincrementing PK)
  delete obj.id;
  return obj;
}

// Upload to Supabase (upsert)
export async function uploadToSupabase(rows: any[]) {
  console.time('dedupeBySiteId');
  const deduped = dedupeBySiteId(rows).map(forceNulls);
  console.timeEnd('dedupeBySiteId');
  const siteIds = deduped.map(row => row["siteid_routeid"]);
  // Delete all rows not in the uploaded SiteIDs
  if (siteIds.length > 0) {
    console.time('supabaseDelete');
    await supabase
      .from("budget_master")
      .delete()
      .not("siteid_routeid", "in", `(${siteIds.map(id => `'${id}'`).join(",")})`);
    console.timeEnd('supabaseDelete');
  }
  // Upsert the new/updated rows
  console.time('supabaseUpsert');
  const result = await supabase
    .from("budget_master")
    .upsert(deduped, { onConflict: "siteid_routeid" });
  console.timeEnd('supabaseUpsert');
  return result;
}

// Query by SiteID
export async function queryBySiteId(siteId: string, columns: string[]) {
  return await supabase
    .from("budget_master")
    .select(columns.join(","))
    .eq("siteid_routeid", siteId)
    .maybeSingle();
} 