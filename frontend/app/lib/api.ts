const envUrl = process.env.NEXT_PUBLIC_API_URL;

const normalized = envUrl && envUrl.trim().length > 0 ? envUrl : "http://localhost:8000/api";

export const API_BASE = normalized.replace(/\/$/, "");

export const apiUrl = (path: string): string => {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE}${suffix}`;
};
