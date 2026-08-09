const firstHeaderValue = (value: string | null) => value?.split(",")[0]?.trim() || "";

export function isSameOriginRequest(request: Request) {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") return false;

  const origin = request.headers.get("origin");
  if (!origin) return process.env.NODE_ENV !== "production";

  try {
    const requestUrl = new URL(request.url);
    const host = firstHeaderValue(request.headers.get("x-forwarded-host")) ||
      firstHeaderValue(request.headers.get("host")) || requestUrl.host;
    const protocol = firstHeaderValue(request.headers.get("x-forwarded-proto")) ||
      requestUrl.protocol.replace(":", "");
    return new URL(origin).origin === `${protocol}://${host}`;
  } catch {
    return false;
  }
}

export function requestBodyExceeds(request: Request, maximumBytes: number) {
  const rawLength = request.headers.get("content-length");
  if (!rawLength) return false;
  const contentLength = Number(rawLength);
  return !Number.isFinite(contentLength) || contentLength < 0 || contentLength > maximumBytes;
}
