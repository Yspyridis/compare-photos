import prisma from "@/lib/prisma";
import { getComparison } from "@/app/actions";
import ComparisonClient from "@/components/ComparisonClient";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ComparePage({
  params,
}: {
  params: { id: string };
}) {
  const scene = await prisma.scene.findFirst({
    where: { sessionId: params.id },
    include: { session: true }, // Add this to get the phone names!
    orderBy: { index: "asc" },
  });

  if (!scene) return notFound();

  // This function creates the comparison record if it doesn't exist
  const comparisonData = await getComparison(scene.id);

  return (
    <ComparisonClient
      initialImages={comparisonData.images}
      comparisonId={comparisonData.comparisonId}
      // Pass the real names down here
      phoneNames={scene.session.phoneNames as Record<string, string>}
    />
  );
}
