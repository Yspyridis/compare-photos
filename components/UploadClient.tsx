"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { uploadPhoto, deletePhoto, deleteScene } from "@/app/actions";
import {
  Upload,
  CheckCircle2,
  Loader2,
  Image as ImageIcon,
  ArrowRight,
  Plus,
  Trash2,
  RotateCcw,
  X,
} from "lucide-react";

interface PhotoEntry {
  id: string;
  label: string;
}

interface SceneState {
  index: number;
  sceneId: string | null;
  photos: PhotoEntry[];
}

interface Props {
  sessionId: string;
  phoneLabels: string[];
  phoneNames: Record<string, string>;
  initialScenes: SceneState[];
}

export default function UploadClient({
  sessionId,
  phoneLabels,
  phoneNames,
  initialScenes,
}: Props) {
  const [scenes, setScenes] = useState<SceneState[]>(
    initialScenes.length > 0
      ? initialScenes
      : [{ index: 0, sceneId: null, photos: [] }],
  );

  const [uploading, setUploading] = useState<string | null>(null);
  const [deletingPhoto, setDeletingPhoto] = useState<string | null>(null);
  const [confirmDeleteScene, setConfirmDeleteScene] = useState<number | null>(
    null,
  );
  const [deletingScene, setDeletingScene] = useState<number | null>(null);

  const router = useRouter();

  // ── Upload ────────────────────────────────────────────────────────────────

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    sceneIndex: number,
    label: string,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const header = await file.slice(0, 4).arrayBuffer();
    const bytes = new Uint8Array(header);
    const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    const isPng =
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47;

    if (!isJpeg && !isPng) {
      alert("Please upload a JPEG or PNG image.");
      e.target.value = "";
      return;
    }

    const resolvedType = file.type || (isJpeg ? "image/jpeg" : "image/png");
    const uploadFile =
      file.type === resolvedType
        ? file
        : new File([file], file.name, { type: resolvedType });

    const key = `${sceneIndex}-${label}`;
    setUploading(key);

    const formData = new FormData();
    formData.append("file", uploadFile);

    try {
      const result = await uploadPhoto(sessionId, label, sceneIndex, formData);
      setScenes((prev) =>
        prev.map((s) =>
          s.index === sceneIndex
            ? {
                ...s,
                sceneId: s.sceneId ?? result.sceneId,
                photos: [...s.photos, { id: result.photoId, label }],
              }
            : s,
        ),
      );
    } catch (err) {
      console.error("Upload error:", err);
      const message =
        err instanceof Error ? err.message : "Unknown error occurred.";
      alert(`Upload failed: ${message}`);
    } finally {
      setUploading(null);
      e.target.value = "";
    }
  };

  // ── Delete photo ──────────────────────────────────────────────────────────

  const handleDeletePhoto = async (photo: PhotoEntry, sceneIndex: number) => {
    setDeletingPhoto(photo.id);
    try {
      await deletePhoto(photo.id, sessionId);
      setScenes((prev) =>
        prev.map((s) =>
          s.index === sceneIndex
            ? { ...s, photos: s.photos.filter((p) => p.id !== photo.id) }
            : s,
        ),
      );
    } catch (err) {
      console.error("Delete photo error:", err);
      alert("Failed to remove photo. Please try again.");
    } finally {
      setDeletingPhoto(null);
    }
  };

  // ── Delete scene ──────────────────────────────────────────────────────────

  const handleDeleteScene = async (scene: SceneState) => {
    if (confirmDeleteScene !== scene.index) {
      setConfirmDeleteScene(scene.index);
      return;
    }
    setConfirmDeleteScene(null);
    setDeletingScene(scene.index);
    try {
      if (scene.sceneId) {
        await deleteScene(scene.sceneId, sessionId);
      }
      setScenes((prev) => prev.filter((s) => s.index !== scene.index));
    } catch (err) {
      console.error("Delete scene error:", err);
      alert("Failed to delete scene. Please try again.");
    } finally {
      setDeletingScene(null);
    }
  };

  // ── Add scene ─────────────────────────────────────────────────────────────

  const addScene = () => {
    const nextIndex =
      scenes.length > 0 ? Math.max(...scenes.map((s) => s.index)) + 1 : 0;
    setScenes((prev) => [
      ...prev,
      { index: nextIndex, sceneId: null, photos: [] },
    ]);
    setTimeout(
      () =>
        window.scrollTo({
          top: document.body.scrollHeight,
          behavior: "smooth",
        }),
      50,
    );
  };

  // ── Helpers ───────────────────────────────────────────────────────────────

  const isSceneComplete = (scene: SceneState) =>
    phoneLabels.every((l) => scene.photos.some((p) => p.label === l));

  const lastScene = scenes[scenes.length - 1];
  const lastSceneComplete = lastScene ? isSceneComplete(lastScene) : true;
  const anySceneComplete = scenes.some(isSceneComplete);
  const isBusy = !!uploading || !!deletingPhoto || !!deletingScene;

  // ── Empty state ───────────────────────────────────────────────────────────

  if (scenes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center gap-5">
        <ImageIcon className="text-gray-700" size={32} />
        <div>
          <p className="text-white font-semibold mb-1">No scenes yet</p>
          <p className="text-gray-500 text-sm">
            Add a scene to start uploading photos.
          </p>
        </div>
        <button
          onClick={addScene}
          className="flex items-center gap-2 text-sm font-medium text-gray-400 hover:text-green-400 transition-colors"
        >
          <Plus size={14} />
          Add First Scene
        </button>
      </div>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {scenes.map((scene, displayIndex) => {
        const complete = isSceneComplete(scene);
        const isDeleting = deletingScene === scene.index;
        const isConfirming = confirmDeleteScene === scene.index;

        return (
          <div
            key={scene.index}
            className={`bg-gray-800/60 border border-white/10 rounded-3xl p-6 transition-all ${
              isDeleting ? "opacity-30 pointer-events-none" : ""
            }`}
          >
            {/* Scene header */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                {isDeleting ? (
                  <Loader2 size={14} className="animate-spin text-gray-600" />
                ) : null}
                <span className="text-sm font-semibold text-white">
                  Scene {displayIndex + 1}
                </span>
                {complete && (
                  <span className="text-xs text-green-400">· Complete</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {isConfirming ? (
                  <>
                    <span className="text-xs text-red-400">Delete scene?</span>
                    <button
                      onClick={() => handleDeleteScene(scene)}
                      disabled={isBusy}
                      className="text-xs text-red-400 hover:text-red-300 font-medium transition-colors"
                    >
                      Yes
                    </button>
                    <button
                      onClick={() => setConfirmDeleteScene(null)}
                      className="text-gray-600 hover:text-gray-400 transition-colors"
                    >
                      <X size={13} />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => handleDeleteScene(scene)}
                    disabled={isBusy}
                    className="text-gray-700 hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    aria-label="Delete scene"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>

            {/* Device upload slots */}
            <div
              className={`grid gap-3 ${phoneLabels.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}
            >
              {phoneLabels.map((label) => {
                const photo = scene.photos.find((p) => p.label === label);
                const isDone = !!photo;
                const uploadKey = `${scene.index}-${label}`;
                const isCurrentUploading = uploading === uploadKey;
                const isCurrentDeleting = !!photo && deletingPhoto === photo.id;
                const displayName = phoneNames[label] || `Phone ${label}`;

                return (
                  <div
                    key={label}
                    className={`rounded-2xl border p-6 transition-all ${
                      isDone
                        ? "border-green-400/25"
                        : "border-white/10 bg-white/[0.03]"
                    }`}
                  >
                    {/* Device name row */}
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-white truncate">
                        {displayName}
                      </span>
                      {isCurrentUploading || isCurrentDeleting ? (
                        <Loader2
                          size={13}
                          className="animate-spin text-gray-500 shrink-0"
                        />
                      ) : isDone ? (
                        <CheckCircle2
                          size={13}
                          className="text-green-400 shrink-0"
                        />
                      ) : (
                        <ImageIcon
                          size={13}
                          className="text-gray-700 shrink-0"
                        />
                      )}
                    </div>

                    {/* Action row */}
                    {isDone ? (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-green-400">Ready</span>
                        <button
                          onClick={() =>
                            photo && handleDeletePhoto(photo, scene.index)
                          }
                          disabled={isBusy}
                          title="Re-upload this photo"
                          className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        >
                          <RotateCcw size={11} />
                          Redo
                        </button>
                      </div>
                    ) : (
                      <label
                        className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
                          isBusy
                            ? "text-gray-700 pointer-events-none"
                            : "text-gray-500 hover:text-white cursor-pointer"
                        }`}
                      >
                        <Upload size={11} />
                        {isCurrentUploading ? "Uploading…" : "Select photo"}
                        <input
                          type="file"
                          className="hidden"
                          accept="image/jpeg,image/png"
                          onChange={(e) =>
                            handleFileChange(e, scene.index, label)
                          }
                          disabled={isBusy}
                        />
                      </label>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Bottom actions */}
      <div className="flex items-center justify-between pt-4 pb-10">
        <button
          onClick={addScene}
          disabled={!lastSceneComplete || isBusy}
          className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-green-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <Plus size={14} />
          Add Scene
        </button>

        <button
          onClick={() => router.push(`/session/${sessionId}/compare`)}
          disabled={!anySceneComplete}
          className="group flex items-center gap-2 text-sm font-medium text-white hover:text-green-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          Start Comparing
          <ArrowRight
            size={14}
            className="group-hover:translate-x-0.5 transition-transform"
          />
        </button>
      </div>
    </div>
  );
}
