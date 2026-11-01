
"use client";

import { useEffect, useRef, useState } from "react";
import {
  HeartPulse,
  Upload,
  FileText,
  MessageCircleQuestion,
  Languages,
  Sun,
  Moon,
  ShieldCheck,
  Sparkles,
  Clock3,
  Menu,
  Settings,
  LayoutDashboard,
  ClipboardList,
  FileCheck,
  Download,
  X,
} from "lucide-react";

function renderInlineFormatting(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={index} className="font-semibold text-slate-950 dark:text-white">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <span key={index}>{part}</span>
    ),
  );
}

function ExplanationContent({ content }: { content: string }) {
  const lines = content.replace(/\r/g, "").split("\n");
  const blocks: Array<{ type: "heading" | "paragraph" | "bullet"; text: string; number?: string }> = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const heading = line.match(/^#{1,4}\s*(\d{1,2})[.)]?\s*[-.:)]?\s*(.+)$/) ||
      line.match(/^(\d{1,2})[.)]\s+(.+)$/);
    if (heading) {
      blocks.push({ type: "heading", number: heading[1], text: heading[2].replace(/\*\*/g, "") });
      continue;
    }

    if (/^#{1,4}\s+/.test(line)) {
      blocks.push({ type: "heading", text: line.replace(/^#{1,4}\s+/, "").replace(/\*\*/g, "") });
      continue;
    }

    if (/^[-*•]\s+/.test(line)) {
      blocks.push({ type: "bullet", text: line.replace(/^[-*•]\s+/, "") });
      continue;
    }

    blocks.push({ type: "paragraph", text: line });
  }

  return (
    <div className="space-y-5">
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          return (
            <div key={index} className="flex items-start gap-3 border-b border-slate-200 pb-3 pt-2 first:pt-0 dark:border-slate-700">
              {block.number && (
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-100 text-sm font-bold text-violet-800 ring-1 ring-violet-200 dark:bg-violet-950 dark:text-violet-200 dark:ring-violet-800">
                  {block.number}
                </span>
              )}
              <h4 className="text-lg font-bold leading-7 text-violet-900 dark:text-violet-200 sm:text-xl">
                {renderInlineFormatting(block.text)}
              </h4>
            </div>
          );
        }

        if (block.type === "bullet") {
          return (
            <div key={index} className="flex gap-3 rounded-xl bg-white/80 px-4 py-3 ring-1 ring-slate-200 dark:bg-slate-900/70 dark:ring-slate-700">
              <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-teal-500" />
              <p className="text-[15px] leading-7 text-slate-700 dark:text-slate-200">
                {renderInlineFormatting(block.text)}
              </p>
            </div>
          );
        }

        return (
          <p key={index} className="text-[15px] leading-8 text-slate-700 dark:text-slate-200 sm:text-base">
            {renderInlineFormatting(block.text)}
          </p>
        );
      })}
    </div>
  );
}

type ParsedMedicalResult = {
  test: string;
  value: string;
  unit: string;
  referenceRange: string;
  status: "Low" | "Within listed range" | "High" | "Not assessed";
};

