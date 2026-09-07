export const CORRELATION_HEADER = "X-Correlation-ID";

export function createCorrelationId() {
  const randomPart = () => Math.random().toString(36).slice(2, 12);
  return `${Date.now().toString(36)}-${randomPart()}-${randomPart()}`;
}

export function getRequestCorrelationId(value: string | null) {
  return value && /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value)
    ? value
    : createCorrelationId();
}

export function getResponseCorrelationId(response: Response, fallback: string) {
  return response.headers.get(CORRELATION_HEADER) ?? fallback;
}
