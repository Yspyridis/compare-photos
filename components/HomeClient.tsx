"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSession, deleteSession } from "@/app/actions";
import { ArrowRight, Loader2, ChevronRight, Trash2, X } from "lucide-react";
import Link from "next/link";

interface Session {
  id: string;
  title: string;
  createdAt: string;
  sceneCount: number;
  phoneNames: Record<string, string>;
  phones: string[];
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function HomeClient({ sessions }: { sessions: Session[] }) {
  const [tab, setTab] = useState<"new" | "history">("new");
  const [sessionList, setSessionList] = useState(sessions);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [phoneCount, setPhoneCount] = useState(2);
  const [phoneNames, setPhoneNames] = useState<Record<string, string>>({
    A: "",
    B: "",
    C: "",
  });
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const phones = phoneCount === 2 ? ["A", "B"] : ["A", "B", "C"];
      const finalNames: Record<string, string> = {};
      phones.forEach((p) => {
        finalNames[p] = phoneNames[p] || `Phone ${p}`;
      });
      const session = await createSession(title, phones, finalNames);
      router.push(`/session/${session.id}/upload`);
    } catch (err) {
      console.error(err);
      alert("Failed to create session. Ensure your database is running.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    setConfirmDeleteId(null);
    setDeletingId(sessionId);
    try {
      await deleteSession(sessionId);
      setSessionList((prev) => prev.filter((s) => s.id !== sessionId));
    } catch (err) {
      console.error(err);
      alert("Failed to delete session.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleNameChange = (label: string, value: string) => {
    setPhoneNames((prev) => ({ ...prev, [label]: value }));
  };

  const labels = phoneCount === 2 ? ["A", "B"] : ["A", "B", "C"];

  return (
    <main className="min-h-screen bg-gray-900 text-white font-sans">
      <div className="max-w-sm mx-auto px-6 pt-24 pb-24">
        {/* ── Brand ── */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-black tracking-tight leading-none">
            Blind Frame
          </h1>
          <p className="text-gray-400 text-sm mt-4 leading-relaxed whitespace-nowrap">
            side-by-side camera tests with identity revealed later
          </p>
        </div>

        {/* ── Tabs ── */}
        <div className="flex border-b border-white/10 mb-10">
          {(["new", "history"] as const).map((t) => {
            const label =
              t === "new"
                ? "New"
                : `History${sessionList.length > 0 ? ` · ${sessionList.length}` : ""}`;
            const active = tab === t;
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`relative pb-3 mr-7 text-sm font-medium transition-colors ${
                  active ? "text-white" : "text-gray-500 hover:text-gray-300"
                }`}
              >
                {label}
                {active && (
                  <span className="absolute bottom-0 inset-x-0 h-px bg-white" />
                )}
              </button>
            );
          })}
        </div>

        {/* ── New Test form ── */}
        {tab === "new" && (
          <form onSubmit={handleSubmit} className="space-y-10">
            {/* Title */}
            <input
              required
              type="text"
              placeholder="Test name…"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-transparent border-b border-white/15 pb-3 text-sm font-semibold text-white placeholder:text-gray-700 focus:outline-none focus:border-white/40 transition-colors"
            />

            {/* Device count + names combined */}
            <div className="space-y-6">
              {/* Count toggle */}
              <div className="flex items-center gap-1">
                {[2, 3].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setPhoneCount(n)}
                    className={`px-3.5 py-1.5 text-sm font-semibold transition-all border-b ${
                      phoneCount === n
                        ? "border-white/50 text-white"
                        : "border-transparent text-gray-600 hover:text-gray-400"
                    }`}
                  >
                    {n} devices
                  </button>
                ))}
              </div>

              {/* Device name inputs */}
              <div
                className={`grid gap-x-6 gap-y-7 ${
                  phoneCount === 3 ? "grid-cols-3" : "grid-cols-2"
                }`}
              >
                {labels.map((label) => (
                  <div key={label}>
                    <p className="text-[11px] font-semibold text-gray-600 tracking-widest uppercase mb-2">
                      {label}
                    </p>
                    <input
                      required
                      type="text"
                      placeholder="Device name"
                      value={phoneNames[label]}
                      onChange={(e) => handleNameChange(label, e.target.value)}
                      className="w-full bg-transparent border-b border-white/15 pb-2 text-sm text-white placeholder:text-gray-700 focus:outline-none focus:border-white/40 transition-colors"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full group flex items-center justify-center gap-2 border border-transparent hover:border-white/30 disabled:opacity-40 text-white font-semibold text-sm py-3.5 rounded-xl transition-all duration-300"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                <>
                  Create session
                  <ArrowRight
                    size={15}
                    className="group-hover:translate-x-0.5 transition-transform"
                  />
                </>
              )}
            </button>
          </form>
        )}

        {/* ── History ── */}
        {tab === "history" && (
          <>
            {sessionList.length === 0 ? (
              <p className="text-gray-600 text-sm text-center py-16">
                No tests yet.
              </p>
            ) : (
              <div className="divide-y divide-white/5">
                {sessionList.map((session) => {
                  const deviceNames = session.phones
                    .map((p) => session.phoneNames[p] || `Phone ${p}`)
                    .join(" · ");
                  const isDeleting = deletingId === session.id;
                  const isConfirming = confirmDeleteId === session.id;

                  return (
                    <div
                      key={session.id}
                      className={`flex items-center gap-4 py-4 transition-opacity ${
                        isDeleting ? "opacity-30 pointer-events-none" : ""
                      }`}
                    >
                      {/* Info */}
                      <Link
                        href={`/session/${session.id}/review`}
                        className="flex-1 min-w-0 group"
                      >
                        <p className="text-sm font-medium text-white group-hover:text-gray-200 transition-colors truncate leading-snug">
                          {session.title}
                        </p>
                        <p className="text-xs text-gray-500 truncate mt-0.5 leading-snug">
                          {deviceNames}
                        </p>
                      </Link>

                      {/* Meta */}
                      <div className="text-right shrink-0 hidden sm:block">
                        <p className="text-xs text-gray-600">
                          {session.sceneCount}{" "}
                          {session.sceneCount === 1 ? "scene" : "scenes"}
                        </p>
                        <p className="text-xs text-gray-700 mt-0.5">
                          {formatDate(session.createdAt)}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        {isConfirming ? (
                          <>
                            <span className="text-xs text-red-400 font-medium mr-1">
                              Delete?
                            </span>
                            <button
                              onClick={() => handleDeleteSession(session.id)}
                              className="px-2.5 py-1 rounded-md bg-red-500/15 hover:bg-red-500/25 text-red-400 text-xs font-semibold border border-red-500/20 transition-all"
                            >
                              Yes
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="p-1 text-gray-600 hover:text-gray-400 transition-colors"
                            >
                              <X size={13} />
                            </button>
                          </>
                        ) : (
                          <>
                            {isDeleting ? (
                              <Loader2
                                size={13}
                                className="text-gray-600 animate-spin mr-1"
                              />
                            ) : (
                              <button
                                onClick={() => setConfirmDeleteId(session.id)}
                                className="p-1.5 text-gray-700 hover:text-red-400 transition-colors"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                            <Link href={`/session/${session.id}/review`}>
                              <ChevronRight
                                size={15}
                                className="text-gray-700 hover:text-gray-400 transition-colors"
                              />
                            </Link>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
