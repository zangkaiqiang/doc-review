import * as Toast from "@radix-ui/react-toast";
import { createContext, useContext, useState, type ReactNode } from "react";

type ToastItem = { id: number; title: string; tone: "default" | "error" };
type ToastApi = { toast: (title: string, tone?: "default" | "error") => void };

const Ctx = createContext<ToastApi>({ toast: () => {} });
export const useToast = () => useContext(Ctx);

let _id = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const toast = (title: string, tone: "default" | "error" = "default") => {
    const id = ++_id;
    setItems((prev) => [...prev, { id, title, tone }]);
  };
  const remove = (id: number) => setItems((prev) => prev.filter((t) => t.id !== id));

  return (
    <Ctx.Provider value={{ toast }}>
      <Toast.Provider swipeDirection="right" duration={2600}>
        {children}
        {items.map((t) => (
          <Toast.Root
            key={t.id}
            onOpenChange={(open) => !open && remove(t.id)}
            className="rounded-control border border-line bg-surface px-4 py-3 text-sm shadow-pop data-[state=open]:animate-in"
          >
            <Toast.Title className={t.tone === "error" ? "text-high" : "text-ink"}>{t.title}</Toast.Title>
          </Toast.Root>
        ))}
        <Toast.Viewport className="fixed bottom-4 right-4 z-50 flex w-80 flex-col gap-2 outline-none" />
      </Toast.Provider>
    </Ctx.Provider>
  );
}