function parseMedicalResults(text: string): ParsedMedicalResult[] {
  // This parser intentionally prefers known medical measurements over arbitrary numbers.
  // It avoids treating age, dates, history years, and medication dosages as test results.
  const normalized = text
    .replace(/\u00a0/g, " ")
    .replace(/[‐‑‒–—]/g, "-")
    .replace(/[º˚]/g, "°");

  const results: ParsedMedicalResult[] = [];
  const seen = new Set<string>();

  const add = (
    test: string,
    value: string,
    unit: string,
    referenceRange = "Not provided",
  ) => {
    const cleanValue = value.trim();
    const key = `${test.toLowerCase()}|${cleanValue}|${unit.toLowerCase()}`;
    if (!cleanValue || seen.has(key)) return;
    seen.add(key);

    let status: ParsedMedicalResult["status"] = "Not assessed";
    const bounds = referenceRange.match(/^\s*([-+]?\d[\d,.]*)\s*-\s*([-+]?\d[\d,.]*)\s*$/);
    if (bounds) {
      const low = Number(bounds[1].replace(/,/g, ""));
      const high = Number(bounds[2].replace(/,/g, ""));
      const numericValue = Number(cleanValue.replace(/,/g, ""));
      if (Number.isFinite(low) && Number.isFinite(high) && Number.isFinite(numericValue)) {
        status = numericValue < low ? "Low" : numericValue > high ? "High" : "Within listed range";
      }
    }

    results.push({ test, value: cleanValue, unit: unit || "—", referenceRange, status });
  };

  // Handle vital-sign labels explicitly, including multiple measurements on one OCR line.
  // Never silently turn "366" into "36.6": suspicious values are left for human review.
  const vitalPatterns: Array<{
    label: string;
    regex: RegExp;
    unit: string;
    validate?: (n: number) => boolean;
  }> = [
    { label: "Blood pressure", regex: /\bblood\s*pressure\b\s*[:\-]?\s*(\d{2,3}\s*\/\s*\d{2,3}|\d{2,3})\s*(?:\/\s*mm\s*hg|mm\s*hg)?/i, unit: "mmHg" },
    { label: "Pulse", regex: /\bpulse\b\s*[:\-]?\s*(\d{2,3}(?:\.\d+)?)\s*(bpm|beats?\s*\/\s*min)?/i, unit: "bpm", validate: n => n >= 20 && n <= 250 },
    { label: "Temperature", regex: /\btemperature\b\s*[:\-]?\s*(\d{2,3}(?:[.,]\d+)?)\s*(°?\s*[cf])?/i, unit: "°C", validate: n => n >= 30 && n <= 45 },
    { label: "Respiratory rate", regex: /\brespiratory(?:\s+rate)?\b\s*[:\-]?\s*(\d{1,3}(?:\.\d+)?)\s*(\/\s*min|breaths?\s*\/\s*min)?/i, unit: "/min", validate: n => n >= 4 && n <= 80 },
    { label: "Oxygen saturation", regex: /\b(?:oxygen saturation|spo2|sp[o0]₂)\b\s*[:\-]?\s*(\d{2,3}(?:\.\d+)?)\s*%?/i, unit: "%" , validate: n => n >= 50 && n <= 100 },
  ];

  for (const lineRaw of normalized.split(/\r?\n/)) {
    const line = lineRaw.replace(/\s+/g, " ").trim();
    if (!line) continue;

    // Explicitly skip administrative, history, and treatment lines.
    if (/^(patient details|medical history|surgeries|allergies|doctor'?s observations|notes and next steps|name|dob|date of birth|age|gender|sex|hypertension|continuation of|lifestyle modifications|dr\.?)\b/i.test(line)) {
      continue;
    }

    for (const pattern of vitalPatterns) {
      const match = line.match(pattern.regex);
      if (!match) continue;

      const raw = match[1].replace(/\s+/g, "");
      const numeric = Number(raw.replace(",", "."));
      if (pattern.label === "Temperature" && pattern.validate && !pattern.validate(numeric)) {
        // Flagging happens in the UI via a review row; don't guess where the decimal belongs.
        add("Temperature (verify OCR)", raw, "Uncertain — check original");
      } else if (pattern.validate && !pattern.validate(numeric)) {
        add(`${pattern.label} (verify OCR)`, raw, "Uncertain — check original");
      } else {
        const unit = pattern.label === "Temperature" && match[2]
          ? match[2].replace(/\s+/g, "").replace(/^c$/i, "°C").replace(/^f$/i, "°F")
          : pattern.unit;
        add(pattern.label, raw, unit);
      }
    }
  }

  // Extract common laboratory results only when the line starts with a plausible test label.
  // This avoids treating dates, age, history years, and medication strengths as results.
  const knownTests = [
    "hemoglobin", "haemoglobin", "hb", "wbc", "white blood cell", "rbc",
    "red blood cell", "platelet", "glucose", "fasting blood sugar", "hba1c",
    "creatinine", "urea", "sodium", "potassium", "calcium", "bilirubin",
    "alt", "ast", "sgpt", "sgot", "cholesterol", "triglycerides", "tsh",
    "vitamin d", "vitamin b12", "hematocrit", "haematocrit", "mcv", "mch",
    "mchc", "neutrophils", "lymphocytes", "eosinophils",
  ];

  for (const lineRaw of normalized.split(/\r?\n/)) {
    const line = lineRaw.replace(/\s+/g, " ").trim();
    if (!line || line.length > 220) continue;
    if (/^(patient details|medical history|vitals|surgeries|allergies|doctor'?s observations|notes and next steps)\b/i.test(line)) continue;
    if (/\b(?:blood pressure|pulse|temperature|respiratory|oxygen saturation|spo2)\b/i.test(line)) continue;

    const testName = knownTests.find(name => new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(line));
    if (!testName) continue;

    const remainder = line.slice(testName.length).replace(/^[\s:|=-]+/, "");
    const valueMatch = remainder.match(/^([-+]?\d[\d,]*(?:[.,]\d+)?)/);
    if (!valueMatch) continue;

    const value = valueMatch[1].replace(",", "");
    const after = remainder.slice(valueMatch[0].length).trim();
    const rangeMatch = after.match(/(\d[\d,.]*)\s*-\s*(\d[\d,.]*)/);
    const range = rangeMatch ? `${rangeMatch[1]}-${rangeMatch[2]}` : "Not provided";
    const unit = after.replace(rangeMatch?.[0] ?? "", "").trim().slice(0, 35) || "—";
    add(testName.toUpperCase() === "HB" ? "Hemoglobin" : testName, value, unit, range);
  }

  return results.slice(0, 40);
}


export default function Home() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [language, setLanguage] = useState("English");

  const [fileName, setFileName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");
  const [fileError, setFileError] = useState("");
  const [extractedText, setExtractedText] = useState("");
  const [originalExtractedText, setOriginalExtractedText] = useState("");
  const hasTextEdits = extractedText !== originalExtractedText;
  const [extractionStatus, setExtractionStatus] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [isOcrRunning, setIsOcrRunning] = useState(false);
  const [isExplaining, setIsExplaining] = useState(false);
  const [explanation, setExplanation] = useState("");
  const [modelStatus, setModelStatus] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const savedTheme = localStorage.getItem("medlens-theme");
    if (savedTheme === "dark" || savedTheme === "light") {
      setTheme(savedTheme);
      document.documentElement.classList.toggle(
        "dark",
        savedTheme === "dark"
      );
    }
  }, []);

  useEffect(() => {
    if (!selectedFile || !selectedFile.type.startsWith("image/")) {
      setImagePreviewUrl("");
      return;
    }

    const objectUrl = URL.createObjectURL(selectedFile);
    setImagePreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [selectedFile]);

  function toggleTheme() {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    localStorage.setItem("medlens-theme", next);
  }


function handleFile(file?: File) {
  if (!file) return;

  const allowedTypes = [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
  ];

  const allowedExtensions = /\.(pdf|png|jpe?g|webp)$/i;

  if (
    !allowedTypes.includes(file.type) ||
    !allowedExtensions.test(file.name)
  ) {
    setFileError("Please select a valid PDF, JPG, PNG, or WebP file.");
    return;
  }

  if (file.size > 10 * 1024 * 1024) {
    setFileError("File size must be 10 MB or less.");
    return;
  }

  if (file.size === 0) {
    setFileError("This file is empty. Please select another file.");
    return;
  }

  setFileError("");
  setExtractedText("");
  setOriginalExtractedText("");
  setExtractionStatus("");
  setExplanation("");
  setModelStatus("");
  setSelectedFile(file);
  setFileName(file.name);
}

async function runOcrOnImage(file: File) {
  if (!file || !file.type.startsWith("image/")) {
    setFileError("Please select a JPG, PNG, or WebP image first.");
    return;
  }

  setIsOcrRunning(true);
  setFileError("");
  setExtractedText("");
  setOriginalExtractedText("");
  setExtractionStatus("Loading OCR engine...");

  let worker: Awaited<ReturnType<typeof import("tesseract.js").createWorker>> | null = null;
  try {
    const tesseract = await import("tesseract.js");
    worker = await tesseract.createWorker("eng");
    setExtractionStatus("Recognizing text in the image. This may take a little while...");

    // Tesseract.js accepts a File/Blob directly, so no image-to-canvas conversion is needed.
    const result = await worker.recognize(file);
    const text = result.data.text.trim();

    if (!text) {
      setExtractionStatus("OCR completed, but no readable text was found. Try a clearer, higher-resolution image.");
    } else {
      setExtractedText(text);
      setOriginalExtractedText(text);
      setExtractionStatus("OCR finished. Check all extracted values against the original report.");
    }
  } catch (error) {
    console.error("Image OCR failed:", error);
    const details = error instanceof Error ? error.message : String(error);
    setFileError(`Image OCR failed: ${details}. Check your internet connection and try again.`);
    setExtractionStatus("");
  } finally {
    if (worker) {
      try {
        await worker.terminate();
      } catch (terminateError) {
        console.warn("Could not stop OCR worker cleanly:", terminateError);
      }
    }
    setIsOcrRunning(false);
  }
}

async function runOcrOnPdf() {
  if (!selectedFile || selectedFile.type !== "application/pdf") return;
  setIsOcrRunning(true);
  setFileError("");
  setExtractedText("");
  setOriginalExtractedText("");
  let worker: Awaited<ReturnType<typeof import("tesseract.js").createWorker>> | null = null;

  try {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;
    const tesseract = await import("tesseract.js");
    worker = await tesseract.createWorker("eng");
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(await selectedFile.arrayBuffer()) }).promise;
    const pageTexts: string[] = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      setExtractionStatus(`Running OCR on PDF page ${pageNumber} of ${pdf.numPages}...`);
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1.6 });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Could not prepare PDF page for OCR.");
      await page.render({ canvasContext: context, canvas, viewport }).promise;
      const result = await worker.recognize(canvas);
      pageTexts.push(`Page ${pageNumber}\n${result.data.text.trim()}`);
      canvas.width = 0;
      canvas.height = 0;
    }

    const text = pageTexts.join("\n\n").trim();
    if (!text.replace(/Page \d+/g, "").trim()) {
      setExtractionStatus("OCR did not find readable text. Try a clearer report or a smaller PDF.");
    } else {
      setExtractedText(text);
      setOriginalExtractedText(text);
      setExtractionStatus(`OCR finished for ${pdf.numPages} page(s). Check all values against the original report.`);
    }
  } catch (error) {
    console.error("Scanned PDF OCR failed:", error);
    setFileError("OCR could not process this PDF. Check your internet connection and try again.");
    setExtractionStatus("");
  } finally {
    if (worker) await worker.terminate();
    setIsOcrRunning(false);
  }
}

