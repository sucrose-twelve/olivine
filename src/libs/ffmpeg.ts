import { execSync } from "node:child_process"
import { setTimeout } from "timers/promises"

// ffmpeg -i "input.m3u8" -c copy -bsf:a aac_adtstoasc -y "output.mp4"
// ffmpeg
//   -i "video.m3u8"
//   -i "audio.m3u8"
//   -map 0:v:0
//   -map 1:a:0
//   -map 0:a:0
//   -metadata:s:a:0 language=tha
//   -metadata:s:a:0 title="Thai"
//   -metadata:s:a:1 language=eng
//   -metadata:s:a:1 title="English"
//   -c copy
//   -bsf:a aac_adtstoasc
//   "output.mp4"

export async function convertToMP4(masterFile: string, savedPath: string) {
  const command: string = [
    "ffmpeg",
    "-allowed_extensions m3u8,bin,ts",
    `-i "${masterFile}"`,
    "-c copy",
    "-bsf:a aac_adtstoasc", // fix AAC stream for MP4
    "-y", // overwrite output if exists
    `"${savedPath}"`
  ].join(" ")

  return new Promise(async (resolve, reject) => {
    try {
      execSync(command, { stdio: "ignore" })
      await setTimeout(1_000)
      resolve(true)
    } catch (error) {
      reject(error)
    }
  })
}
