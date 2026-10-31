import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { createAppQueryClient } from "./api/query-client";
import { ConfirmProvider } from "./components/ui";
import { AuthProvider } from "./contexts/AuthContext";
import App from "./App";
import "./styles.css";

const queryClient = createAppQueryClient();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter><AuthProvider><ConfirmProvider><App /></ConfirmProvider></AuthProvider></BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
