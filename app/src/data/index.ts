import { LocalProvider } from "./local";
import { SupabaseProvider } from "./supabase";
import type { DataProvider } from "./provider";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// Die eingebettete Vorschau (Artifact) läuft immer im Demo-Modus, auch wenn Zugangsdaten vorliegen.
const embedded = import.meta.env.VITE_ROUTER === "hash";
export const data: DataProvider = url && key && !embedded ? new SupabaseProvider(url, key) : new LocalProvider();
