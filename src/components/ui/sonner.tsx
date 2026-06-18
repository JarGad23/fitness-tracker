"use client";

import { Toaster as Sonner } from "sonner";

function Toaster(props: React.ComponentProps<typeof Sonner>) {
  return (
    <Sonner
      richColors
      closeButton
      position="top-center"
      toastOptions={{ classNames: { toast: "rounded-xl" } }}
      {...props}
    />
  );
}

export { Toaster };
