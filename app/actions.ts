"use server";

import prisma from "@/lib/prisma";
import { processAndUploadImage, getSignedImageUrl } from "@/lib/storage";
import { revalidatePath } from "next/cache";

// 1. Create a new test session
export async function createSession(
  title: string,
  phones: string[],
  phoneNames: Record<string, string>, // Accept the names from the UI
) {
  const session = await prisma.session.create({
    data: {
      title,
      phones,
      phoneNames, // Prisma handles this as a JSON object
    },
  });
  return session;
}

// 2. Upload photo and auto-assign to a scene
export async function uploadPhoto(
  sessionId: string,
  phoneLabel: string,
  formData: FormData,
) {
  const file = formData.get("file") as File;
  if (!file) throw new Error("No file provided");

  const buffer = Buffer.from(await file.arrayBuffer());
  const { rawKey, thumbKey } = await processAndUploadImage(buffer, file.type);

  // Simple logic: count photos for this phone to determine the scene index
  const count = await prisma.photo.count({
    where: { scene: { sessionId }, phoneLabel },
  });

  // Find or create the scene for this index
  let scene = await prisma.scene.findUnique({
    where: { sessionId_index: { sessionId, index: count } },
  });

  if (!scene) {
    scene = await prisma.scene.create({
      data: { sessionId, index: count },
    });
  }

  await prisma.photo.create({
    data: {
      sceneId: scene.id,
      phoneLabel,
      storageKey: rawKey,
      thumbKey,
    },
  });

  revalidatePath(`/session/${sessionId}/upload`);
}

// 3. Get blinded comparison data
export async function getComparison(sceneId: string) {
  const scene = await prisma.scene.findUnique({
    where: { id: sceneId },
    include: { photos: true, comparison: true },
  });

  if (!scene || scene.photos.length < 2) throw new Error("Scene not ready");

  // If comparison exists, return it immediately
  if (scene.comparison) {
    const mapping = scene.comparison.mapping as Record<string, string>;
    const images = await Promise.all(
      Object.entries(mapping).map(async ([position, photoId]) => {
        const photo = scene.photos.find((p) => p.id === photoId);
        return {
          position,
          url: await getSignedImageUrl(photo!.storageKey),
          id: photoId,
        };
      }),
    );
    return { images, comparisonId: scene.comparison.id };
  }

  // If NO comparison exists, create it now
  const photos = [...scene.photos].sort(() => Math.random() - 0.5);
  const newMapping: Record<string, string> = {};
  const positions = ["left", "right"];
  if (photos.length > 2) positions.push("center");

  positions.forEach((pos, i) => {
    if (photos[i]) newMapping[pos] = photos[i].id;
  });

  const newComp = await prisma.comparison.create({
    data: { sceneId, mapping: newMapping },
  });

  const images = await Promise.all(
    Object.entries(newMapping).map(async ([position, photoId]) => {
      const photo = scene.photos.find((p) => p.id === photoId);
      return {
        position,
        url: await getSignedImageUrl(photo!.storageKey),
        id: photoId,
      };
    }),
  );

  return { images, comparisonId: newComp.id }; // Return the NEW ID
}

// 4. Reveal the truth
export async function revealIdentity(comparisonId: string) {
  // If comparisonId is empty, it means the mapping wasn't initialized
  if (!comparisonId)
    throw new Error("Comparison not initialized. Try refreshing.");

  const comp = await prisma.comparison.findUnique({
    where: { id: comparisonId },
    include: { scene: { include: { photos: true } } },
  });

  if (!comp) throw new Error("Comparison record not found in database.");

  const mapping = comp.mapping as Record<string, string>;
  const result: Record<string, string> = {};

  Object.entries(mapping).forEach(([pos, id]) => {
    const photo = comp.scene.photos.find((p) => p.id === id);
    result[pos] = photo?.phoneLabel || "Unknown";
  });

  return result;
}
