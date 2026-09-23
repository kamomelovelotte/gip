export function getRequestUserId(request: Request): string | null {
  const userId = request.headers.get("oai-authenticated-user-id");
  if (userId) return userId;

  const host = request.headers.get("host") ?? "";
  if (
    host.startsWith("terminal.local") ||
    host.startsWith("localhost") ||
    host.startsWith("127.0.0.1")
  ) {
    return "local-preview-user";
  }

  return null;
}

export function unauthorizedResponse() {
  return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
}
