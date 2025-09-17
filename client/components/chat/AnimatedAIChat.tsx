"use client";

import { useEffect, useRef, useCallback, useTransition } from "react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  ImageIcon,
  Figma,
  MonitorIcon,
  SendIcon,
  XIcon,
  LoaderIcon,
  Sparkles,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import * as React from "react";
import { toast } from "@/hooks/use-toast";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

type Props = {
  onSubmit: (args: {
    file: File | null;
    query: string;
  }) => Promise<void> | void;
  loading?: boolean;
  result?: string | null;
  query?: string;
  onReset?: () => void;
  externalFile?: File | null;
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
  (
    {
      className,
      containerClassName,
      showRing = true,
      typing = false,
      ...props
    },
    ref,
  ) => {
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

function escapeHtml(str: string) {
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function formatResponse(raw: string) {
  // Remove attachment blocks and helper notes (user-uploaded attachment URLs)
  let cleaned = raw || "";
  // Remove any <attachment>...</attachment> blocks
  cleaned = cleaned.replace(/<attachment[\s\S]*?<\/attachment>/gi, "");
  // Remove lines that mention attachment URLs or instructions about attachments
  cleaned = cleaned
    .split("\n")
    .filter(
      (ln) =>
        !/(here are the urls of the attachments|only use these if|attachments the user is working on|cdn\.builder\.io)/i.test(
          ln.trim(),
        ),
    )
    .join("\n");

  // Escape HTML first
  let s = escapeHtml(cleaned);

  // Convert markdown headings (#, ##, ###) at line starts with spacing
  s = s.replace(
    /^###\s*(.+)$/gim,
    '<h3 class="font-semibold text-lg mt-6 mb-2">$1</h3>',
  );
  s = s.replace(
    /^##\s*(.+)$/gim,
    '<h2 class="font-semibold text-xl mt-6 mb-3">$1</h2>',
  );
  s = s.replace(
    /^#\s*(.+)$/gim,
    '<h1 class="font-semibold text-2xl md:text-3xl mt-6 mb-3">$1</h1>',
  );

  // Bold **text** -> strong
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold">$1</strong>');

  // Convert unordered list items (- or *) to <li class="mb-2">
  s = s.replace(/^(?:[-*])\s+(.+)$/gim, '<li class="mb-2">$1</li>');

  // Wrap consecutive <li> into <ul class="list-disc pl-6 mb-4">
  s = s.replace(/(?:\s*<li class="mb-2">.*?<\/li>\s*)+/gms, (match) => {
    const items = match.match(/<li class="mb-2">.*?<\/li>/gms) || [];
    return `<ul class="list-disc pl-6 mb-4">${items.join("")}</ul>`;
  });

  // Normalize paragraphs: split by two or more newlines
  const parts = s
    .split(/\n{2,}/g)
    .map((p) => p.trim())
    .filter(Boolean);
  s = parts
    .map((part) => {
      // If part already starts with a block tag (h1/h2/h3/ul), keep it
      if (/^<(h1|h2|h3|ul)/i.test(part)) return part;
      // Replace remaining single newlines with <br>
      const withBreaks = part.replace(/\n/g, "<br />");
      return `<p class="mb-4 text-base md:text-lg leading-relaxed">${withBreaks}</p>`;
    })
    .join("");

  return s;
}

export default function AnimatedAIChat({
  onSubmit,
  loading,
  result,
  query,
  onReset,
  externalFile,
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
  const [selectedPdfPath, setSelectedPdfPath] = useState<string>("");
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [selectedSubject, setSelectedSubject] = useState<string>("");
  const [totalMarks, setTotalMarks] = useState<number | null>(null);

  // If parent passes an external file, sync it into the internal attachment state
  useEffect(() => {
    if (externalFile) {
      setFile(externalFile);
      // keep selectedPdfPath empty when external file is provided from parent
      setSelectedPdfPath("");
    }
    // if externalFile becomes null, clear internal file
    if (!externalFile) {
      setFile((prev) => prev ?? null);
    }
    // intentionally only run when externalFile changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalFile]);

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

  const datafileEntries = React.useMemo(() => {
    const modules = import.meta.glob("/datafiles/**/*.pdf", {
      as: "url",
      eager: true,
    }) as Record<string, string>;
    return Object.entries(modules)
      .map(([path, url]) => {
        const rel = path.replace(/^\/?datafiles\//, "");
        const parts = rel.split("/");
        const cls = parts[0] || "Other";
        const subject = parts[1] || "General";
        return {
          path,
          url,
          name: path.split("/").pop() || "file.pdf",
          cls,
          subject,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  const classOptions = React.useMemo(
    () => Array.from(new Set(datafileEntries.map((e) => e.cls))).sort(),
    [datafileEntries],
  );
  const subjectOptions = React.useMemo(
    () =>
      selectedClass
        ? Array.from(
            new Set(
              datafileEntries
                .filter((e) => e.cls === selectedClass)
                .map((e) => e.subject),
            ),
          ).sort()
        : [],
    [datafileEntries, selectedClass],
  );
  const chapterOptions = React.useMemo(
    () =>
      selectedClass && selectedSubject
        ? datafileEntries
            .filter((e) => e.cls === selectedClass && e.subject === selectedSubject)
            .sort((a, b) => a.name.localeCompare(b.name))
        : [],
    [datafileEntries, selectedClass, selectedSubject],
  );

  const handleSelectPdf = async (path: string) => {
    try {
      const found = datafileEntries.find((p) => p.path === path);
      if (!found) {
        toast({ title: "Not found", description: "Selected PDF is missing." });
        return;
      }
      const res = await fetch(found.url);
      const blob = await res.blob();
      if (blob.size > MAX_SIZE) {
        toast({
          title: "File too large",
          description: "Please select a PDF up to 15MB.",
        });
        return;
      }
      const f = new File([blob], found.name, { type: "application/pdf" });
      setFile(f);
      setSelectedPdfPath(path);
    } catch (e) {
      toast({
        title: "Load failed",
        description: "Could not load the selected PDF.",
      });
    }
  };

  const removeAttachment = () => {
    setFile(null);
    setSelectedPdfPath("");
  };

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
    setSelectedPdfPath("");
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
                      onClick={async () => {
                        if (!result) return;
                        // Generate a professional PDF using jsPDF
                        try {
                          const { jsPDF } = await import("jspdf");
                          const doc = new jsPDF({ unit: "pt", format: "a4" });
                          const margin = 72;
                          let y = margin;
                          const pageWidth = doc.internal.pageSize.getWidth();

                          function makeFilenameFromPrompt(
                            q: string | undefined,
                          ) {
                            const raw = (q || "").trim();
                            if (!raw) return "questions";
                            // Remove common action verbs from the start
                            const verbs = [
                              "make",
                              "generate",
                              "produce",
                              "create",
                              "give",
                              "write",
                              "provide",
                              "please",
                              "build",
                              "compose",
                              "form",
                              "make/",
                              "make:",
                              "make-",
                              "make ",
                              "generate:",
                              "generate ",
                              "create:",
                            ];
                            let s = raw;
                            // remove any leading verbs/please words
                            let changed = true;
                            while (changed) {
                              changed = false;
                              for (const v of verbs) {
                                const re = new RegExp("^" + v + "\\s+", "i");
                                if (re.test(s)) {
                                  s = s.replace(re, "").trim();
                                  changed = true;
                                }
                              }
                            }
                            // If user included quotes around the request like: "make 5 mcqs", remove leading/trailing quotes
                            s = s.replace(/^['\"]+|['\"]+$/g, "").trim();
                            // Limit length and sanitize
                            let out = s.slice(0, 60).toLowerCase();
                            out = out.replace(/[^a-z0-9\s_-]/g, "");
                            out = out.trim().replace(/\s+/g, "_");
                            if (!out) return "questions";
                            return out;
                          }

                          const safeQuery = makeFilenameFromPrompt(query);
                          const filename = `${safeQuery}_${new Date().toISOString().replace(/[:.]/g, "-")}.pdf`;

                          // First page heading: Test Paper Generator
                          doc.setFont("times", "bold");
                          doc.setFontSize(18);
                          doc.text("Test Paper Generater", pageWidth / 2, y, {
                            align: "center",
                          });
                          y += 30;

                          // Build a concise summary line instead of echoing the prompt
                          const promptText = (query || "").trim();
                          // Try to extract counts from prompt or result
                          let mcqCount: number | null = null;
                          let fillCount: number | null = null;
                          const mcqMatch =
                            promptText.match(
                              /(\d+)\s*(?:multiple[- ]choice|mcq)s?/i,
                            ) ||
                            (result || "").match(
                              /(\d+)\s*(?:multiple[- ]choice|mcq)s?/i,
                            );
                          const fillMatch =
                            promptText.match(
                              /(\d+)\s*(?:fill[- ]in|fill-in|fill in|blank)s?/i,
                            ) ||
                            (result || "").match(
                              /(\d+)\s*(?:fill[- ]in|fill-in|fill in|blank)s?/i,
                            );
                          if (mcqMatch) mcqCount = Number(mcqMatch[1]);
                          if (fillMatch) fillCount = Number(fillMatch[1]);

                          let summaryLine = "";
                          if (mcqCount !== null && fillCount !== null) {
                            summaryLine = `Here are ${mcqCount} multiple-choice questions (MCQs) and ${fillCount} fill-in-the-blank questions based on the provided PDF content:`;
                          } else if (mcqCount !== null) {
                            summaryLine = `Here are ${mcqCount} multiple-choice questions (MCQs) based on the provided PDF content:`;
                          } else if (fillCount !== null) {
                            summaryLine = `Here are ${fillCount} fill-in-the-blank questions based on the provided PDF content:`;
                          } else {
                            summaryLine = `Here are the questions based on the provided PDF content:`;
                          }

                          doc.setFontSize(12);
                          doc.setFont("times", "normal");
                          const summaryLines = doc.splitTextToSize(
                            summaryLine,
                            pageWidth - margin * 2,
                          );
                          doc.text(summaryLines, margin, y);
                          y += summaryLines.length * 18 + 10;

                          doc.setDrawColor(200);
                          doc.setLineWidth(0.5);
                          doc.line(margin, y, pageWidth - margin, y);
                          y += 16;

                          // Content: parse markdown-like headings and paragraphs (skip echoing the prompt if present)
                          const rawLines = (result || "").split(/\n/);
                          // If the first few lines of result echo the prompt, remove them
                          let startIndex = 0;
                          if (rawLines.length > 0 && promptText) {
                            const firstLine = rawLines[0].trim().toLowerCase();
                            if (firstLine.includes(promptText.toLowerCase())) {
                              startIndex = 1;
                            }
                            // Also remove an immediately following empty line if present
                            if (
                              rawLines[startIndex] &&
                              rawLines[startIndex].trim() === ""
                            )
                              startIndex++;
                          }
                          let lines = rawLines
                            .slice(startIndex)
                            .filter(
                              (l) =>
                                !/(<attachment\b|<\/attachment>|Here are the urls of the attachments|Only use these if|cdn\.builder\.io)/i.test(
                                  l,
                                ),
                            );

                          // Remove leading summary/echo lines like "Here are 5 MCQs..." to avoid duplication
                          const normalize = (s: string) =>
                            s
                              .toLowerCase()
                              .replace(/["'\-:,()\.]/g, " ")
                              .replace(/[^a-z0-9\s]/g, " ")
                              .replace(/\s+/g, " ")
                              .trim();

                          const summaryNormalized = normalize(
                            summaryLine || "",
                          );

                          while (lines.length) {
                            const first = lines[0].trim();
                            const norm = normalize(first);
                            // Remove if it exactly matches the generated summary, or if it's a short variant starting with "here are" mentioning mcq/fill
                            if (
                              norm === summaryNormalized ||
                              (/^here are\b/.test(norm) &&
                                /(mcq|multiple|fill|fill in|fillintheblank|fillintheblanks|fill-in)/.test(
                                  norm,
                                ))
                            ) {
                              lines.shift();
                              // also drop immediate blank lines
                              if (lines[0] && lines[0].trim() === "")
                                lines.shift();
                              continue;
                            }
                            break;
                          }

                          for (let i = 0; i < lines.length; i++) {
                            const line = lines[i].trim();
                            if (!line) {
                              y += 8;
                              continue;
                            }
                            // heading
                            if (/^#{1}\s+/.test(line)) {
                              doc.setFontSize(16);
                              doc.setFont("times", "bold");
                              const text = line.replace(/^#{1}\s+/, "");
                              const split = doc.splitTextToSize(
                                text,
                                pageWidth - margin * 2,
                              );
                              if (
                                y + split.length * 18 >
                                doc.internal.pageSize.getHeight() - margin
                              ) {
                                doc.addPage();
                                y = margin;
                              }
                              doc.text(split, margin, y);
                              y += split.length * 14 + 8;
                            } else if (/^#{2,}/.test(line)) {
                              doc.setFontSize(14);
                              doc.setFont("times", "bold");
                              const text = line.replace(/^#{1,}\s+/, "");
                              const split = doc.splitTextToSize(
                                text,
                                pageWidth - margin * 2,
                              );
                              if (
                                y + split.length * 18 >
                                doc.internal.pageSize.getHeight() - margin
                              ) {
                                doc.addPage();
                                y = margin;
                              }
                              doc.text(split, margin, y);
                              y += split.length * 14 + 6;
                            } else {
                              // normal paragraph, handle **bold**
                              doc.setFontSize(12);
                              doc.setFont("times", "normal");
                              // Replace **bold** with uppercase as simple emphasis in PDF
                              const parts = line.split(/(\*\*.+?\*\*)/g);
                              let cursorX = margin;
                              let maxHeight = 0;
                              for (const part of parts) {
                                if (!part) continue;
                                if (/^\*\*(.+)\*\$/.test(part)) {
                                  // fallback (shouldn't happen)
                                }
                                if (/^\*\*(.+)\*\*/.test(part)) {
                                  const boldText = part.replace(
                                    /^\*\*(.+)\*\*/,
                                    "$1",
                                  );
                                  doc.setFont("times", "bold");
                                  const split = doc.splitTextToSize(
                                    boldText,
                                    pageWidth - margin * 2,
                                  );
                                  // If wrap, just print as normal (simplify)
                                  if (
                                    y + split.length * 18 >
                                    doc.internal.pageSize.getHeight() - margin
                                  ) {
                                    doc.addPage();
                                    y = margin;
                                  }
                                  doc.text(split, margin, y);
                                  y += split.length * 18;
                                  doc.setFont("times", "normal");
                                } else {
                                  const split = doc.splitTextToSize(
                                    part,
                                    pageWidth - margin * 2,
                                  );
                                  if (
                                    y + split.length * 18 >
                                    doc.internal.pageSize.getHeight() - margin
                                  ) {
                                    doc.addPage();
                                    y = margin;
                                  }
                                  doc.text(split, margin, y);
                                  y += split.length * 18;
                                }
                              }
                              y += 8;
                            }

                            // page break if near bottom
                            if (y > doc.internal.pageSize.getHeight() - margin) {
                              doc.addPage();
                              y = margin;
                            }
                          }

                          // Watermark and centered page numbers on each page
                          const pageCount = doc.getNumberOfPages();
                          for (let i = 1; i <= pageCount; i++) {
                            doc.setPage(i);
                            const pageW = doc.internal.pageSize.getWidth();
                            const pageH = doc.internal.pageSize.getHeight();
                            // Watermark
                            doc.setFont("times", "bold");
                            doc.setFontSize(64);
                            doc.setTextColor(210);
                            doc.text("Test Paper Generater", pageW / 2, pageH / 2, { align: "center", angle: 45 });
                            // Footer page numbers
                            doc.setFont("times", "normal");
                            doc.setFontSize(10);
                            doc.setTextColor(150);
                            const footerY = pageH - 30;
                            doc.text(`Page ${i} of ${pageCount}`, pageW / 2, footerY, { align: "center" });
                            doc.setTextColor(0);
                          }

                          doc.save(filename);
                        } catch (err) {
                          console.error("PDF generation failed", err);
                          toast({
                            title: "Download failed",
                            description: "Could not generate PDF.",
                          });
                        }
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
                      <div
                        className="whitespace-pre-wrap break-words text-foreground text-base md:text-lg leading-7 font-sans"
                        dangerouslySetInnerHTML={{
                          __html: formatResponse(result ?? ""),
                        }}
                      />
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
                  typing={isTyping}
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
                <div className="flex items-center gap-3 flex-wrap">
                  <Select value={selectedClass} onValueChange={(v) => {
                    setSelectedClass(v);
                    setSelectedSubject("");
                    setSelectedPdfPath("");
                    setFile(null);
                  }}>
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="Class" />
                    </SelectTrigger>
                    <SelectContent>
                      {classOptions.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={selectedSubject} onValueChange={(v) => {
                    setSelectedSubject(v);
                    setSelectedPdfPath("");
                    setFile(null);
                  }}>
                    <SelectTrigger className="w-[180px]" disabled={!selectedClass}>
                      <SelectValue placeholder="Subject" />
                    </SelectTrigger>
                    <SelectContent>
                      {subjectOptions.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={selectedPdfPath} onValueChange={handleSelectPdf}>
                    <SelectTrigger className="w-[220px]" disabled={!selectedSubject}>
                      <SelectValue placeholder="Chapter (PDF)" />
                    </SelectTrigger>
                    <SelectContent>
                      {chapterOptions.map((opt) => (
                        <SelectItem key={opt.path} value={opt.path}>
                          {opt.name.replace(/\.pdf$/i, "")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <input
                    type="number"
                    min={20}
                    max={100}
                    value={totalMarks ?? ""}
                    onChange={(e) => {
                      const v = e.currentTarget.value;
                      const n = v === "" ? null : Number(v);
                      setTotalMarks(n);
                    }}
                    className="w-24 rounded-md border border-input bg-muted/40 px-2 py-2 text-sm"
                    placeholder="Marks"
                  />
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
                    onClick={async () => {
                      if (!selectedClass)
                        return toast({ title: "Select class", description: "Choose a class" });
                      if (!selectedSubject)
                        return toast({ title: "Select subject", description: "Choose a subject" });
                      if (!selectedPdfPath)
                        return toast({ title: "Select chapter", description: "Choose a chapter PDF" });
                      if (!file)
                        return toast({ title: "Missing PDF", description: "Attach a PDF to continue." });
                      const marks = Math.min(100, Math.max(20, Number(totalMarks ?? 0)));
                      if (!totalMarks || marks < 20)
                        return toast({ title: "Enter marks", description: "Enter 20–100" });
                      const prompt = `Generate a complete exam-style question paper for Class ${selectedClass} in the subject "${selectedSubject}" of total ${marks} marks.\n\nStructure requirements:\n1) Section A - MCQs: allocate between 10% and 20% of total marks to MCQs. Each MCQ should be 1 mark and include four options labeled a), b), c), d). Number all MCQs sequentially (Q1, Q2, ...).\n2) Section B - Short Questions: allocate between 30% and 40% of total marks. Each short question should be 4 or 5 marks. Number questions sequentially continuing from MCQs.\n3) Section C - Long Questions: allocate between 30% and 40% of total marks. Each long question should be 8 to 10 marks. Number questions sequentially continuing from Section B.\n\nContent and formatting instructions:\n- Provide actual question text for every item (do NOT output only a scheme).\n- For MCQs include clear options (a/b/c/d) and ensure only one correct option logically exists (do NOT reveal answers).\n- Short and long questions should be clear, exam-style (descriptive, conceptual or numerical as appropriate), and require the indicated length of answer.\n- Use headings exactly: "Section A - MCQs", "Section B - Short Questions", "Section C - Long Questions".\n- Use numbering like Q1, Q2, Q3 ... across the paper.\n- Ensure the marks per question and number of questions sum exactly to the total ${marks} marks.`;
                      try {
                        setIsTyping(true);
                        await onSubmit({ file, query: prompt });
                      } finally {
                        setIsTyping(false);
                      }
                    }}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    disabled={loading || isTyping}
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
                      {loading || isTyping ? "Generating..." : "Generate"}
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
