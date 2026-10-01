import { exec } from "node:child_process"
import path from "node:path"

import { ENV } from "../src/constants/env"
import { logger } from "../src/libs/logger"

/**
 * @notes ffmpeg
 * -allowed_extensions ALL -i "__master_v.m3u8"
 * -allowed_extensions ALL -i "__master_a_th.m3u8"
 * -allowed_extensions ALL -i "__master_a_en.m3u8"
 * -map 0:v
 * -map 1:a
 * -map 2:a
 * -c copy
 * -metadata:s:a:0 language=tha -metadata:s:a:0 title="Thai"
 * -metadata:s:a:1 language=eng -metadata:s:a:1 title="English"
 * -disposition:a:0 default
 * -disposition:a:1 0
 * -bsf:a aac_adtstoasc
 * -y "__output_name.mp4"
 */
async function main() {
  const startedAt = new Date()

  const name = ""
  const sourceDir = path.join(ENV.SOURCE_DIR, "Movies", name)
  const segmentDir = path.join(sourceDir, "__segments")

  const _v = path.join(segmentDir, "__master_v.m3u8")
  const _a = path.join(segmentDir, "__master_a.m3u8")
  const _a_th = path.join(segmentDir, "__master_a_th.m3u8")
  const _a_en = path.join(segmentDir, "__master_a_en.m3u8")
  const _o = path.join(sourceDir, `${name}.mp4`)

  const command: string = [
    "ffmpeg",
    "-allowed_extensions m3u8,bin,ts",
    `-i "${_v}"`,
    // "-allowed_extensions m3u8,bin,ts",
    // `-i "${_a}"`,
    "-allowed_extensions m3u8,bin,ts",
    `-i "${_a_th}"`,
    "-allowed_extensions m3u8,bin,ts",
    `-i "${_a_en}"`,
    "-map 0:v",
    "-map 1:a",
    "-map 2:a",
    "-c copy",
    "-metadata:s:a:0 language=tha",
    `-metadata:s:a:0 title="Thai"`,
    "-metadata:s:a:1 language=eng",
    `-metadata:s:a:1 title="English"`,
    "-disposition:a:0 default",
    "-disposition:a:1 0",
    "-bsf:a aac_adtstoasc", // fix AAC stream for MP4
    `-y "${_o}"` // overwrite output if exists
  ].join(" ")

  exec(command, (error, stdout, stderr) => {
    if (error) {
      logger(`⛔ exec error: ${error}`, startedAt)
      return
    }

    logger(`📄 stdout: ${stdout}`)
    logger(`⛔ stderr: ${stderr}`)
  })
}

main()
