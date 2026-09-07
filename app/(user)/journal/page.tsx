import { NotebookPen } from "lucide-react";

import { requireUser } from "@/app/lib/dal";
import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata = { title: "알림장 | FitNote" };

export default async function JournalPage() {
  await requireUser();

  return (
    <ComingSoon
      icon={NotebookPen}
      title="PT 알림장"
      description={"트레이너가 남긴 피드백과 숙제를\n확인할 수 있게 준비하고 있어요."}
    />
  );
}
