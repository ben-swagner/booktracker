import { LocalProvider } from "./local";
import { SupabaseProvider } from "./supabase";
import type { DataProvider } from "./provider";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const data: DataProvider = url && key ? new SupabaseProvider(url, key) : new LocalProvider();