async function extractPdfText() {
  if (!selectedFile || selectedFile.type !== "application/pdf") return;

  setIsExtracting(true);
  setFileError("");
  setExtractedText("");
  setOriginalExtractedText("");
  setExtractionStatus("Reading PDF pages...");

  try {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

    const data = new Uint8Array(await selectedFile.arrayBuffer());
    const pdf = await pdfjs.getDocument({ data }).promise;
    const pageTexts: string[] = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      setExtractionStatus(`Extracting text from page ${pageNumber} of ${pdf.numPages}...`);
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item) => ("str" in item ? item.str : ""))
        .filter(Boolean)
        .join(" ");
      pageTexts.push(`Page ${pageNumber}\n${pageText}`);
    }

    const text = pageTexts.join("\n\n").trim();
    if (!text) {
      setExtractionStatus("No selectable text was found. This may be a scanned PDF; OCR support is the next step.");
    } else {
      setExtractedText(text);
      setOriginalExtractedText(text);
      setExtractionStatus(`Text extracted from ${pdf.numPages} page(s). Please check the text for errors before using it.`);
    }
  } catch (error) {
    console.error("PDF text extraction failed:", error);
    setFileError("Could not read this PDF. Try another PDF or check the browser console for details.");
    setExtractionStatus("");
  } finally {
    setIsExtracting(false);
  }
}

