"use server";

import { cookies } from "next/headers";
import { ONBOARD_FLASH_COOKIE } from "@/lib/onboard-flash";

/** Cookie deletes must run in a Server Action, not during RSC render. */
export async function clearOnboardFlashCookie() {
  const jar = await cookies();
  jar.set(ONBOARD_FLASH_COOKIE, "", {
    path: "/",
    maxAge: 0,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
  });
}
