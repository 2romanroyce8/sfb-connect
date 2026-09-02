import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Default config works for this app: standard SSR pages, Node-compatible API
// routes (Supabase service-role client, etc.), and cookie-based middleware.
// See https://opennext.js.org/cloudflare for incremental cache / KV options
// if you later want ISR — not needed for this app's fully dynamic routes.
export default defineCloudflareConfig();
