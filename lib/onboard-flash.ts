import "server-only";

import { cookies } from "next/headers";

export const ONBOARD_FLASH_COOKIE = "onboard_flash";
/** Stay under typical 4KB cookie limits after JSON + overhead */
const MAX_MESSAGE = 3500;

/** Called from a Server Action only — cookie writes are not allowed in RSC render. */
export async function setOnboardFlashError(message: string): Promise<void> {
  const m = message.length > MAX_MESSAGE ? `${message.slice(0, MAX_MESSAGE - 1)}…` : message;
  const jar = await cookies();
  jar.set(ONBOARD_FLASH_COOKIE, JSON.stringify({ t: "err", m: m }), {
    path: "/",
    maxAge: 120,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  });
}

/**
 * Read flash message from cookie (RSC-safe — does not modify cookies).
 * Clear after display via `clearOnboardFlashCookie` Server Action from the client.
 */
export async function getOnboardFlashMessage(): Promise<string | null> {
  const jar = await cookies();
  const raw = jar.get(ONBOARD_FLASH_COOKIE)?.value;
  if (!raw) return null;
  try {
    const j = JSON.parse(raw) as { t?: string; m?: string };
    if (j.t === "err" && typeof j.m === "string") return j.m;
  } catch {
    return null;
  }
  return null;
}
