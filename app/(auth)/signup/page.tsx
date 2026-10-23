import { previewMemberClaimCode } from "@/server/trainers/connection-claim.service";

import { ClaimForm } from "./claim-form";
import { SignupForm } from "./signup-form";

export default async function SignupPage({
  searchParams,
}: PageProps<"/signup">) {
  const { code } = await searchParams;
  const claimCode = typeof code === "string" ? code : "";

  // 트레이너가 보낸 이어받기 링크(?code=)면 그 계정을 이어받는 화면을 보여 준다.
  const claim = claimCode ? await previewMemberClaimCode(claimCode) : null;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-6">
      {claim ? (
        <ClaimForm
          code={claimCode}
          memberName={claim.memberName}
          trainerName={claim.trainerName}
        />
      ) : (
        <SignupForm />
      )}
    </main>
  );
}
