import { handleOnboardingPost } from "@/lib/onboarding/handle-onboarding-post";

export const maxDuration = 60;

export async function POST(request: Request) {
  return handleOnboardingPost(request);
}
