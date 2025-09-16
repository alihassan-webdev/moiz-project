"use client";

import { useEffect, useRef, useCallback, useTransition } from "react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  ImageIcon,
  Figma,
  MonitorIcon,
  Paperclip,
  SendIcon,
  XIcon,
  LoaderIcon,
  Sparkles,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import * as React from "react";
import { toast } from "@/hooks/use-toast";

type Props = {
  onSubmit: (args: {
    file: File | null;
    query: string;
  }) => Promise<void> | void;
  loading?: boolean;
  result?: string | null;
  query?: string;
  onReset?: () => void;
};

const MAX_SIZE = 15 * 1024 * 1024; // 15MB

interface UseAutoResizeTextareaProps {
  minHeight: number;
  maxHeight?: number;
}

function useAutoResizeTextarea({
  minHeight,
  maxHeight,
}: UseAutoResizeTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(
    (reset?: boolean) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      if (reset) {
        textarea.style.height = `${minHeight}px`;
        return;
      }

      textarea.style.height = `${minHeight}px`;
      const newHeight = Math.max(
        minHeight,
        Math.min(textarea.scrollHeight, maxHeight ?? Number.POSITIVE_INFINITY),
      );

      textarea.style.height = `${newHeight}px`;
    },
    [minHeight, maxHeight],
  );

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = `${minHeight}px`;
    }
  }, [minHeight]);

  useEffect(() => {
    const handleResize = () => adjustHeight();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [adjustHeight]);

  return { textareaRef, adjustHeight };
}

interface CommandSuggestion {
  icon: React.ReactNode;
  label: string;
  description: string;
  prefix: string;
}

interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  containerClassName?: string;
  showRing?: boolean;
  typing?: boolean;
}

const InnerTextarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, containerClassName, showRing = true, typing = false, ...props }, ref) => {
    const [isFocused, setIsFocused] = React.useState(false);

    return (
      <div className={cn("relative", containerClassName)}>
        <textarea
          className={cn(
            "bg-background flex min-h-[80px] w-full rounded-md px-3 py-2 text-sm",
            "placeholder:text-gray-300 dark:placeholder:text-gray-500",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 focus:border-transparent",
            className,
          )}
          ref={ref}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...props}
        />

        {/* Blinking caret indicator when focused or typing (ChatGPT-style) */}
        {(isFocused || typing) && (
          <span
            aria-hidden
            className="absolute right-4 bottom-3 text-gray-300 dark:text-gray-300 text-sm animate-[blink_1s_steps(2,end)_infinite]"
          >
            |
          </span>
        )}

        {showRing && isFocused && (
          <motion.span
            className="ring-primary/30 pointer-events-none absolute inset-0 rounded-md ring-2 ring-offset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
        )}

        {props.onChange && (
          <div
            className="bg-primary absolute right-2 bottom-2 h-2 w-2 rounded-full opacity-0"
            style={{ animation: "none" }}
            id="textarea-ripple"
          />
        )}
      </div>
    );
  },
);
InnerTextarea.displayName = "Textarea";

