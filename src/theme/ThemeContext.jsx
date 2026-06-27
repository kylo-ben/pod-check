import { createContext, useContext, useEffect, useState } from "react";
import { tokens } from "./tokens";

const STORAGE_KEY = "podcheck-theme";
const FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Zilla+Slab:wght@400;700&family=Noto+Sans:wght@400;500&family=Noto+Sans+Mono:wght@400&display=swap";

const ThemeContext = createContext(null);

function getInitialMode() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState(getInitialMode);

  useEffect(() => {
    if (document.querySelector(`link[href="${FONTS_HREF}"]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = FONTS_HREF;
    document.head.appendChild(link);
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);

  // Follow system preference only when user has no stored override
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e) => {
      if (!localStorage.getItem(STORAGE_KEY)) {
        setMode(e.matches ? "dark" : "light");
      }
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const toggleTheme = () => setMode(m => (m === "light" ? "dark" : "light"));

  return (
    <ThemeContext.Provider value={{ theme: tokens[mode], mode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
