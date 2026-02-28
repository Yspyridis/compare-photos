import { getSessionForReview } from "@/app/actions";
import ReviewClient from "@/components/ReviewClient";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ReviewPage({
  params,
}: {
  params: { id: string };
}) {
  let session;
  try {
    session = await getSessionForReview(params.id);
  } catch {
    return notFound();
  }

  if (session.scenes.length === 0) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#f8f9fa]">
        <div className="text-center">
          <p className="text-2xl font-black text-gray-900 mb-2">No scenes yet</p>
          <p className="text-gray-500">Upload photos first to review them here.</p>
        </div>
      </main>
    );
  }

  return (
    <ReviewClient
      sessionId={session.id}
      sessionTitle={session.title}
      phoneNames={session.phoneNames}
      phones={session.phones}
      scenes={session.scenes}
    />
  );
}
