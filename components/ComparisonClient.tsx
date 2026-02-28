"use client";
import { useState, useRef } from "react";
import {
  TransformWrapper,
  TransformComponent,
  ReactZoomPanPinchRef,
} from "react-zoom-pan-pinch";
import { revealIdentity } from "@/app/actions";
import { Eye, Lock, Home, BookOpen } from "lucide-react";
import Link from "next/link";

interface ImageBlock {
  position: string;
  url: string;
  id: string;
}

export default function ComparisonClient({
  initialImages,
  comparisonId,
  phoneNames,
  sessionId,
}: {
  initialImages: ImageBlock[];
  comparisonId: string;
  phoneNames: Record<string, string>;
  sessionId: string;
}) {
  const [revealed, setRevealed] = useState<Record<string, string> | null>(null);
  const [sync, setSync] = useState(true);

  // Refs to control zoom synchronization
  const leftRef = useRef<ReactZoomPanPinchRef>(null);
  const rightRef = useRef<ReactZoomPanPinchRef>(null);

  const handleTransform = (
    ref: React.RefObject<ReactZoomPanPinchRef>,
    state: { scale: number; positionX: number; positionY: number },
  ) => {
    if (!sync) return;

    const target = ref === leftRef ? rightRef : leftRef;

    if (target.current) {
      const targetState = target.current.instance.transformState;

      // THE GUARD: Only update if the values are actually different
      // This prevents the infinite loop/call stack error
      if (
        Math.abs(targetState.positionX - state.positionX) > 0.1 ||
        Math.abs(targetState.positionY - state.positionY) > 0.1 ||
        Math.abs(targetState.scale - state.scale) > 0.01
      ) {
        target.current.setTransform(
          state.positionX,
          state.positionY,
          state.scale,
          0,
        );
      }
    }
  };

  const toggleReveal = async () => {
    if (revealed) {
      // If already showing, hide them
      setRevealed(null);
    } else {
      // If hidden, fetch and show them
      try {
        const mapping = await revealIdentity(comparisonId);
        const translated: Record<string, string> = {};

        Object.entries(mapping).forEach(([pos, label]) => {
          translated[pos] = phoneNames[label] || `Phone ${label}`;
        });

        setRevealed(translated);
      } catch (err) {
        console.error("Reveal failed:", err);
      }
    }
  };

  return (
    <div className="flex flex-col h-screen bg-black text-white overflow-hidden">
      {/* Top Toolbar */}
      <div className="flex items-center justify-between px-6 py-4 bg-gray-900/50 border-b border-white/10">
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-medium text-gray-400 hover:text-white transition-colors"
          >
            <Home size={18} />
            Home
          </Link>
          <Link
            href={`/session/${sessionId}/review`}
            className="flex items-center gap-2 text-sm font-medium text-gray-400 hover:text-white transition-colors"
          >
            <BookOpen size={18} />
            Review Session
          </Link>
          <label className="flex items-center gap-2 text-sm cursor-pointer hover:text-blue-400 transition-colors">
            <input
              type="checkbox"
              checked={sync}
              onChange={(e) => setSync(e.target.checked)}
              className="rounded border-gray-700 bg-gray-800 text-blue-600 focus:ring-0"
            />
            Sync Pan/Zoom
          </label>
        </div>

        <button
          onClick={toggleReveal}
          className="flex items-center gap-2 px-5 py-2 rounded-xl font-semibold text-sm text-white border border-transparent hover:border-white/30 transition-all duration-300"
        >
          {revealed ? <Lock size={16} /> : <Eye size={16} />}
          {revealed ? "Hide Identities" : "Reveal Identities"}
        </button>
      </div>

      {/* Side-by-Side Viewer */}
      <div className="flex-1 flex flex-row">
        {initialImages
          .sort((a, b) => a.position.localeCompare(b.position))
          .map((img) => {
            const isLeft = img.position === "left";
            const ref = isLeft ? leftRef : rightRef;

            return (
              <div
                key={img.id}
                className="relative flex-1 border-r border-white/5 last:border-0 group"
              >
                {/* Overlay Labels */}
                <div className="absolute top-6 left-6 z-20 pointer-events-none">
                  <div className="flex flex-col gap-2">
                    <span className="px-3 py-1 bg-black/60 backdrop-blur-md rounded-lg text-xs font-black uppercase tracking-widest border border-white/10">
                      Slot: {img.position}
                    </span>
                    {revealed && (
                      <span className="px-3 py-1.5 text-sm font-semibold animate-in fade-in slide-in-from-top-2 duration-300">
                        {revealed[img.position]}
                      </span>
                    )}
                  </div>
                </div>

                <TransformWrapper
                  ref={ref}
                  onTransformed={(_, state) => handleTransform(ref, state)}
                  minScale={1}
                  maxScale={10}
                >
                  <TransformComponent
                    wrapperClass="!w-full !h-full"
                    contentClass="!w-full !h-full"
                  >
                    <img
                      src={img.url}
                      alt="Comparison"
                      className="w-full h-full object-contain select-none"
                      draggable={false}
                    />
                  </TransformComponent>
                </TransformWrapper>
              </div>
            );
          })}
      </div>
    </div>
  );
}
