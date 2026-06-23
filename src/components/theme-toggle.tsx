import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("theme");
      if (saved === "dark" || saved === "light") return saved;
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return "light";
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  return (
    <div 
      className="flex items-center bg-muted/80 p-1 rounded-full border border-border/40 relative cursor-pointer select-none w-16 h-8 transition-all duration-300 hover:bg-muted/90"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
    >
      {/* Sliding background block */}
      <div 
        className={`absolute top-[2px] bottom-[2px] left-[2px] w-[26px] rounded-full bg-background border border-border/10 shadow-sm transition-transform duration-300 ease-out ${
          theme === "dark" ? "translate-x-[30px]" : "translate-x-0"
        }`}
      />
      
      {/* Sun icon */}
      <div className="flex-1 flex justify-center z-10 transition-colors duration-300">
        <Sun className={`h-3.5 w-3.5 transition-all duration-300 ${theme === "light" ? "text-amber-500 scale-110" : "text-muted-foreground/45"}`} />
      </div>
      
      {/* Moon icon */}
      <div className="flex-1 flex justify-center z-10 transition-colors duration-300">
        <Moon className={`h-3.5 w-3.5 transition-all duration-300 ${theme === "dark" ? "text-indigo-400 scale-110" : "text-muted-foreground/45"}`} />
      </div>
    </div>
  );
}
