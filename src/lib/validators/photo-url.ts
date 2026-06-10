import { z } from "zod";

// Only accept photo URLs that live in our own Supabase storage. This prevents
// crew from persisting arbitrary external URLs (e.g. tracking pixels) that
// would be silently fetched by other users' browsers.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const STORAGE_PREFIX = SUPABASE_URL
  ? `${SUPABASE_URL.replace(/\/+$/, "")}/storage/v1/object/`
  : null;

export const photoUrlSchema = z
  .string()
  .url()
  .refine(
    (url) => {
      if (!STORAGE_PREFIX) return false;
      return url.startsWith(STORAGE_PREFIX);
    },
    { message: "photo_url must be a Supabase storage URL" },
  )
  .optional();
