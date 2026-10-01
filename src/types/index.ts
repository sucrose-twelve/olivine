export namespace VAR {
  export type Track = {
    name: string
    destDir: string
    destFile: string
    sourceDir: string
    sourceFile: string
    segmentDir: string
    masterFile: string
  }

  export type Segment = {
    url: string
    fileName: string
    mimeType: "video/mp2t" | "application/octet-stream"
    savedPath: string
    range?: `bytes=${number}-${number}`
  }
}

export namespace Movie {
  export type Metadata = {
    name: string
    hosts: string[]
    paths: string[]
    segments: Movie.Segment[][]
  }

  export type Segment = {
    urls: string[]
    fileName: string
    mimeType: "video/mp4" | "video/mp2t" | "application/octet-stream"
    savedPath: string
  }
}
