import type { Movie } from "../src/types"

/**
 * @link https://zmdb.net/api/video/{id}
 */
const main = async (lists: string[]) => {
  const MAX_RETRIES = 100
  const DELAY = 1_000

  const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
  const rng = <T = any>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)]

  const worker = async (segment: Movie.Segment) => {
    let retries = 0
    let url = rng(segment.urls)

    while (true) {
      try {
        const response = await fetch(url, {
          method: "GET",
          mode: "cors",
          credentials: "omit"
        })

        if (response.ok) {
          const raw = await response.arrayBuffer()
          const blob = new Blob([raw], { type: segment.mimeType })
          const formData = new FormData()
          formData.append("file", blob, segment.fileName)
          formData.append("fileName", segment.fileName)
          formData.append("mimeType", segment.mimeType)
          formData.append("savedPath", segment.savedPath)

          const res = await fetch("http://localhost:3000/segment", {
            method: "POST",
            body: formData
          })

          const result = await res.json()
          return result.ok
        }

        return false
      } catch (error) {
        url = rng(segment.urls)
        retries++
        console.warn(`🚫 An error occurred (attempt ${retries}/${MAX_RETRIES}): ${error}`)

        if (retries >= MAX_RETRIES) {
          console.warn("🚫 Max retries reached, stopping loop.")
          break
        }

        // Exponential backoff: 1s → 2s → 4s
        await delay(DELAY * 2 ** (retries - 1))
      }
    }

    return retries !== MAX_RETRIES
  }

  const start = async (name: string) => {
    const response = await fetch(`http://localhost:3000/movie/tracks?name=${name}`, { method: "GET" })
    if (response.ok) {
      const metadata: Movie.Metadata = await response.json()

      console.log(`🚀 "${metadata.name}" is currently being process...`)
      for await (const segments of metadata.segments) {
        const results = await Promise.allSettled(segments.map(worker))
        if (results.some((r) => r.status === "fulfilled" && r.value === false)) {
          console.warn("⛔ Worker failed!")
          break
        } else {
          await delay(320)
        }
      }
      console.log(`🎉 "${metadata.name}" have been successfully processed.`)
    } else {
      console.warn("⛔ Server offline!")
      return null
    }
  }

  for await (const name of lists) {
    await start(name)
    await delay(6_400)
  }
}
