export function corsHeaders(req: Request): Headers {
  const headers = new Headers()
  const origin = req.headers.get("origin")
  const requestedHeaders = req.headers.get("access-control-request-headers")

  headers.set("Access-Control-Allow-Headers", requestedHeaders ?? "Content-Type, Authorization")
  headers.set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
  headers.set("Access-Control-Allow-Credentials", "true")
  headers.set("Access-Control-Allow-Origin", origin ?? "*")
  headers.set("Access-Control-Max-Age", "86400")
  headers.set("Vary", "Origin")

  return headers
}

export function withCors(req: Request, res: Response): Response {
  const cors = corsHeaders(req)
  const headers = new Headers(res.headers)

  cors.forEach((value, key) => headers.set(key, value))

  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers
  })
}
