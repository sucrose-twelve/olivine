import * as dotenv from "dotenv"
import { z } from "zod"

import { envSchema } from "./validator.zod"

dotenv.config()

export type EnvSchema = z.infer<typeof envSchema>
export const ENV = envSchema.parse({
  APP_MODE: process.env.NODE_ENV,
  APP_NAME: process.env.APP_NAME,
  HOSTNAME: process.env.HOSTNAME,
  PORT: process.env.PORT,
  TZ: process.env.TZ,
  SOURCE_DIR: process.env.SOURCE_DIR,
  URL: {
    RUKA: process.env.RUKA_URL,
    WAKU: process.env.WAKU_URL
  }
})
