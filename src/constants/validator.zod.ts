import { z } from "zod"

const requiredPath = (name: string) =>
  z
    .string({ message: `field '${name}' is required (string)` })
    .trim()
    .min(1, `field '${name}' is required (string)`)

export const formatZodError = (error: z.ZodError) =>
  error.issues.map((issue) => ({
    path: issue.path.join(".") || "(root)",
    message: issue.message
  }))

export const queryValidator = z.object({
  source: z.union([z.literal("Anime"), z.literal("Ruka"), z.literal("Waku"), z.literal("Ecchi")])
})

export const trackValidator = z.object({
  name: requiredPath("name"),
  destDir: requiredPath("destDir"),
  destFile: requiredPath("destFile"),
  sourceDir: requiredPath("sourceDir"),
  sourceFile: requiredPath("sourceFile"),
  segmentDir: requiredPath("segmentDir"),
  masterFile: requiredPath("masterFile")
})

export const segmentValidator = z.object({
  file: z.instanceof(File, { message: "field 'file' is required (File)" }),
  fileName: requiredPath("name"),
  mimeType: z.union([z.literal("video/mp4"), z.literal("video/mp2t"), z.literal("application/octet-stream")]),
  savedPath: requiredPath("savedPath")
})

export type QueryValidator = z.infer<typeof queryValidator>
export type TrackValidator = z.infer<typeof trackValidator>
export type SegmentValidator = z.infer<typeof segmentValidator>
