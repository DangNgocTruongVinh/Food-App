import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { createAppQueryClient } from "./api/query-client";
import { ConfirmProvider } from "./components/ui";
import { AuthProvider } from "./contexts/AuthContext";
import App from "./App";
import "./styles.css";
import { claimChunkReload, sessionStore } from "./features/ui/error-recovery.logic";

const queryClient = createAppQueryClient();

// File JS/CSS tải trước bị mất sau khi build lại (tên file đổi theo mã băm): tự tải lại trang một lần thay vì trang trắng.
window.addEventListener("vite:preloadError", (event) => {
  if (claimChunkReload((event as Event & { payload?: unknown }).payload, sessionStore())) {
    event.preventDefault();
    window.location.reload();
  }
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter><AuthProvider><ConfirmProvider><App /></ConfirmProvider></AuthProvider></BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
