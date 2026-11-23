"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="dark"
      position="top-center"
      closeButton
      toastOptions={{
        classNames: {
          toast: "!rounded-lg !border-border !bg-popover !text-foreground !shadow-xl !shadow-black/40",
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
