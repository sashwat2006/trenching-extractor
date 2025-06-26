import * as XLSX from "xlsx";
import { supabase } from "@/utils/supabaseClient";

// Supabase headers and numeric columns
export const supabaseHeaders = [
  "SiteID",
  "CE-Length-Mtr",
  "RI Cost per Meter",
  "Material  Cost Per Meter",
  "Build Cost Per Meter",
  "Total RI Amount",
  "Material Cost",
  "Execution Cost  including HH",
  "Total Cost (Without Deposit)",
  "Route Type"
];

export const numericColumns = new Set([
  "CE-Length-Mtr",
  "RI Cost per Meter",
  "Material  Cost Per Meter",
  "Build Cost Per Meter",
  "Total RI Amount",
  "Material Cost",
  "Execution Cost  including HH",
  "Total Cost (Without Deposit)"
]);

export type BudgetData = {
  SiteID: string;
  "CE-Length-Mtr": number | null;
  "RI Cost per Meter": number | null;
  "Material  Cost Per Meter": number | null;
  "Build Cost Per Meter": number | null;
  "Total RI Amount": number | null;
  "Material Cost": number | null;
  "Execution Cost  including HH": number | null;
  "Total Cost (Without Deposit)": number | null;
  "Route Type": string | null;
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
      k => k.replace(/\s+/g, ' ').trim() === key.replace(/\s+/g, ' ').trim()
    );
    let value = foundKey ? row[foundKey] : null;
    if (numericColumns.has(key)) {
      if (value === "" || value === undefined) {
        value = null;
      } else if (typeof value === "number") {
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
  return Array.from(new Map(rows.map(row => [row["SiteID"], row])).values());
}

// Upload to Supabase (upsert)
export async function uploadToSupabase(rows: any[]) {
  const deduped = dedupeBySiteId(rows);
  const siteIds = deduped.map(row => row["SiteID"]);
  // Delete all rows not in the uploaded SiteIDs
  if (siteIds.length > 0) {
    await supabase
      .from("budget_lmc")
      .delete()
      .not("SiteID", "in", `(${siteIds.map(id => `'${id}'`).join(",")})`);
  }
  // Upsert the new/updated rows
  return await supabase
    .from("budget_lmc")
    .upsert(deduped, { onConflict: "SiteID" });
}

// Query by SiteID
export async function queryBySiteId(siteId: string, columns: string[]) {
  return await supabase
    .from("budget_lmc")
    .select(columns.map(col => `"${col}"`).join(", "))
    .eq("SiteID", siteId)
    .maybeSingle();
} 