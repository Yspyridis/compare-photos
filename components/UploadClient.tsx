"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { uploadPhoto } from "@/app/actions";
import {
  Upload,
  CheckCircle2,
  Loader2,
  Image as ImageIcon,
  ArrowRight,
} from "lucide-react";

interface Props {
  sessionId: string;
  phoneLabels: string[];
  phoneNames: Record<string, string>;
  initialPhotos: any[];
}

export default function UploadClient({
  sessionId,
  phoneLabels,
  phoneNames,
  initialPhotos,
}: Props) {
  const [uploading, setUploading] = useState<string | null>(null);
  const [completed, setCompleted] = useState<string[]>(
    initialPhotos.map((p) => p.phoneLabel),
  );
  const router = useRouter();

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    label: string,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(label);
    const formData = new FormData();
    formData.append("file", file);

    try {
      await uploadPhoto(sessionId, label, formData);
      setCompleted((prev) => [...prev, label]);
    } catch (err) {
      alert("Upload failed. Make sure the file is a JPEG or PNG.");
    } finally {
      setUploading(null);
    }
  };

  const allDone = completed.length >= phoneLabels.length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {phoneLabels.map((label) => {
          const isDone = completed.includes(label);
          const isCurrentUploading = uploading === label;
          const displayName = phoneNames[label] || `Phone ${label}`;

          return (
            <div
              key={label}
              className={`relative bg-white border-2 border-dashed rounded-3xl p-8 transition-all ${
                isDone
                  ? "border-green-500 bg-green-50/30"
                  : "border-gray-200 hover:border-blue-400"
              }`}
            >
              <div className="flex flex-col items-center text-center">
                <div
                  className={`p-4 rounded-2xl mb-4 ${isDone ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"}`}
                >
                  {isCurrentUploading ? (
                    <Loader2 className="animate-spin" size={32} />
                  ) : isDone ? (
                    <CheckCircle2 size={32} />
                  ) : (
                    <ImageIcon size={32} />
                  )}
                </div>

                <h3 className="text-xl font-bold text-gray-900 mb-1">
                  {displayName}
                </h3>
                <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-6">
                  Slot {label}
                </p>

                {!isDone && (
                  <label className="cursor-pointer bg-black text-white px-6 py-3 rounded-xl font-bold hover:bg-gray-800 transition-all flex items-center gap-2">
                    <Upload size={18} />
                    {isCurrentUploading ? "Uploading..." : "Select Photo"}
                    <input
                      type="file"
                      className="hidden"
                      accept="image/jpeg,image/png"
                      onChange={(e) => handleFileChange(e, label)}
                      disabled={!!uploading}
                    />
                  </label>
                )}

                {isDone && (
                  <span className="text-green-600 font-bold text-sm">
                    Ready for comparison
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-center pt-8">
        <button
          onClick={() => router.push(`/session/${sessionId}/compare`)}
          disabled={!allDone}
          className={`group flex items-center gap-3 px-10 py-4 rounded-2xl font-black text-lg transition-all ${
            allDone
              ? "bg-blue-600 text-white shadow-xl shadow-blue-200 hover:scale-105"
              : "bg-gray-200 text-gray-400 cursor-not-allowed"
          }`}
        >
          Start Comparing
          <ArrowRight
            size={22}
            className={
              allDone ? "group-hover:translate-x-2 transition-transform" : ""
            }
          />
        </button>
      </div>
    </div>
  );
}
