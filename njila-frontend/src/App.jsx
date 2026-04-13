import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import AppRouter from "./router/AppRouter";
import { useEffect } from "react";
import { useThemeStore } from "./store/themeStore";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60 * 5, // 5 min
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  const { darkMode } = useThemeStore();

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [darkMode]);

  return (
    <QueryClientProvider client={queryClient}>
      <AppRouter />
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: "#0F172A",
            color: "#F8FAFC",
            borderRadius: "8px",
            fontSize: "14px",
          },
          success: { iconTheme: { primary: "#16A34A", secondary: "#F8FAFC" } },
          error:   { iconTheme: { primary: "#DC2626", secondary: "#F8FAFC" } },
        }}
      />
    </QueryClientProvider>
  );
}
