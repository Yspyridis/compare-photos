import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import UploadClient from "@/components/UploadClient";

export default async function UploadPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await prisma.session.findUnique({
    where: { id: params.id },
    include: {
      scenes: {
        orderBy: { index: "asc" },
        include: { photos: true },
      },
    },
  });

  if (!session) return notFound();

  const phoneNames = (session.phoneNames as Record<string, string>) || {};

  const initialScenes = session.scenes.map((scene) => ({
    index: scene.index,
    sceneId: scene.id,
    photos: scene.photos.map((p) => ({ id: p.id, label: p.phoneLabel })),
  }));

  return (
    <main className="min-h-screen bg-gray-900 text-white py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-black tracking-tight mb-2">
            {session.title}
          </h1>
          <p className="text-green-400 text-sm">
            upload the photos for each device to begin the blind comparison
          </p>
        </div>

        <UploadClient
          sessionId={session.id}
          phoneLabels={session.phones}
          phoneNames={phoneNames}
          initialScenes={initialScenes}
        />
      </div>
    </main>
  );
}
