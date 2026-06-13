"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { fetchApi, resolveImageUrl } from "@/lib/api";
import { useVisitorLocale } from "@/components/VisitorLocaleProvider";

type Item = {
  id: number;
  name: string;
  description: string;
  main_image_url: string | null;
};

export default function ManualSelectionPage() {
  const router = useRouter();
  const { t } = useVisitorLocale();
  const [allItems, setAllItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchApi("/api/objects/all")
      .then((res) => {
        setAllItems(res.items);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load items", err);
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className="bg-white p-4 border-b flex items-center gap-4 sticky top-0 z-10 shadow-sm">
        <button 
          onClick={() => router.push("/method")} 
          aria-label={t.common.back}
          className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold"
        >
          &larr;
        </button>
        <h1 className="font-bold text-xl text-slate-800">{t.manual.title}</h1>
      </div>
      
      <div className="p-4 flex-1">
        {loading ? (
          <div className="flex justify-center items-center h-40">
            <div className="w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {allItems.map(item => {
              const imageUrl = resolveImageUrl(item.main_image_url);
              return (
                <button 
                  key={item.id} 
                  onClick={() => router.push(`/item/${item.id}`)}
                  className="bg-white p-3 rounded-2xl shadow-sm border border-slate-200 text-left active:scale-95 transition-transform"
                >
                  <div className="aspect-square bg-slate-200 rounded-xl mb-3 overflow-hidden">
                    {imageUrl ? (
                      <img src={imageUrl} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400">{t.common.noImage}</div>
                    )}
                  </div>
                  <h4 className="font-bold text-sm line-clamp-2 text-slate-800">{item.name}</h4>
                </button>
              );
            })}
            {allItems.length === 0 && (
              <p className="col-span-2 text-center text-slate-500 py-10">{t.manual.empty}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
