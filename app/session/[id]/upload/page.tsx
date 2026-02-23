import prisma from "@/lib/prisma";
import { notFound } from "next/navigation";
import UploadClient from "@/components/UploadClient";

export default async function UploadPage({
  params,
}: {
  params: { id: string };
}) {
  // Fetch session and existing photos to show progress
  const session = await prisma.session.findUnique({
    where: { id: params.id },
    include: {
      scenes: {
        include: { photos: true },
      },
    },
  });

  if (!session) return notFound();

  // Cast the JSON phoneNames from DB to a usable object
  const phoneNames = (session.phoneNames as Record<string, string>) || {};

  return (
    <main className="min-h-screen bg-[#f8f9fa] py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-black text-gray-900 tracking-tight mb-2">
            {session.title}
          </h1>
          <p className="text-gray-500">
            Upload the high-res photos for each device to begin the blind test.
          </p>
        </div>

        <UploadClient
          sessionId={session.id}
          phoneLabels={session.phones}
          phoneNames={phoneNames}
          initialPhotos={session.scenes[0]?.photos || []}
        />
      </div>
    </main>
  );
}
