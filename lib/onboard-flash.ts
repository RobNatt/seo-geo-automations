import "server-only";

import { cookies } from "next/headers";

const COOKIE = "onboard_flash";
/** Stay under typical 4KB cookie limits after JSON + overhead */
const MAX_MESSAGE = 3500;

export async function setOnboardFlashError(message: string): Promise<void> {
  const m = message.length > MAX_MESSAGE ? `${message.slice(0, MAX_MESSAGE - 1)}…` : message;
  const jar = await cookies();
  jar.set(COOKIE, JSON.stringify({ t: "err", m: m }), {
    path: "/",
    maxAge: 120,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  });
}

/** Returns the flash message once, then clears the cookie. */
export async function consumeOnboardFlash(): Promise<string | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (!raw) return null;
  jar.delete(COOKIE);
  try {
    const j = JSON.parse(raw) as { t?: string; m?: string };
    if (j.t === "err" && typeof j.m === "string") return j.m;
  } catch {
    return null;
  }
  return null;
}
