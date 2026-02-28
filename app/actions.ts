"use server";

import prisma from "@/lib/prisma";
import {
  processAndUploadImage,
  getSignedImageUrl,
  deleteS3Objects,
} from "@/lib/storage";
import { revalidatePath } from "next/cache";

export interface ReviewPhoto {
  id: string;
  phoneLabel: string;
  url: string;
}

export interface ReviewScene {
  id: string;
  index: number;
  photos: ReviewPhoto[];
}

export interface ReviewSession {
  id: string;
  title: string;
  phoneNames: Record<string, string>;
  phones: string[];
  scenes: ReviewScene[];
}

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

// 2. Upload photo to an explicit scene index
export async function uploadPhoto(
  sessionId: string,
  phoneLabel: string,
  sceneIndex: number,
  formData: FormData,
) {
  const file = formData.get("file") as File;
  if (!file) throw new Error("No file provided");

  const buffer = Buffer.from(await file.arrayBuffer());
  const { rawKey, thumbKey } = await processAndUploadImage(buffer, file.type);

  // Find or create the scene for this explicit index
  let scene = await prisma.scene.findUnique({
    where: { sessionId_index: { sessionId, index: sceneIndex } },
  });

  if (!scene) {
    scene = await prisma.scene.create({
      data: { sessionId, index: sceneIndex },
    });
  }

  const photo = await prisma.photo.create({
    data: {
      sceneId: scene.id,
      phoneLabel,
      storageKey: rawKey,
      thumbKey,
    },
  });

  revalidatePath(`/session/${sessionId}/upload`);
  return { photoId: photo.id, sceneId: scene.id };
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

  // If NO comparison exists, create it now — Fisher-Yates for a provably uniform shuffle
  const photos = [...scene.photos];
  for (let i = photos.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [photos[i], photos[j]] = [photos[j], photos[i]];
  }
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

// 5. Get full session data for the review/study tab (labels always revealed)
export async function getSessionForReview(
  sessionId: string,
): Promise<ReviewSession> {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      scenes: {
        orderBy: { index: "asc" },
        include: { photos: true },
      },
    },
  });

  if (!session) throw new Error("Session not found");

  const scenesWithUrls: ReviewScene[] = await Promise.all(
    session.scenes.map(async (scene) => ({
      id: scene.id,
      index: scene.index,
      photos: await Promise.all(
        scene.photos
          .sort((a, b) => a.phoneLabel.localeCompare(b.phoneLabel))
          .map(async (photo) => ({
            id: photo.id,
            phoneLabel: photo.phoneLabel,
            url: await getSignedImageUrl(photo.storageKey),
          })),
      ),
    })),
  );

  return {
    id: session.id,
    title: session.title,
    phoneNames: (session.phoneNames as Record<string, string>) || {},
    phones: session.phones,
    scenes: scenesWithUrls,
  };
}

// 6. Reveal the truth
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

// 7. Delete a single photo (re-upload / redo flow)
export async function deletePhoto(photoId: string, sessionId: string) {
  const photo = await prisma.photo.findUnique({
    where: { id: photoId },
    include: {
      scene: {
        include: { comparison: { include: { votes: true } } },
      },
    },
  });
  if (!photo) return;

  // Wipe S3 objects
  await deleteS3Objects([photo.storageKey, photo.thumbKey]);

  // Invalidate comparison for this scene (mapping is now stale)
  if (photo.scene.comparison) {
    await prisma.vote.deleteMany({
      where: { comparisonId: photo.scene.comparison.id },
    });
    await prisma.comparison.delete({
      where: { id: photo.scene.comparison.id },
    });
  }

  await prisma.photo.delete({ where: { id: photoId } });
  revalidatePath(`/session/${sessionId}/upload`);
}

// 8. Delete an entire scene and all its photos
export async function deleteScene(sceneId: string, sessionId: string) {
  const scene = await prisma.scene.findUnique({
    where: { id: sceneId },
    include: {
      photos: true,
      comparison: { include: { votes: true } },
    },
  });
  if (!scene) return;

  const s3Keys = scene.photos.flatMap((p) => [p.storageKey, p.thumbKey]);
  await deleteS3Objects(s3Keys);

  if (scene.comparison) {
    await prisma.vote.deleteMany({
      where: { comparisonId: scene.comparison.id },
    });
    await prisma.comparison.delete({ where: { id: scene.comparison.id } });
  }

  await prisma.photo.deleteMany({ where: { sceneId } });
  await prisma.scene.delete({ where: { id: sceneId } });
  revalidatePath(`/session/${sessionId}/upload`);
}

// 9. Delete an entire session and everything under it
export async function deleteSession(sessionId: string) {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      scenes: {
        include: {
          photos: true,
          comparison: { include: { votes: true } },
        },
      },
    },
  });
  if (!session) return;

  const s3Keys = session.scenes.flatMap((sc) =>
    sc.photos.flatMap((p) => [p.storageKey, p.thumbKey]),
  );
  await deleteS3Objects(s3Keys);

  const comparisonIds = session.scenes
    .filter((sc) => sc.comparison)
    .map((sc) => sc.comparison!.id);

  if (comparisonIds.length > 0) {
    await prisma.vote.deleteMany({
      where: { comparisonId: { in: comparisonIds } },
    });
    await prisma.comparison.deleteMany({
      where: { id: { in: comparisonIds } },
    });
  }

  const sceneIds = session.scenes.map((sc) => sc.id);
  if (sceneIds.length > 0) {
    await prisma.photo.deleteMany({ where: { sceneId: { in: sceneIds } } });
    await prisma.scene.deleteMany({ where: { id: { in: sceneIds } } });
  }

  await prisma.session.delete({ where: { id: sessionId } });
  revalidatePath("/");
}