export default function AnimatedAIChat({
  onSubmit,
  loading,
  result,
  query,
  onReset,
}: Props) {
  const [value, setValue] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [activeSuggestion, setActiveSuggestion] = useState<number>(-1);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [recentCommand, setRecentCommand] = useState<string | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const { textareaRef, adjustHeight } = useAutoResizeTextarea({
    minHeight: 60,
    maxHeight: 200,
  });
  const [inputFocused, setInputFocused] = useState(false);
  const commandPaletteRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const commandSuggestions: CommandSuggestion[] = [
    {
      icon: <ImageIcon className="h-4 w-4" />,
      label: "Clone UI",
      description: "Generate a UI from a screenshot",
      prefix: "/clone",
    },
    {
      icon: <Figma className="h-4 w-4" />,
      label: "Import Figma",
      description: "Import a design from Figma",
      prefix: "/figma",
    },
    {
      icon: <MonitorIcon className="h-4 w-4" />,
      label: "Create Page",
      description: "Generate a new web page",
      prefix: "/page",
    },
    {
      icon: <Sparkles className="h-4 w-4" />,
      label: "Improve",
      description: "Improve existing UI design",
      prefix: "/improve",
    },
  ];

  useEffect(() => {
    setShowCommandPalette(false);
  }, [value]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) =>
      setMousePosition({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const commandButton = document.querySelector("[data-command-button]");
      if (
        commandPaletteRef.current &&
        !commandPaletteRef.current.contains(target) &&
        !(commandButton as Element | null)?.contains(target)
      ) {
        setShowCommandPalette(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showCommandPalette) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveSuggestion((prev) =>
          prev < commandSuggestions.length - 1 ? prev + 1 : 0,
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveSuggestion((prev) =>
          prev > 0 ? prev - 1 : commandSuggestions.length - 1,
        );
      } else if (e.key === "Tab" || e.key === "Enter") {
        e.preventDefault();
        if (activeSuggestion >= 0) {
          const selectedCommand = commandSuggestions[activeSuggestion];
          setValue(selectedCommand.prefix + " ");
          setShowCommandPalette(false);
          setRecentCommand(selectedCommand.label);
          setTimeout(() => setRecentCommand(null), 3500);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        setShowCommandPalette(false);
      }
    } else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim()) handleSendMessage();
    }
  };

  const validateFile = (f: File) => {
    if (
      f.type !== "application/pdf" &&
      !f.name.toLowerCase().endsWith(".pdf")
    ) {
      toast({
        title: "Invalid file",
        description: "Only PDF files are supported.",
      });
      return false;
    }
    if (f.size > MAX_SIZE) {
      toast({
        title: "File too large",
        description: "Please upload a PDF up to 15MB.",
      });
      return false;
    }
    return true;
  };

  const handleAttachFile = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f && validateFile(f)) setFile(f);
  };

  const removeAttachment = () => setFile(null);

  const selectCommandSuggestion = (index: number) => {
    const selectedCommand = commandSuggestions[index];
    setValue(selectedCommand.prefix + " ");
    setShowCommandPalette(false);
    setRecentCommand(selectedCommand.label);
    setTimeout(() => setRecentCommand(null), 2000);
  };

  const handleSendMessage = async () => {
    const q = value.trim();
    if (!q) {
      toast({ title: "Missing query", description: "Write what to generate." });
      return;
    }
    if (!file) {
      toast({ title: "Missing PDF", description: "Attach a PDF to continue." });
      return;
    }
    try {
      setIsTyping(true);
      await onSubmit({ file, query: q });
    } finally {
      setIsTyping(false);
    }
  };

  const resetAll = () => {
    setValue("");
    setFile(null);
    adjustHeight(true);
    if (onReset) onReset();
  };

  return (
    <div className="flex w-full overflow-x-hidden">
      <div className="text-foreground relative flex w-full flex-col items-center justify-center overflow-hidden bg-transparent p-2 sm:p-4">
        <div className="relative mx-auto w-full max-w-5xl">
          <motion.div
            className="relative z-10 space-y-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            <motion.div className="border-border bg-card/80 relative rounded-2xl border shadow-2xl backdrop-blur-2xl">
              <AnimatePresence>
                {showCommandPalette && (
                  <motion.div
                    ref={commandPaletteRef}
                    className="border-border bg-background/90 absolute right-4 bottom-full left-4 z-50 mb-2 overflow-hidden rounded-lg border shadow-lg backdrop-blur-xl"
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    transition={{ duration: 0.15 }}
                  >
                    <div className="bg-background py-1">
                      {commandSuggestions.map((suggestion, index) => (
                        <motion.div
                          key={suggestion.prefix}
                          className={cn(
                            "flex cursor-pointer items-center gap-2 px-3 py-2 text-xs transition-colors",
                            activeSuggestion === index
                              ? "bg-primary/20 text-foreground"
                              : "text-muted-foreground hover:bg-primary/10",
                          )}
                          onClick={() => selectCommandSuggestion(index)}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: index * 0.03 }}
                        >
                          <div className="text-primary flex h-5 w-5 items-center justify-center">
                            {suggestion.icon}
                          </div>
                          <div className="font-medium">{suggestion.label}</div>
                          <div className="text-muted-foreground ml-1 text-xs">
                            {suggestion.prefix}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {(loading || !!result) && (
                <div className="px-4 pt-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold">Response</h3>
                      <p className="text-xs text-muted-foreground">
                        Results from your latest request
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label="Download"
                      disabled={!result || !!loading}
                      onClick={() => {
                        if (!result) return;
                        const blob = new Blob([result], {
                          type: "text/plain;charset=utf-8",
                        });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        const safeQuery =
                          (query || "")
                            .trim()
                            .slice(0, 50)
                            .replace(/[^a-z0-9_-]/gi, "_") || "questions";
                        const filename = `${safeQuery}_${new Date().toISOString().replace(/[:.]/g, "-")}.txt`;
                        a.download = filename;
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                        setTimeout(() => URL.revokeObjectURL(url), 1000);
                      }}
                      className={cn(
                        "inline-flex items-center justify-center rounded-md p-2",
                        "bg-secondary text-secondary-foreground hover:brightness-105 shadow-primary/10 shadow-lg",
                        (!result || loading) && "opacity-60",
                      )}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className="h-4 w-4"
                      >
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                      <span className="sr-only">Download</span>
                    </button>
                  </div>
                  <div className="mt-2 max-h-[420px] overflow-auto rounded-md bg-background p-3 text-sm scrollbar-yellow">
                    {loading && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <svg
                          className="h-4 w-4 animate-spin"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                            fill="none"
                            className="opacity-25"
                          />
                          <path
                            d="M22 12a10 10 0 0 1-10 10"
                            stroke="currentColor"
                            strokeWidth="4"
                            className="opacity-75"
                          />
                        </svg>
                        Generating...
                      </div>
                    )}
                    {!!result && !loading && (
                      <pre className="whitespace-pre-wrap break-words text-foreground">
                        {result}
                      </pre>
                    )}
                  </div>
                </div>
              )}

              <div className="p-4">
                <InnerTextarea
                  ref={textareaRef}
                  value={value}
                  onChange={(e) => {
                    setValue(e.target.value);
                    adjustHeight();
                  }}
                  onKeyDown={handleKeyDown}
                  onFocus={() => setInputFocused(true)}
                  onBlur={() => setInputFocused(false)}
                  placeholder="Generate question paper..."
                  containerClassName="w-full"
                  className={cn(
                    "w-full px-4 py-3",
                    "resize-none",
                    "bg-transparent",
                    "border-none",
                    "text-foreground text-sm",
                    "focus:outline-none",
                    "placeholder:text-muted-foreground",
                    "min-h-[60px]",
                  )}
                  style={{ overflow: "hidden" }}
                  showRing={false}
                />
              </div>

              <AnimatePresence>
                {file && (
                  <motion.div
                    className="flex flex-wrap gap-2 px-4 pb-3"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    <motion.div
                      className="bg-primary/5 text-muted-foreground flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                    >
                      <span>{file.name}</span>
                      <button
                        onClick={() => removeAttachment()}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <XIcon className="h-3 w-3" />
                      </button>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="border-border flex items-center justify-between gap-4 border-t p-4">
                <div className="flex items-center gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <motion.button
                    type="button"
                    onClick={handleAttachFile}
                    whileTap={{ scale: 0.94 }}
                    className="group text-secondary relative rounded-lg p-2 transition-colors"
                  >
                    <Paperclip className="h-4 w-4 text-secondary" />
                    <motion.span
                      className="bg-primary/10 absolute inset-0 rounded-lg opacity-0 transition-opacity group-hover:opacity-100"
                      layoutId="button-highlight"
                    />
                  </motion.button>
                </div>

                <div className="flex items-center gap-2">
                  <motion.button
                    type="button"
                    onClick={resetAll}
                    whileTap={{ scale: 0.98 }}
                    className={cn(
                      "rounded-lg px-3 py-2 text-sm transition-all",
                      "bg-muted/40 text-muted-foreground hover:bg-muted/60",
                    )}
                  >
                    Reset
                  </motion.button>
                  <motion.button
                    type="button"
                    onClick={handleSendMessage}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    disabled={loading || isTyping || !value.trim()}
                    className={cn(
                      "rounded-lg px-4 py-2 text-sm font-medium transition-all",
                      "flex items-center gap-2",
                      "bg-secondary text-secondary-foreground shadow-primary/10 shadow-lg",
                      (loading || isTyping) && "opacity-80",
                      "disabled:opacity-60",
                    )}
                  >
                    {loading || isTyping ? (
                      <LoaderIcon className="h-4 w-4 animate-[spin_2s_linear_infinite]" />
                    ) : (
                      <SendIcon className="h-4 w-4" />
                    )}
                    <span>
                      {loading || isTyping ? "Generating..." : "Send"}
                    </span>
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>

        {inputFocused && (
          <motion.div
            className="from-primary via-primary/80 to-secondary pointer-events-none fixed z-0 h-[40rem] w-[40rem] rounded-full bg-gradient-to-r opacity-[0.03] blur-[96px]"
            animate={{ x: mousePosition.x - 400, y: mousePosition.y - 400 }}
            transition={{
              type: "spring",
              damping: 25,
              stiffness: 150,
              mass: 0.5,
            }}
          />
        )}
      </div>
    </div>
  );
}
