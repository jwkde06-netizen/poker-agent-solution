import { createClient } from "@supabase/supabase-js";

const DEFAULT_SUPABASE_URL = "https://sncvmxhhsocuamjjwgvz.supabase.co";

const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseUrl =
  configuredUrl && configuredUrl.includes("sncvmxhhsocuamjjwgvz")
    ? configuredUrl
    : DEFAULT_SUPABASE_URL;

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;

export function createProvisioningClient() {
  if (!isSupabaseConfigured || !supabaseAnonKey) return null;
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
