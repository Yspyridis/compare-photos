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
  Layers,
  Trash2,
  RotateCcw,
  AlertTriangle,
  X,
} from "lucide-react";

interface PhotoEntry {
  id: string;
  label: string;
}

interface SceneState {
  index: number;
  sceneId: string | null; // null for scenes not yet persisted to DB
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

  // `${sceneIndex}-${label}` while uploading a photo
  const [uploading, setUploading] = useState<string | null>(null);
  // photoId currently being deleted (redo)
  const [deletingPhoto, setDeletingPhoto] = useState<string | null>(null);
  // scene index awaiting delete confirmation
  const [confirmDeleteScene, setConfirmDeleteScene] = useState<number | null>(
    null,
  );
  // scene index currently being deleted
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

    // Detect format from magic bytes (some Linux browsers leave type blank)
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

  // ── Delete photo (redo) ───────────────────────────────────────────────────

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
    // First click → enter confirm state
    if (confirmDeleteScene !== scene.index) {
      setConfirmDeleteScene(scene.index);
      return;
    }

    // Second click → confirmed
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

  // ── Render ────────────────────────────────────────────────────────────────

  if (scenes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-6">
        <div className="bg-gray-100 p-5 rounded-2xl">
          <Layers className="text-gray-400" size={36} />
        </div>
        <div>
          <p className="font-black text-gray-800 text-xl mb-1">No scenes yet</p>
          <p className="text-gray-500 text-sm">
            Add a scene to start uploading photos.
          </p>
        </div>
        <button
          onClick={addScene}
          className="flex items-center gap-2 px-8 py-3 bg-black text-white rounded-2xl font-bold hover:bg-gray-800 transition-all"
        >
          <Plus size={18} />
          Add First Scene
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {scenes.map((scene, displayIndex) => {
        const complete = isSceneComplete(scene);
        const isDeleting = deletingScene === scene.index;
        const isConfirming = confirmDeleteScene === scene.index;

        return (
          <div
            key={scene.index}
            className={`rounded-3xl border-2 p-6 transition-all ${
              isDeleting
                ? "opacity-40 pointer-events-none border-gray-100 bg-white"
                : complete
                  ? "border-green-200 bg-green-50/30"
                  : "border-gray-100 bg-white shadow-sm"
            }`}
          >
            {/* Scene header */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div
                  className={`p-1.5 rounded-lg ${
                    complete ? "bg-green-100" : "bg-gray-100"
                  }`}
                >
                  {isDeleting ? (
                    <Loader2 size={16} className="animate-spin text-gray-400" />
                  ) : (
                    <Layers
                      size={16}
                      className={complete ? "text-green-600" : "text-gray-400"}
                    />
                  )}
                </div>
                <h2 className="font-black text-gray-900 text-lg">
                  Scene {displayIndex + 1}
                </h2>
              </div>

              <div className="flex items-center gap-2">
                {complete && !isConfirming && (
                  <span className="flex items-center gap-1.5 text-xs font-bold text-green-600 bg-green-100 px-3 py-1 rounded-full">
                    <CheckCircle2 size={12} />
                    Complete
                  </span>
                )}

                {/* Delete scene button — inline confirm */}
                {isConfirming ? (
                  <div className="flex items-center gap-1.5">
                    <span className="flex items-center gap-1 text-xs font-bold text-red-500">
                      <AlertTriangle size={12} />
                      Delete scene?
                    </span>
                    <button
                      onClick={() => handleDeleteScene(scene)}
                      disabled={isBusy}
                      className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded-lg transition-all"
                    >
                      Yes, delete
                    </button>
                    <button
                      onClick={() => setConfirmDeleteScene(null)}
                      className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                      aria-label="Cancel"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => handleDeleteScene(scene)}
                    disabled={isBusy}
                    className="p-1.5 rounded-lg text-gray-300 hover:text-red-400 hover:bg-red-50 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    aria-label="Delete scene"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            </div>

            {/* Phone upload cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    className={`relative border-2 border-dashed rounded-2xl p-6 transition-all ${
                      isDone
                        ? "border-green-400 bg-green-50/40"
                        : "border-gray-200 hover:border-blue-300"
                    }`}
                  >
                    <div className="flex flex-col items-center text-center">
                      <div
                        className={`p-3 rounded-xl mb-3 ${
                          isDone
                            ? "bg-green-100 text-green-600"
                            : "bg-gray-100 text-gray-400"
                        }`}
                      >
                        {isCurrentUploading || isCurrentDeleting ? (
                          <Loader2 className="animate-spin" size={24} />
                        ) : isDone ? (
                          <CheckCircle2 size={24} />
                        ) : (
                          <ImageIcon size={24} />
                        )}
                      </div>

                      <h3 className="text-base font-bold text-gray-900 mb-0.5">
                        {displayName}
                      </h3>
                      <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">
                        Slot {label}
                      </p>

                      {/* Not uploaded yet */}
                      {!isDone && (
                        <label
                          className={`cursor-pointer bg-black text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${
                            isBusy
                              ? "opacity-50 pointer-events-none"
                              : "hover:bg-gray-800"
                          }`}
                        >
                          <Upload size={14} />
                          {isCurrentUploading ? "Uploading…" : "Select Photo"}
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

                      {/* Uploaded — show status + redo button */}
                      {isDone && (
                        <div className="flex items-center gap-3">
                          <span className="text-green-600 font-bold text-sm">
                            Ready ✓
                          </span>
                          <button
                            onClick={() =>
                              photo && handleDeletePhoto(photo, scene.index)
                            }
                            disabled={isBusy}
                            title="Re-upload this photo"
                            className="flex items-center gap-1 text-xs text-gray-400 hover:text-orange-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <RotateCcw size={13} />
                            Redo
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Bottom actions */}
      <div className="flex items-center justify-between pt-4 pb-8">
        <button
          onClick={addScene}
          disabled={!lastSceneComplete || isBusy}
          className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold border-2 transition-all ${
            lastSceneComplete && !isBusy
              ? "border-gray-300 text-gray-700 hover:border-gray-400 hover:bg-gray-50 cursor-pointer"
              : "border-gray-200 text-gray-400 cursor-not-allowed"
          }`}
        >
          <Plus size={18} />
          Add Scene
        </button>

        <button
          onClick={() => router.push(`/session/${sessionId}/compare`)}
          disabled={!anySceneComplete}
          className={`group flex items-center gap-3 px-10 py-4 rounded-2xl font-black text-lg transition-all ${
            anySceneComplete
              ? "bg-blue-600 text-white shadow-xl shadow-blue-200 hover:scale-105"
              : "bg-gray-200 text-gray-400 cursor-not-allowed"
          }`}
        >
          Start Comparing
          <ArrowRight
            size={22}
            className={
              anySceneComplete
                ? "group-hover:translate-x-2 transition-transform"
                : ""
            }
          />
        </button>
      </div>
    </div>
  );
}
