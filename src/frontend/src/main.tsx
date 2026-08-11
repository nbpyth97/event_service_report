import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "@/App";
import { CurrentUserProvider } from "@/auth/user";
import { ToastProvider, notifyError } from "@/lib/toast";
import "@/styles.css";

const onError = (error: unknown) => {
  notifyError(error instanceof Error ? error.message : "Algo deu errado. Tente novamente.");
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, refetchOnWindowFocus: true },
  },
  queryCache: new QueryCache({ onError }),
  mutationCache: new MutationCache({ onError }),
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ToastProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <CurrentUserProvider>
            <App />
          </CurrentUserProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ToastProvider>
  </React.StrictMode>
);
