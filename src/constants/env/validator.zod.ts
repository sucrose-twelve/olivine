import { z } from "zod"

export const envSchema = z.object({
  APP_MODE: z.union([z.literal("production"), z.literal("development")]).default("development"),
  APP_NAME: z.string().default("project_name"),
  HOSTNAME: z.string().default("localhost"),
  PORT: z.string().transform(Number).default(3000),
  TZ: z.string().default("Asia/Singapore"),
  URL: z.object({
    RUKA: z.url(),
    WAKU: z.url()
  })
})
