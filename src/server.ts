import { exists, mkdir, readdir, readFile, rm, writeFile } from "fs/promises"
import path from "path"
import { setTimeout } from "timers/promises"

import { chunk } from "es-toolkit/array"

import { ENV } from "./constants/env"
import {
  formatZodError,
  queryValidator,
  segmentValidator,
  trackValidator,
  type TrackValidator
} from "./constants/validator.zod"
import { corsHeaders, withCors } from "./cors"
import { convertToMP4 } from "./libs/ffmpeg"
import { COLOR, logger } from "./libs/logger"
import type { Movie, VAR } from "./types"

function preflight(req: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(req) })
}

function json(req: Request, data: unknown, init: number | ResponseInit = 200) {
  const status = typeof init === "number" ? init : (init.status ?? 200)
  const res = new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  })
  return withCors(req, res)
}

const server = Bun.serve({
  hostname: ENV.HOSTNAME,
  port: ENV.PORT,
  routes: {
    "/movie/tracks": {
      OPTIONS: (req) => preflight(req),

      GET: async (req) => {
        const url = new URL(req.url)
        let name = url.searchParams.get("name")
        if (!name) {
          return json(req, { error: `field 'name' is required (string)` }, 422)
        }

        const sourceDir = path.join("D:", "Downloads", "Scripts", "Movies", name)
        const tracks: any[] = []
        let hosts: string[] = []
        let paths: Record<string, any> = {}

        const metadataFile = path.join(sourceDir, "metadata.json")
        const metadataExists = await exists(metadataFile)
        if (metadataExists) {
          const fileContent = await readFile(metadataFile, "utf-8")
          const parsed = JSON.parse(fileContent)
          name = parsed.name
          hosts = parsed.hosts
          paths = parsed.paths
        } else {
          return json(req, { error: "Metadata file not found." }, 404)
        }

        const segmentDir = path.join(sourceDir, "__segments")
        await mkdir(segmentDir, { recursive: true })

        const dirents = await readdir(sourceDir, {
          recursive: true,
          withFileTypes: true
        })

        let isCase: "1-DUB" | "2-DUB" =
          dirents.filter((d) => d.name.includes("audio_en") || d.name.includes("audio_th")).length === 2
            ? "2-DUB"
            : "1-DUB"

        const segments = new Map<string, Movie.Segment[]>()

        const fns = (dir: string, pathname: string, str: string, index: number) => {
          if (str.startsWith("#EXT-X-MAP")) {
            const uri = str.split(":")[1]

            const urls = hosts.map((host) => host + pathname + uri.replace(/URI=|"/g, ""))
            const savedPath = path.join(segmentDir, dir, "hdr.bin")
            const segment: Movie.Segment = {
              urls,
              fileName: "hdr.bin",
              mimeType: "video/mp4",
              savedPath
            }

            return [str.replace(uri, `URI="${savedPath.replaceAll("\\", "/")}"`), segment] as const
          }

          if (str.endsWith(".bin")) {
            const urls = hosts.map((host) => host + pathname + str.trim())
            const segmentName = `${index.toString().padStart(6, "0")}.ts`
            const savedPath = path.join(segmentDir, dir, segmentName)
            const segment: Movie.Segment = {
              urls,
              fileName: segmentName,
              mimeType: "video/mp4",
              savedPath
            }

            return [savedPath, segment] as const
          }

          return [str, null] as const
        }

        const videoFile = path.join(sourceDir, "video.m3u8")
        const videoFileContent = await readFile(videoFile, "utf-8")
        const videoFileContentModified = videoFileContent.split(/\r?\n/).map((line, index) => {
          if (line) {
            const [savedPath, segment] = fns("_v", paths.video, line, index)
            if (segment) {
              segments.set(index.toString(), [segment])
            }

            return savedPath
          }

          return line
        })

        const masterVideoFile = path.join(segmentDir, "__master_v.m3u8")
        await writeFile(masterVideoFile, videoFileContentModified.join("\n"), {
          encoding: "utf-8"
        })

        if (isCase === "1-DUB") {
          const audioFile = path.join(sourceDir, "audio.m3u8")
          const audioFileContent = await readFile(audioFile, "utf-8")
          const audioFileContentModified = audioFileContent.split(/\r?\n/).map((line, index) => {
            if (line) {
              const [savedPath, segment] = fns("_a", paths.audio, line, index)
              if (segment) {
                const value = segments.get(index.toString())
                if (value) {
                  segments.set(index.toString(), [...value, segment])
                }
              }

              return savedPath
            }

            return line
          })

          const masterAudioFile = path.join(segmentDir, "__master_a.m3u8")
          await writeFile(masterAudioFile, audioFileContentModified.join("\n"), {
            encoding: "utf-8"
          })
        } else if (isCase === "2-DUB") {
          const audioFile_TH = path.join(sourceDir, "audio_th.m3u8")
          const audioFile_EN = path.join(sourceDir, "audio_en.m3u8")
          const [audioFileContent_TH, audioFileContent_EN] = await Promise.all([
            readFile(audioFile_TH, "utf-8"),
            readFile(audioFile_EN, "utf-8")
          ])

          const audioFileContentModified_TH = audioFileContent_TH.split(/\r?\n/).map((line, index) => {
            if (line) {
              const [savedPath, segment] = fns("_a_th", paths.audio_th, line, index)
              if (segment) {
                const value = segments.get(index.toString())
                if (value) {
                  segments.set(index.toString(), [...value, segment])
                }
              }

              return savedPath
            }

            return line
          })

          const audioFileContentModified_EN = audioFileContent_EN.split(/\r?\n/).map((line, index) => {
            if (line) {
              const [savedPath, segment] = fns("_a_en", paths.audio_en, line, index)
              if (segment) {
                const value = segments.get(index.toString())
                if (value) {
                  segments.set(index.toString(), [...value, segment])
                }
              }

              return savedPath
            }

            return line
          })

          const masterAudioFile_TH = path.join(segmentDir, "__master_a_th.m3u8")
          const masterAudioFile_EN = path.join(segmentDir, "__master_a_en.m3u8")
          await Promise.all([
            writeFile(masterAudioFile_TH, audioFileContentModified_TH.join("\n"), {
              encoding: "utf-8"
            }),
            writeFile(masterAudioFile_EN, audioFileContentModified_EN.join("\n"), {
              encoding: "utf-8"
            })
          ])
        }

        return json(req, {
          name,
          hosts,
          paths,
          segments: Array.from(segments.values())
        } as Movie.Metadata)
      }
    },

    "/tracks": {
      OPTIONS: (req) => preflight(req),

      GET: async (req) => {
        const url = new URL(req.url)
        const searchParams = Object.fromEntries(url.searchParams.entries())

        const parsed = queryValidator.safeParse(searchParams)
        if (!parsed.success) {
          return json(req, { error: "Validation failed", issues: formatZodError(parsed.error) }, 422)
        }

        const { source } = parsed.data
        const sourceDir = path.join("D:", "Downloads", "Scripts", source)
        let destDir = path.join("F:", "Anime")
        if (source === "Ecchi") {
          destDir = "G:"
        }

        const tracks: VAR.Track[] = []
        const dirents = await readdir(sourceDir, {
          recursive: true,
          withFileTypes: true
        })

        for await (const dirent of dirents) {
          if (dirent.isDirectory()) continue
          if (dirent.isFile() && (dirent.name.startsWith("__master") || !dirent.name.endsWith(".m3u8"))) continue

          const separator = dirent.parentPath
            .split(/Anime|Ruka|Waku|Ecchi|\\/g)
            .filter(Boolean)
            .slice(3)
            .map((r) => r.trim())

          const fileName = dirent.name.replace(".m3u8", "")
          const name = source === "Ecchi" ? fileName : [...separator, fileName].join(" | ")
          const track: VAR.Track = {
            name,
            destDir: path.join(destDir, ...separator),
            destFile: path.join(destDir, ...separator, dirent.name.replace(".m3u8", ".mp4")),
            sourceDir: dirent.parentPath,
            sourceFile: path.join(dirent.parentPath, dirent.name),
            segmentDir: path.join(dirent.parentPath, `__${fileName}_SEGMENTS`),
            masterFile: path.join(dirent.parentPath, `__${fileName}_SEGMENTS`, "__master.m3u8")
          }

          const fileContent = await readFile(track.sourceFile, "utf-8")
          if (fileContent.trim().length < 10) continue

          tracks.push(track)
        }

        return json(req, tracks)
      }
    },

    "/segment": {
      OPTIONS: (req) => preflight(req),

      POST: async (req) => {
        let formData: FormData

        try {
          formData = await req.formData()
        } catch (err) {
          console.error(err)
          return json(req, { error: "Invalid form-data request" }, 400)
        }

        const parsed = segmentValidator.safeParse({
          file: formData.get("file") ?? undefined,
          fileName: formData.get("fileName") ?? undefined,
          mimeType: formData.get("mimeType") ?? undefined,
          savedPath: formData.get("savedPath") ?? undefined
        })

        if (!parsed.success) {
          return json(req, { error: "Validation failed", issues: formatZodError(parsed.error) }, 422)
        }

        const { file, fileName, mimeType, savedPath } = parsed.data

        const newFile = new File([file], fileName, { type: mimeType })
        await Bun.write(path.resolve(savedPath), newFile)
        await setTimeout(200)

        return json(req, { ok: true }, 201)
      },

      PATCH: async (req) => {
        let body: TrackValidator

        try {
          body = await req.json()
        } catch (err) {
          console.error(err)
          return json(req, { error: "invalid JSON body" }, 400)
        }

        const parsed = trackValidator.safeParse(body)
        if (!parsed.success) {
          return json(req, { error: "validation failed", issues: formatZodError(parsed.error) }, 422)
        }

        const { name, destDir, sourceFile, segmentDir, masterFile } = parsed.data
        const segments: VAR.Segment[] = []

        let currentByteLength: number | null = null
        let currentOffset: number | null = null
        let previousEndByte: number = 0
        let range: VAR.Segment["range"] = undefined

        const fileContent = await readFile(sourceFile, "utf-8")
        const fileContentModified = fileContent.split(/\r?\n/).map((line, index) => {
          if (line) {
            if (line.startsWith("#EXT-X-KEY")) {
              const uri = line.split(",")[1]

              const segmentUrl = "https://app.akuma-stream.com" + uri.replace(/URI=|"/g, "")
              const savedPath = path.join(segmentDir, "key.bin")
              segments.push({
                url: segmentUrl,
                fileName: "key.bin",
                mimeType: "application/octet-stream",
                savedPath
              })

              return line.replace(uri, `URI="${savedPath.replaceAll("\\", "/")}"`)
            }

            if (line.startsWith("#EXT-X-BYTERANGE")) {
              const value = line.replace("#EXT-X-BYTERANGE:", "").trim()
              const [start, end] = value.split("@")

              currentByteLength = parseInt(start, 10)
              if (end) {
                currentOffset = parseInt(end, 10)
              } else {
                currentOffset = previousEndByte
              }
            }

            if (!line.startsWith("#")) {
              let segmentUrl = line.trim()

              if (segmentUrl.startsWith("blob")) {
                segmentUrl = ENV.URL.RUKA + line
              } else if (segmentUrl.startsWith("/o")) {
                segmentUrl = ENV.URL.WAKU + line
              } else if (segmentUrl.startsWith("//")) {
                segmentUrl = `https:${line.replace(/^http[s]?:/g, "")}`
              }

              if (currentByteLength !== null && currentOffset !== null) {
                const startByte = currentOffset
                const endByte = startByte + currentByteLength - 1

                range = `bytes=${startByte}-${endByte}`

                previousEndByte = endByte + 1
                currentByteLength = 0
                currentOffset = 0
              }

              const segmentName = `${index.toString().padStart(6, "0")}.ts`
              const savedPath = path.join(segmentDir, segmentName)
              segments.push({
                url: segmentUrl,
                fileName: segmentName,
                mimeType: "video/mp2t",
                savedPath,
                range
              })

              return savedPath
            }
          }

          return line
        })

        await mkdir(destDir, { recursive: true })
        await mkdir(segmentDir, { recursive: true })
        await writeFile(masterFile, fileContentModified.filter((r) => !r.includes("EXT-X-BYTERANGE")).join("\n"), {
          encoding: "utf-8"
        })

        if (sourceFile.includes("Scripts\\Anime")) {
          return json(req, chunk(segments, 8), 200)
        } else {
          return json(req, chunk(segments, 2), 200)
        }
      }
    },

    "/convert": {
      OPTIONS: (req) => preflight(req),

      POST: async (req) => {
        let body: TrackValidator

        try {
          body = await req.json()
        } catch (err) {
          console.error(err)
          return json(req, { error: "invalid JSON body" }, 400)
        }

        const parsed = trackValidator.safeParse(body)
        if (!parsed.success) {
          return json(req, { error: "validation failed", issues: formatZodError(parsed.error) }, 422)
        }

        const { name, destFile, sourceFile, segmentDir, masterFile } = parsed.data
        const hasFile = await exists(masterFile)
        if (!hasFile) {
          return json(req, { error: "Master File not fount" }, 404)
        }

        // --- Convert to MP4 using FFMPEG ---
        logger(`🎬 FFMPEG is currently processing ${COLOR.FG.Green}"${name}"...${COLOR.RESET}`)
        const ffmpegStartedAt = new Date()
        await convertToMP4(masterFile, destFile)
        logger(`🎉 FFMPEG has been successfully convered to ${COLOR.FG.Green}"${name}"${COLOR.RESET}`, ffmpegStartedAt)

        // Delete temporary segments and m3u8 file after processed.
        await Promise.all([
          rm(sourceFile, { recursive: true, force: true }),
          rm(segmentDir, { recursive: true, force: true })
        ])
        logger(`🧹 Temporary of "${name}" has been successfully removed`)

        return json(req, { ok: true }, 201)
      }
    }
  },
  fetch(req) {
    if (req.method.toUpperCase() === "OPTIONS") return preflight(req)
    return json(req, { error: "Not found" }, 404)
  },
  error(err) {
    console.error(err)
    return new Response("Internal Server Error", { status: 500, statusText: err.message })
  }
})

logger(`🚀 Server running at http://${server.hostname}:${server.port}`)
