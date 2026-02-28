"use client";
import { useState, useRef, useCallback, useMemo } from "react";
import {
  TransformWrapper,
  TransformComponent,
  ReactZoomPanPinchRef,
} from "react-zoom-pan-pinch";
import {
  ChevronLeft,
  ChevronRight,
  Home,
  Eye,
  EyeOff,
  FlaskConical,
  BookOpen,
  Plus,
} from "lucide-react";
import Link from "next/link";
import type { ReviewPhoto, ReviewScene } from "@/app/actions";

interface Props {
  sessionId: string;
  sessionTitle: string;
  phoneNames: Record<string, string>;
  phones: string[];
  scenes: ReviewScene[];
}

function fisherYates<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export default function ReviewClient({
  sessionId,
  sessionTitle,
  phoneNames,
  scenes,
}: Props) {
  const [sceneIndex, setSceneIndex] = useState(0);
  const [sync, setSync] = useState(true);
  const [testMode, setTestMode] = useState(true);
  const [revealed, setRevealed] = useState(false);

  // Shuffled photos for the currently visible scene.
  // Re-shuffled every time the user navigates to a different scene.
  const [displayPhotos, setDisplayPhotos] = useState<ReviewPhoto[]>(() =>
    fisherYates([...scenes[0].photos]),
  );

  // Positional refs — index 0 = leftmost panel, 1 = middle, 2 = rightmost.
  // Keyed by display position so sync works regardless of which phone lands where.
  const ref0 = useRef<ReactZoomPanPinchRef>(null);
  const ref1 = useRef<ReactZoomPanPinchRef>(null);
  const ref2 = useRef<ReactZoomPanPinchRef>(null);
  const positionalRefs = useMemo(() => [ref0, ref1, ref2], []);

  const totalScenes = scenes.length;

  const goTo = useCallback(
    (next: number) => {
      setSceneIndex(next);
      setRevealed(false);
      setDisplayPhotos(fisherYates([...scenes[next].photos]));
      positionalRefs.forEach((r) => r.current?.resetTransform(0));
    },
    [scenes, positionalRefs],
  );

  const handleTransform = useCallback(
    (
      movedIndex: number,
      state: { positionX: number; positionY: number; scale: number },
    ) => {
      if (!sync) return;
      positionalRefs.forEach((ref, i) => {
        if (i === movedIndex || !ref.current) return;
        const t = ref.current.instance.transformState;
        if (
          Math.abs(t.positionX - state.positionX) > 0.1 ||
          Math.abs(t.positionY - state.positionY) > 0.1 ||
          Math.abs(t.scale - state.scale) > 0.01
        ) {
          ref.current.setTransform(
            state.positionX,
            state.positionY,
            state.scale,
            0,
          );
        }
      });
    },
    [sync, positionalRefs],
  );

  const showLabel = !testMode || revealed;

  return (
    <div className="flex flex-col h-screen bg-black text-white overflow-hidden">
      {/* ── Toolbar ── */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center px-5 py-3 bg-gray-900/60 border-b border-white/10 gap-4">
        {/* Left: Home + Add Scene */}
        <div className="flex items-center gap-5 min-w-0">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm font-medium text-gray-400 hover:text-white transition-colors shrink-0"
          >
            <Home size={16} />
            Home
          </Link>

          <Link
            href={`/session/${sessionId}/upload`}
            className="flex items-center gap-1.5 text-sm font-medium text-gray-400 hover:text-green-400 transition-colors shrink-0"
          >
            <Plus size={16} />
            Add Scene
          </Link>
        </div>

        {/* Center: title */}
        <span className="text-white font-bold truncate max-w-[320px] text-center">
          {sessionTitle}
        </span>

        {/* Right: Sync zoom + Reveal + Mode toggle (always rightmost) */}
        <div className="flex items-center gap-4 justify-end">
          <label className="flex items-center gap-2 text-sm cursor-pointer text-gray-400 hover:text-white transition-colors shrink-0">
            <input
              type="checkbox"
              checked={sync}
              onChange={(e) => setSync(e.target.checked)}
              className="rounded border-gray-700 bg-gray-800 text-blue-600 focus:ring-0"
            />
            Sync zoom
          </label>

          {testMode && (
            <button
              onClick={() => setRevealed((r) => !r)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-400 hover:text-white transition-colors duration-200"
            >
              {revealed ? <EyeOff size={16} /> : <Eye size={16} />}
              {revealed ? "Hide" : "Reveal"}
            </button>
          )}

          <button
            onClick={() => {
              setTestMode((m) => !m);
              setRevealed(false);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-400 hover:text-white transition-colors duration-200"
            title={
              testMode
                ? "Switch to Study mode (labels visible)"
                : "Switch to Test mode (labels hidden)"
            }
          >
            {testMode ? (
              <>
                <FlaskConical size={14} />
                Test mode
              </>
            ) : (
              <>
                <BookOpen size={14} />
                Study mode
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Scene dot strip ── */}
      {totalScenes > 1 && (
        <div className="flex items-center justify-center gap-1.5 py-2 bg-gray-950/40">
          {scenes.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={`rounded-full transition-all ${
                i === sceneIndex
                  ? "w-4 h-2 bg-white"
                  : "w-2 h-2 bg-white/20 hover:bg-white/40"
              }`}
              aria-label={`Go to scene ${i + 1}`}
            />
          ))}
        </div>
      )}

      {/* ── Photo grid (displayPhotos = shuffled order) ── */}
      <div className="flex-1 flex flex-row overflow-hidden">
        {displayPhotos.map((photo, displayIdx) => {
          const ref = positionalRefs[displayIdx];
          const deviceName =
            phoneNames[photo.phoneLabel] || `Phone ${photo.phoneLabel}`;

          return (
            <div
              key={photo.id}
              className="relative flex-1 border-r border-white/5 last:border-0 overflow-hidden"
            >
              {/* Label overlay */}
              <div className="absolute top-5 left-5 z-20 pointer-events-none">
                {showLabel ? (
                  <div className="flex flex-col gap-1.5">
                    <span className="px-3 py-1.5 text-sm font-semibold animate-in fade-in slide-in-from-top-2 duration-300">
                      {deviceName}
                    </span>
                  </div>
                ) : (
                  <span className="text-sm font-medium text-gray-400">?</span>
                )}
              </div>

              <TransformWrapper
                ref={ref}
                onTransformed={(_, state) => handleTransform(displayIdx, state)}
                minScale={1}
                maxScale={12}
                doubleClick={{ mode: "reset" }}
              >
                <TransformComponent
                  wrapperClass="!w-full !h-full"
                  contentClass="!w-full !h-full"
                >
                  <img
                    src={photo.url}
                    alt={showLabel ? deviceName : "Hidden"}
                    className="w-full h-full object-contain select-none"
                    draggable={false}
                  />
                </TransformComponent>
              </TransformWrapper>
            </div>
          );
        })}
      </div>

      {/* ── Bottom navigation bar ── */}
      <div className="flex items-center justify-center gap-3 px-6 py-3 bg-gray-900/60 border-t border-white/10">
        <button
          onClick={() => goTo(sceneIndex - 1)}
          disabled={sceneIndex === 0}
          className="p-1.5 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          aria-label="Previous scene"
        >
          <ChevronLeft size={16} />
        </button>

        <div className="flex items-center gap-1 px-3 py-1 text-sm font-bold min-w-[90px] justify-center">
          <span>Scene</span>
          <span className="text-white">{sceneIndex + 1}</span>
          <span className="text-gray-500">/ {totalScenes}</span>
        </div>

        <button
          onClick={() => goTo(sceneIndex + 1)}
          disabled={sceneIndex === totalScenes - 1}
          className="p-1.5 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          aria-label="Next scene"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
