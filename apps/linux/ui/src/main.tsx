import { CSPProvider } from "@base-ui/react/csp-provider";
import { DirectionProvider } from "@base-ui/react/direction-provider";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { router, queryClient } from "./app/router";
import { Toaster } from "./components/ui/toast";
import { TooltipProvider } from "./components/ui/tooltip";

import "./styles/tailwind.css";

const root = document.getElementById("root");
if (!root) throw new Error("Application root is missing");
createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <CSPProvider disableStyleElements>
        <DirectionProvider direction="rtl">
          <TooltipProvider>
            <Toaster timeout={4500}>
              <RouterProvider router={router} />
            </Toaster>
          </TooltipProvider>
        </DirectionProvider>
      </CSPProvider>
    </QueryClientProvider>
  </StrictMode>,
);
