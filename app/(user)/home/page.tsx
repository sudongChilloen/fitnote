import { logout } from "@/app/actions/auth";
import { requireUser } from "@/app/lib/dal";
import { prisma } from "@/lib/prisma";

export default async function HomePage() {
  const user = await requireUser();
  const exerciseCount = await prisma.exercise.count({
    where: { isActive: true },
  });

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 px-6 py-10">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">안녕하세요</p>
          <h1 className="text-xl font-bold">{user.name}님</h1>
        </div>

        <form action={logout}>
          <button
            type="submit"
            className="rounded-md border px-3 py-1.5 text-sm"
          >
            로그아웃
          </button>
        </form>
      </header>

      <section className="rounded-lg border p-4">
        <p className="text-sm text-gray-500">등록된 운동</p>
        <p className="text-2xl font-bold">{exerciseCount}개</p>
      </section>
    </main>
  );
}
