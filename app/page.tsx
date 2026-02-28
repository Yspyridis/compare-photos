import prisma from "@/lib/prisma";
import HomeClient from "@/components/HomeClient";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const rawSessions = await prisma.session.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { scenes: true } },
    },
  });

  const sessions = rawSessions.map((s) => ({
    id: s.id,
    title: s.title,
    createdAt: s.createdAt.toISOString(),
    sceneCount: s._count.scenes,
    phoneNames: (s.phoneNames as Record<string, string>) || {},
    phones: s.phones,
  }));

  return <HomeClient sessions={sessions} />;
}