useEffect(() => {
  function preventBrowserFileOpen(event: DragEvent) {
    event.preventDefault();
  }

  window.addEventListener("dragover", preventBrowserFileOpen);
  window.addEventListener("drop", preventBrowserFileOpen);

  return () => {
    window.removeEventListener("dragover", preventBrowserFileOpen);
    window.removeEventListener("drop", preventBrowserFileOpen);
  };
}, []);



  const navItems = [
    { label: "Dashboard", icon: LayoutDashboard, active: true },
    { label: "Doctor Questions", icon: MessageCircleQuestion, active: false },
    { label: "Settings", icon: Settings, active: false },
  ];

  function downloadExplanationPdf() {
    if (!explanation.trim()) return;

    // Open a print-friendly document. The browser's Print dialog lets the user
    // save it as a PDF without adding a PDF library or losing Hindi characters.
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      setModelStatus("The PDF window was blocked. Allow pop-ups for this site and try again.");
      return;
    }

    const escapeHtml = (value: string) =>
      value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
        
    const formattedLines = explanation.replace(/\r/g, "").split("\n").map((rawLine) => {
      const line = rawLine.trim();
      if (!line) return "";
      const heading = line.match(/^#{1,4}\s*(\d{1,2})[.)]?\s*[-.:)]?\s*(.+)$/) || line.match(/^(\d{1,2})[.)]\s+(.+)$/);
      if (heading) return `<h2><span class="number">${escapeHtml(heading[1])}</span>${escapeHtml(heading[2].replace(/\*\*/g, ""))}</h2>`;
      if (/^#{1,4}\s+/.test(line)) return `<h2>${escapeHtml(line.replace(/^#{1,4}\s+/, "").replace(/\*\*/g, ""))}</h2>`;
      if (/^[-*•]\s+/.test(line)) return `<li>${escapeHtml(line.replace(/^[-*•]\s+/, "")).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")}</li>`;
      return `<p>${escapeHtml(line).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")}</p>`;
    }).join("\n").replace(/(?:<li>.*?<\/li>\n?)+/gs, (list) => `<ul>${list}</ul>`);

    const printLabels: Record<string, { htmlLang: string; locale: string; documentTitle: string; reportTitle: string; file: string; language: string; generated: string; important: string; disclaimer: string; footer: string }> = {
      English: { htmlLang: "en", locale: "en-IN", documentTitle: "MedLens Report Explanation", reportTitle: "Medical Report Explanation", file: "File", language: "Language", generated: "Generated", important: "Important", disclaimer: "This is an AI-generated educational explanation, not a diagnosis or treatment recommendation. AI can omit or misinterpret findings. Verify all values against the original report and discuss the report with a qualified healthcare professional.", footer: "Generated with MedLens · Keep this document private because it may contain sensitive health information." },
      Hindi: { htmlLang: "hi", locale: "hi-IN", documentTitle: "MedLens रिपोर्ट की व्याख्या", reportTitle: "मेडिकल रिपोर्ट की व्याख्या", file: "फ़ाइल", language: "भाषा", generated: "बनाई गई तारीख", important: "महत्वपूर्ण", disclaimer: "यह AI द्वारा तैयार की गई शैक्षिक व्याख्या है, निदान या उपचार की सलाह नहीं। AI कुछ निष्कर्ष छोड़ सकता है या उनकी गलत व्याख्या कर सकता है। सभी मानों का मूल रिपोर्ट से मिलान करें और योग्य स्वास्थ्य विशेषज्ञ से चर्चा करें।", footer: "MedLens द्वारा तैयार · इस दस्तावेज़ में संवेदनशील स्वास्थ्य जानकारी हो सकती है, इसे निजी रखें।" },
      Urdu: { htmlLang: "ur", locale: "ur-PK", documentTitle: "MedLens رپورٹ کی وضاحت", reportTitle: "طبی رپورٹ کی وضاحت", file: "فائل", language: "زبان", generated: "تیار ہونے کی تاریخ", important: "اہم", disclaimer: "یہ AI کی تیار کردہ تعلیمی وضاحت ہے، تشخیص یا علاج کی سفارش نہیں۔ AI بعض نتائج چھوڑ سکتا ہے یا ان کی غلط تشریح کر سکتا ہے۔ تمام اقدار کو اصل رپورٹ سے ملائیں اور کسی مستند طبی ماہر سے مشورہ کریں۔", footer: "MedLens کے ذریعے تیار کردہ · اس دستاویز میں حساس طبی معلومات ہو سکتی ہیں، اسے نجی رکھیں۔" },
      Bengali: { htmlLang: "bn", locale: "bn-BD", documentTitle: "MedLens রিপোর্টের ব্যাখ্যা", reportTitle: "মেডিকেল রিপোর্টের ব্যাখ্যা", file: "ফাইল", language: "ভাষা", generated: "তৈরির তারিখ", important: "গুরুত্বপূর্ণ", disclaimer: "এটি AI-তৈরি শিক্ষামূলক ব্যাখ্যা, রোগ নির্ণয় বা চিকিৎসার পরামর্শ নয়। AI কিছু তথ্য বাদ দিতে বা ভুলভাবে ব্যাখ্যা করতে পারে। মূল রিপোর্টের সঙ্গে সব মান যাচাই করুন এবং একজন যোগ্য স্বাস্থ্যকর্মীর সঙ্গে আলোচনা করুন।", footer: "MedLens দিয়ে তৈরি · এই নথিতে সংবেদনশীল স্বাস্থ্যতথ্য থাকতে পারে, তাই ব্যক্তিগত রাখুন।" },
      Tamil: { htmlLang: "ta", locale: "ta-IN", documentTitle: "MedLens அறிக்கை விளக்கம்", reportTitle: "மருத்துவ அறிக்கை விளக்கம்", file: "கோப்பு", language: "மொழி", generated: "உருவாக்கிய தேதி", important: "முக்கியம்", disclaimer: "இது AI உருவாக்கிய கல்வி நோக்க விளக்கம்; நோயறிதலோ சிகிச்சை பரிந்துரையோ அல்ல. AI சில கண்டுபிடிப்புகளை விடக்கூடும் அல்லது தவறாகப் புரிந்துகொள்ளக்கூடும். எல்லா மதிப்புகளையும் அசல் அறிக்கையுடன் சரிபார்த்து தகுதியான மருத்துவ நிபுணருடன் கலந்துரையாடவும்.", footer: "MedLens மூலம் உருவாக்கப்பட்டது · இந்த ஆவணத்தில் முக்கியமான சுகாதாரத் தகவல்கள் இருக்கலாம்; தனிப்பட்டதாக வைத்திருங்கள்." },
      Telugu: { htmlLang: "te", locale: "te-IN", documentTitle: "MedLens నివేదిక వివరణ", reportTitle: "వైద్య నివేదిక వివరణ", file: "ఫైల్", language: "భాష", generated: "తయారైన తేదీ", important: "ముఖ్యం", disclaimer: "ఇది AI రూపొందించిన విద్యాపరమైన వివరణ మాత్రమే; నిర్ధారణ లేదా చికిత్స సిఫార్సు కాదు. AI కొన్ని విషయాలను వదిలివేయవచ్చు లేదా తప్పుగా అర్థం చేసుకోవచ్చు. అన్ని విలువలను అసలు నివేదికతో సరిపోల్చి, అర్హత కలిగిన వైద్య నిపుణుడితో చర్చించండి.", footer: "MedLens ద్వారా రూపొందించబడింది · ఈ పత్రంలో సున్నితమైన ఆరోగ్య సమాచారం ఉండవచ్చు; దయచేసి గోప్యంగా ఉంచండి." },
    };
    const labels = printLabels[language] || printLabels.English;
    const safeFileTitle = escapeHtml(fileName || "Medical report");
    const safeLanguage = escapeHtml(language);
    const reportDate = new Date().toLocaleDateString(labels.locale);
    printWindow.document.open();
    printWindow.document.write(`<!doctype html>
      <html lang="${labels.htmlLang}">
      <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
      <title>${escapeHtml(labels.documentTitle)}</title>
      <style>
        @page { size: A4; margin: 18mm 16mm; }
        * { box-sizing: border-box; }
        body { margin: 0; color: #1e293b; font-family: Arial, "Noto Sans Devanagari", "Noto Sans", sans-serif; font-size: 11pt; line-height: 1.7; }
        header { border-bottom: 3px solid #0f766e; padding-bottom: 14px; margin-bottom: 22px; }
        .brand { color: #0f766e; font-size: 11pt; font-weight: 700; letter-spacing: 1px; }
        h1 { margin: 7px 0 4px; color: #0f172a; font-size: 23pt; }
        .meta { color: #64748b; font-size: 9pt; }
        h2 { display: flex; align-items: flex-start; gap: 9px; margin: 22px 0 9px; padding-bottom: 7px; border-bottom: 1px solid #ddd6fe; color: #5b21b6; font-size: 15pt; page-break-after: avoid; }
        .number { display: inline-flex; min-width: 25px; height: 25px; align-items: center; justify-content: center; border-radius: 50%; background: #ede9fe; color: #5b21b6; font-size: 10pt; }
        p { margin: 8px 0; white-space: pre-wrap; }
        ul { margin: 8px 0 12px; padding-left: 22px; } li { margin: 5px 0; padding-left: 3px; }
        strong { color: #0f172a; }
        .disclaimer { margin-top: 28px; padding: 13px 15px; border: 1px solid #fcd34d; border-radius: 8px; background: #fffbeb; color: #92400e; font-size: 9pt; }
        footer { margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 9px; color: #64748b; font-size: 8pt; text-align: center; }
      </style></head><body>
      <header><div class="brand">MEDLENS · YOUR HEALTH, MADE SIMPLE</div><h1>${escapeHtml(labels.reportTitle)}</h1>
      <div class="meta">${escapeHtml(labels.file)}: ${safeFileTitle} · ${escapeHtml(labels.language)}: ${safeLanguage} · ${escapeHtml(labels.generated)}: ${escapeHtml(reportDate)}</div></header>
      <main>${formattedLines}</main>
      <div class="disclaimer"><strong>${escapeHtml(labels.important)}:</strong> ${escapeHtml(labels.disclaimer)}</div>
      <footer>${escapeHtml(labels.footer)}</footer>
      <script>window.onload = function () { window.focus(); window.print(); };</script>
      </body></html>`);
    printWindow.document.close();
  }

  async function explainReportWithGemini() {
    if (!extractedText.trim()) {
      setModelStatus("Extract text from a report first.");
      return;
    }

    setIsExplaining(true);
    setExplanation("");
    setModelStatus("Sending extracted text securely to MedLens server...");

    try {
      const response = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: extractedText, language }),
      });

      const data: { explanation?: string; error?: string } = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `Request failed (${response.status}).`);
      }
      if (!data.explanation?.trim()) {
        throw new Error("Gemini did not return a readable explanation.");
      }

      setExplanation(data.explanation.trim());
      setModelStatus("Explanation generated. Verify every value against the original report and discuss findings with a qualified clinician.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setModelStatus(`Could not generate explanation: ${message}`);
    } finally {
      setIsExplaining(false);
    }
  }

  const parsedResults = parseMedicalResults(extractedText);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100">
      <div className="flex min-h-screen">
        {/* Desktop sidebar */}
        <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 lg:flex">
          <a href="#" className="mb-10 flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-700 text-white">
              <HeartPulse size={25} />
            </span>
            <span>
              <span className="block text-xl font-bold tracking-tight">
                MedLens
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Your health companion
              </span>
            </span>
          </a>

          <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
            Workspace
          </p>

          <nav className="space-y-1">
            {navItems.map(({ label, icon: Icon, active }) => (
              <button
                key={label}
                onClick={() =>
                  label === "Settings"
                    ? document.getElementById("settings")?.scrollIntoView({ behavior: "smooth" })
                    : label === "Dashboard"
                    ? window.scrollTo({ top: 0, behavior: "smooth" })
                    : document.getElementById("doctor-questions")?.scrollIntoView({ behavior: "smooth" })
                }
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium transition ${
                  active
                    ? "bg-teal-50 text-teal-800 dark:bg-teal-950 dark:text-teal-300"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                }`}
              >
                <Icon size={19} />
                {label}
              </button>
            ))}
          </nav>

          <div className="mt-auto rounded-2xl bg-slate-50 p-4 dark:bg-slate-800">
            <ShieldCheck className="mb-2 text-teal-700 dark:text-teal-400" size={23} />
            <p className="text-sm font-semibold">Your privacy matters</p>
            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
              Medical reports deserve careful handling. Secure processing
              will be added before real reports are supported.
            </p>
          </div>
        </aside>

        {/* Main content */}
        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-10 flex h-[72px] items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/90 sm:px-8">
            <div className="flex items-center gap-3">
              <button
                className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden"
                onClick={() => setMenuOpen(!menuOpen)}
                aria-label="Toggle navigation"
              >
                {menuOpen ? <X size={21} /> : <Menu size={21} />}
              </button>
              <div className="lg:hidden flex items-center gap-2 font-bold">
                <HeartPulse className="text-teal-700" />
                MedLens
              </div>
              <p className="hidden text-sm text-slate-500 dark:text-slate-400 sm:block">
                Your personal health companion
              </p>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <label className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-2 py-2 dark:border-slate-700 sm:px-3">
                <Languages size={17} className="text-teal-700 dark:text-teal-400" />
                <select
                  aria-label="Preferred language"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="max-w-[88px] bg-transparent text-sm outline-none dark:bg-slate-900 sm:max-w-none"
                >
                  {["English", "Hindi", "Urdu", "Bengali", "Tamil", "Telugu"].map((lang) => (
                    <option key={lang}>{lang}</option>
                  ))}
                </select>
              </label>
              <button
                onClick={toggleTheme}
                aria-label="Toggle color theme"
                className="rounded-xl border border-slate-200 p-2.5 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
              </button>
              <div className="hidden h-9 w-9 items-center justify-center rounded-full bg-teal-100 font-semibold text-teal-800 dark:bg-teal-950 dark:text-teal-300 sm:flex">
                M
              </div>
            </div>
          </header>

          {menuOpen && (
            
            <nav className="fixed inset-x-0 top-[72px] z-50 max-h-[calc(100dvh-72px)] space-y-1 overflow-y-auto border-b border-slate-200 bg-white p-3 shadow-xl dark:border-slate-800 dark:bg-slate-900 lg:hidden">

              {navItems.map(({ label, icon: Icon }) => (
                <button
                  key={label}
                  onClick={() => {
                    setMenuOpen(false);
                    const id = label === "Settings" ? "settings" : label === "Doctor Questions" ? "doctor-questions" : "";
                    if (id) document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
                    else window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <Icon size={19} /> {label}
                </button>
              ))}
            </nav>
          )}

          <div className="mx-auto max-w-7xl space-y-8 px-4 py-7 sm:px-8 sm:py-10">
            {/* Welcome */}
            <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <p className="mb-2 flex items-center gap-2 text-sm font-medium text-teal-700 dark:text-teal-400">
                  <Sparkles size={16} /> YOUR HEALTH, MADE SIMPLE
                </p>
                <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                  Understand your health.
                </h1>
                <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600 dark:text-slate-400 sm:text-base">
                  Medical reports can be confusing. MedLens helps you
                  understand the terminology and prepare for your next
                  conversation with your doctor.
                </p>
              </div>
              <span className="flex w-fit items-center gap-2 rounded-full border border-teal-100 bg-teal-50 px-3 py-2 text-xs font-medium text-teal-800 dark:border-teal-900 dark:bg-teal-950 dark:text-teal-300">
                <ShieldCheck size={16} /> Designed with privacy in mind
              </span>
            </section>

            {/* Upload card: supports drag-and-drop without navigating away */}
            <section
              onDragEnter={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDragging(true);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDragging(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                  setIsDragging(false);
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDragging(false);
                const file = e.dataTransfer.files?.[0];
                if (file) handleFile(file);
              }}
              className={`relative overflow-hidden rounded-3xl bg-gradient-to-br from-teal-800 via-teal-700 to-cyan-800 p-6 text-white transition-all sm:p-9 ${
                isDragging ? "ring-4 ring-teal-300 ring-offset-4" : ""
              }`}
            >
              <div className="pointer-events-none absolute -right-12 -top-20 h-64 w-64 rounded-full border border-white/10" />
              <div className="pointer-events-none absolute -right-2 -top-10 h-44 w-44 rounded-full border border-white/10" />
              <div className="relative grid gap-8 md:grid-cols-[1fr_260px] md:items-center">
                <div>
                  <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium">
                    <Sparkles size={14} /> Your AI health companion
                  </span>
                  <h2 className="mt-5 max-w-lg text-2xl font-bold leading-tight sm:text-3xl">
                    Your medical report, explained in simple language.
                  </h2>
                  <p className="mt-3 max-w-lg text-sm leading-6 text-teal-50 sm:text-base">
                    Start with a report and choose the language you feel
                    most comfortable reading.
                  </p>
                  <button
                    onClick={() => fileInput.current?.click()}
                    className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 font-semibold text-teal-900 shadow-sm transition hover:bg-teal-50"
                  >
                    <Upload size={19} /> Upload medical report
                  </button>
                  <input
                    ref={fileInput}
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.webp"
                    className="hidden"
                    onChange={(e) => handleFile(e.target.files?.[0])}
                  />
                  <p className="mt-3 text-xs text-teal-100">
                    PDF, PNG, JPG or WEBP
                  </p>
                  
                  <p className="mt-2 text-xs text-teal-100">
                    Or drag and drop a report here · Maximum 10 MB
                  </p>

                </div>
                <div className="hidden rounded-2xl border border-white/20 bg-white/10 p-5 backdrop-blur-sm md:block">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-teal-800">
                    <FileText size={29} />
                  </div>
                  <p className="mt-5 font-semibold">From report to clarity</p>
                  <div className="mt-4 space-y-3 text-sm text-teal-50">
                    <p className="flex items-center gap-2"><span>01</span> Read your report</p>
                    <p className="flex items-center gap-2"><span>02</span> Understand your results</p>
                    <p className="flex items-center gap-2"><span>03</span> Prepare doctor questions</p>
                  </div>
                </div>
              </div>
            </section>


            {selectedFile && (
              <section className="rounded-2xl border border-teal-200 bg-white p-4 dark:border-teal-900 dark:bg-slate-900 sm:p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-800 dark:bg-teal-950 dark:text-teal-300">
                      <FileCheck size={23} />
                    </div>

                    <div className="min-w-0">
                      <p className="text-sm font-semibold">Report selected</p>
                      <p className="break-all text-sm text-slate-600 dark:text-slate-400">
                        {fileName}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => fileInput.current?.click()}
                      className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                    >
                      Replace
                    </button>

                    <button
                      onClick={() => {
                        setSelectedFile(null);
                        setFileName("");
                        setFileError("");
                        setExtractedText("");
                        setOriginalExtractedText("");
                        setExtractionStatus("");
                        if (fileInput.current) fileInput.current.value = "";
                      }}
                      className="flex items-center justify-center gap-2 rounded-xl border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950"
                    >
                      <X size={16} /> Remove
                    </button>
                  </div>
                </div>

                {selectedFile.type.startsWith("image/") && imagePreviewUrl && (
                  <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-800">
                    <p className="mb-3 text-sm font-medium">Image preview</p>
                    <img
                      src={imagePreviewUrl}
                      alt="Selected medical report preview"
                      className="max-h-96 max-w-full rounded-xl border border-slate-200 object-contain dark:border-slate-700"
                    />
                    <div className="mt-4 space-y-3">
                      <button
                        onClick={() => runOcrOnImage(selectedFile)}
                        disabled={isOcrRunning || isExtracting}
                        className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <FileText size={17} /> {isOcrRunning ? "Recognizing text..." : "Extract text from image (OCR)"}
                      </button>
                      {extractionStatus && (
                        <p role="status" aria-live="polite" className="text-sm text-slate-600 dark:text-slate-300">
                          {extractionStatus}
                        </p>
                      )}
                      {extractedText && (
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold">Extracted text</p>
                              <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-800 dark:border-sky-900 dark:bg-sky-950/60 dark:text-sky-200">
                                <span className="h-1.5 w-1.5 rounded-full bg-sky-500" /> Original extraction
                              </span>
                              {hasTextEdits && (
                                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
                                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Edited by you
                                </span>
                              )}
                            </div>
                            <button
                              onClick={() => navigator.clipboard.writeText(extractedText)}
                              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                            >
                              Copy text
                            </button>
                          </div>
                          <label htmlFor="extracted-image-text" className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                            Review and edit extracted text
                          </label>
                          <textarea
                            id="extracted-image-text"
                            value={extractedText}
                            onChange={(event) => setExtractedText(event.target.value)}
                            rows={12}
                            spellCheck
                            className="w-full rounded-xl border border-violet-300 bg-white p-4 text-sm leading-7 text-slate-800 shadow-sm outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-200 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-violet-400 dark:focus:ring-violet-900"
                            aria-label="Editable extracted image text"
                          />
                          {hasTextEdits && <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">You have edited this extracted text. Your edited version will be sent to Gemini.</p>}
                          <p className="text-xs text-amber-700 dark:text-amber-300">
                            You can correct OCR mistakes here. Verify every value, decimal, unit, and reference range against the original report before generating an explanation.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {selectedFile.type === "application/pdf" && (
                  <div className="mt-4 space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800">
                    <p className="text-sm text-slate-600 dark:text-slate-300">Extract selectable text from this PDF in your browser. Scanned PDFs need OCR, which we will add next.</p>
                    <button
                      onClick={extractPdfText}
                      disabled={isExtracting}
                      className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <FileText size={17} /> {isExtracting ? "Extracting text..." : "Extract text from PDF"}
                    </button>
                    <button
                      onClick={runOcrOnPdf}
                      disabled={isOcrRunning || isExtracting}
                      className="ml-0 inline-flex items-center gap-2 rounded-xl border border-teal-700 px-4 py-2.5 text-sm font-semibold text-teal-800 hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-60 dark:text-teal-300 dark:hover:bg-teal-950 sm:ml-2"
                    >
                      <Sparkles size={17} /> {isOcrRunning ? "Running OCR..." : "Run OCR on scanned PDF"}
                    </button>
                    {extractionStatus && <p role="status" className="text-sm text-slate-600 dark:text-slate-300">{extractionStatus}</p>}
                    {extractedText && (
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold">Extracted text</p>
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-800 dark:border-sky-900 dark:bg-sky-950/60 dark:text-sky-200">
                              <span className="h-1.5 w-1.5 rounded-full bg-sky-500" /> Original extraction
                            </span>
                            {hasTextEdits && (
                              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
                                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Edited by you
                              </span>
                            )}
                          </div>
                          <button onClick={() => navigator.clipboard.writeText(extractedText)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">Copy text</button>
                        </div>
                        <label htmlFor="extracted-pdf-text" className="block text-sm font-medium text-slate-700 dark:text-slate-200">Review and edit extracted text</label>
                        <textarea
                          id="extracted-pdf-text"
                          value={extractedText}
                          onChange={(event) => setExtractedText(event.target.value)}
                          rows={12}
                          spellCheck
                          className="w-full rounded-xl border border-violet-300 bg-white p-4 text-sm leading-7 text-slate-800 shadow-sm outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-200 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-violet-400 dark:focus:ring-violet-900"
                          aria-label="Editable extracted PDF text"
                        />
                        {hasTextEdits && <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">You have edited this extracted text. Your edited version will be sent to our Ai model.</p>}
                        <p className="text-xs text-amber-700 dark:text-amber-300">You can correct extraction mistakes here. Verify every value, decimal, unit, and reference range against the original report before generating an explanation.</p>
                      </div>
                    )}
                  </div>
                )}
              </section>
            )}

            {fileError && (
              <p
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
              >
                {fileError}
              </p>
            )}



            {extractedText && (
              <section className="rounded-2xl border border-violet-200 bg-white p-5 shadow-sm dark:border-violet-900 dark:bg-slate-900">
                <div className="mb-4 flex items-start gap-3">
                  <div className="rounded-xl bg-violet-50 p-2 text-violet-700 dark:bg-violet-950 dark:text-violet-300"><Sparkles size={20} /></div>
                  <div className="flex-1">
                    <h2 className="font-semibold">Understand your report with Gemini AI</h2>
                    <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">We explains the extracted report in your selected language. The extracted report text is sent to our Ai model for processing.</p>
                  </div>
                </div>
                <button onClick={explainReportWithGemini} disabled={isExplaining} className="inline-flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-60">
                  <Sparkles size={17} /> {isExplaining ? "Generating explanation with Gemini..." : explanation ? "Generate explanation again" : "Explain report in simple language"}
                </button>
                {modelStatus && <p role="status" aria-live="polite" className="mt-3 text-sm text-slate-600 dark:text-slate-300">{modelStatus}</p>}
                {explanation && <div className="mt-5 overflow-hidden rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-teal-50 shadow-sm dark:border-violet-900 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
                  <div className="flex items-center gap-3 border-b border-violet-100 bg-white/70 px-5 py-4 dark:border-slate-700 dark:bg-slate-900/70">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                      <FileCheck size={21} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white sm:text-xl">Your report explained</h3>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">A section-by-section explanation in your selected language</p>
                    </div>
                    <button
                      type="button"
                      onClick={downloadExplanationPdf}
                      className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-teal-700 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-teal-800 sm:px-4 sm:text-sm"
                    >
                      <Download size={16} /> <span className="hidden sm:inline">Download PDF</span><span className="sm:hidden">PDF</span>
                    </button>
                  </div>
                  <div className="space-y-5 p-5 sm:p-6">
                    <ExplanationContent content={explanation} />
                  </div>
                  <div className="border-t border-amber-200 bg-amber-50 px-5 py-4 dark:border-amber-900/70 dark:bg-amber-950/30">
                    <div className="flex items-start gap-2.5">
                      <ShieldCheck size={18} className="mt-0.5 shrink-0 text-amber-700 dark:text-amber-300" />
                      <p className="text-xs leading-6 text-amber-800 dark:text-amber-200">Educational explanation only, not a diagnosis or treatment recommendation. AI can omit or misinterpret findings. Verify every value against the original report and consult a qualified clinician.</p>
                    </div>
                  </div>
                </div>}
              </section>
            )}

            {extractedText && (
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className="mb-3 flex items-start gap-3">
                  <div className="rounded-xl bg-teal-50 p-2 text-teal-700 dark:bg-teal-950 dark:text-teal-300"><ClipboardList size={20} /></div>
                  <div>
                    <h2 className="font-semibold">Structured report results</h2>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">MedLens has attempted to identify test names, values, units, and reference ranges from the extracted text.</p>
                  </div>
                </div>
                {parsedResults.length > 0 ? (
                  <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                    <table className="w-full min-w-[680px] text-left text-sm">
                      <thead className="bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        <tr>
                          <th className="px-3 py-3 font-semibold">Test</th>
                          <th className="px-3 py-3 font-semibold">Value</th>
                          <th className="px-3 py-3 font-semibold">Unit / extra text</th>
                          <th className="px-3 py-3 font-semibold">Range found in report</th>
                          <th className="px-3 py-3 font-semibold">Comparison</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {parsedResults.map((result, index) => (
                          <tr key={`${result.test}-${index}`}>
                            <td className="px-3 py-3 font-medium">{result.test}</td>
                            <td className="px-3 py-3 tabular-nums">{result.value}</td>
                            <td className="px-3 py-3">{result.unit}</td>
                            <td className="px-3 py-3">{result.referenceRange}</td>
                            <td className="px-3 py-3">
                              <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${result.status === "High" || result.status === "Low" ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" : result.status === "Within listed range" ? "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300" : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"}`}>
                                {result.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-950 dark:text-slate-300">No clear test-result rows were detected automatically. You can still review the extracted text above.</p>
                )}
                <p className="mt-3 text-xs leading-5 text-amber-700 dark:text-amber-300">Prototype only: this is a simple text-pattern parser, not a medical interpretation system. It may misidentify values or ranges. “High” and “Low” are shown only when a numeric range appears on the same line. Verify every row against the original report and consult a qualified clinician.</p>
              </section>
            )}

            {/* Feature cards */}
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {[
                {
                  icon: FileText,
                  title: "Understand your report",
                  text: "Get clear explanations of medical terms and test results.",
                  color: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
                },
                {
                  icon: Languages,
                  title: "Your preferred language",
                  text: "Choose English, Hindi, Urdu, Bengali, Tamil or Telugu.",
                  color: "bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
                },
                {
                  icon: MessageCircleQuestion,
                  title: "Prepare for your doctor",
                  text: "Create useful questions to discuss during your appointment.",
                  color: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
                },
              ].map(({ icon: Icon, title, text, color }) => (
                <article key={title} className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${color}`}>
                    <Icon size={22} />
                  </div>
                  <h3 className="mt-4 font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">{text}</p>
                </article>
              ))}
            </section>

            {/* Consultation preparation */}
            <section id="doctor-questions" className="scroll-mt-24 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 sm:p-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-teal-50 p-3 text-teal-800 dark:bg-teal-950 dark:text-teal-300">
                    <MessageCircleQuestion size={22} />
                  </div>
                  <h3 className="font-semibold">Doctor question checklist</h3>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-400">
                  Turn your report into a practical checklist to take to your
                  next medical appointment.
                </p>
                <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
                  Questions will be generated after report analysis is added.
                </p>
              </div>
              <div id="settings" className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 sm:p-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-violet-50 p-3 text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                    <Clock3 size={22} />
                  </div>
                  <h3 className="font-semibold">Your preferences</h3>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-400">
                  Selected language: <strong>{language}</strong>. Theme:{" "}
                  <strong>{theme === "light" ? "Light" : "Dark"}</strong>.
                </p>
                <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                  Language selection and theme preview work in this demo.
                  Report translation will be connected later.
                </p>
              </div>
            </section>

            <footer className="border-t border-slate-200 py-6 text-center text-xs leading-5 text-slate-500 dark:border-slate-800 dark:text-slate-400">
              <p>MedLens is designed to help explain medical information, not diagnose conditions.</p>
              <p className="mt-1">Always discuss medical findings and treatment decisions with a qualified healthcare professional.</p>
            </footer>
          </div>
        </div>
      </div>
    </main>
  );
}
