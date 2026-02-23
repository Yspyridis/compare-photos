"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSession } from "./actions";
import { Smartphone, ArrowRight, Loader2 } from "lucide-react";

export default function HomePage() {
  const [title, setTitle] = useState("");
  const [phoneCount, setPhoneCount] = useState(2);
  const [phoneNames, setPhoneNames] = useState<{ [key: string]: string }>({
    A: "iPhone 13 mini",
    B: "Galaxy S25",
    C: "",
  });
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const phones = phoneCount === 2 ? ["A", "B"] : ["A", "B", "C"];

      // Construct the mapping from your inputs
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

  const handleNameChange = (label: string, value: string) => {
    setPhoneNames((prev) => ({ ...prev, [label]: value }));
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#f8f9fa] p-4 font-sans">
      <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-md w-full border border-gray-100">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-blue-600 p-3 rounded-2xl mb-4 shadow-lg shadow-blue-200">
            <Smartphone className="text-white" size={32} />
          </div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">
            Blind compare
          </h1>
          <p className="text-gray-500 mt-2 text-center text-sm">
            Set up a blind camera test
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Session Title */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">
              Test name
            </label>
            <input
              required
              type="text"
              placeholder="e.g. Night Mode Comparison"
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Phone Count Toggle */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">
              Devices to compare
            </label>
            <div className="flex gap-2">
              {[2, 3].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setPhoneCount(num)}
                  className={`flex-1 py-3 rounded-xl border-2 font-bold transition-all ${
                    phoneCount === num
                      ? "bg-blue-600 text-white border-blue-600 shadow-md"
                      : "bg-white text-gray-400 border-gray-100 hover:border-gray-200"
                  }`}
                >
                  {num} Phones
                </button>
              ))}
            </div>
          </div>

          {/* Dynamic Phone Name Inputs */}
          <div className="space-y-4 pt-2">
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 ml-1">
              Identify devices
            </label>
            {(phoneCount === 2 ? ["A", "B"] : ["A", "B", "C"]).map((label) => (
              <div key={label} className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 font-bold group-focus-within:text-blue-500 transition-colors">
                  {label}
                </div>
                <input
                  required
                  type="text"
                  placeholder={`Name for Phone ${label}`}
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all"
                  value={phoneNames[label]}
                  onChange={(e) => handleNameChange(label, e.target.value)}
                />
              </div>
            ))}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full group bg-black text-white py-4 rounded-2xl font-bold hover:bg-gray-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <>
                Create session
                <ArrowRight
                  size={18}
                  className="group-hover:translate-x-1 transition-transform"
                />
              </>
            )}
          </button>
        </form>
      </div>
    </main>
  );
}
