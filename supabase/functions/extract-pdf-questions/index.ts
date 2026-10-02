// @ts-nocheck
// Supabase Edge Function: extract-pdf-questions
// Vision-only pipeline — NO OCR text layer
// Model is configurable via GEMINI_MODEL env variable
// RESOURCE-OPTIMIZED: Processes ONE page per request to avoid HTTP 546 WORKER_RESOURCE_LIMIT

declare const Deno: any;

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

// ─── Constants ────────────────────────────────────────────────────────────────
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Model priority: read from env first, then fall through the fallback chain.
// Admin can set GEMINI_MODEL=gemini-3.6-flash in Supabase Vault to lock a model.
function getModelFallbacks(): string[] {
  const envModel = Deno.env.get("GEMINI_MODEL");
  const defaults = [
    "gemini-3.8-flash",
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite",
    "gemini-3.6-flash",
  ];
  if (envModel && !defaults.includes(envModel)) {
    return [envModel, ...defaults];
  }
  if (envModel) {
    // Promote the env model to the front
    return [envModel, ...defaults.filter((m) => m !== envModel)];
  }
  return defaults;
}

// ─── TNPSC bilingual extraction prompt ────────────────────────────────────────
// Strict vision-only: NO text extraction, NO OCR fallback, NO invented content.
const SYSTEM_PROMPT = `You are a precise document extraction engine specialised in TNPSC (Tamil Nadu Public Service Commission) examination question papers.

These papers are bilingual: questions appear in Tamil (தமிழ்) and/or English.

YOUR ONLY JOB: Read the supplied page image(s) and return structured JSON. Nothing else.

═══════════════════════════════
EXTRACTION RULES (MANDATORY)
═══════════════════════════════
1.  Extract ONLY information visibly present in the image. Do NOT invent content.
2.  Preserve Tamil text exactly as Tamil. Do NOT transliterate or translate.
3.  Preserve English text exactly as English. Do NOT translate into Tamil.
4.  If both Tamil and English versions of a question appear, populate BOTH
    tamil_question and english_question fields.
5.  If only one language appears, populate only that field; set the other to null.
6.  Preserve the original question numbering exactly.
7.  Preserve option labels exactly (A, B, C, D — or 1, 2, 3, 4 mapped to A–D).
8.  If five options (A–E) are visible, include all five; set missing ones to null.
9.  Do NOT merge two separate questions into one.
10. Do NOT split one question across two question objects.
11. Do NOT discard questions that contain diagrams or tables.
    Set has_diagram: true and preserve all readable text around it.
12. For match-the-following questions, preserve the column structure as readable text.
13. For assertion/reason questions, preserve the assertion and reason texts separately
    within question_text or tamil_question / english_question.
14. For numerical/mathematical content, reproduce as accurately as possible.
15. If a page section is a header, footer, instructions, or answer key only —
    return an empty questions array for that page; do not force-extract non-questions.
16. Set extraction_status:
    "complete"   — all question text and options clearly readable
    "partial"    — some text unreadable or cut off (preserve what is readable)
    "unreadable" — entire question is illegible
17. Do NOT set correct_option unless an answer key is explicitly visible on the page
    for that question. If not visible, set correct_option: null.
18. Do NOT guess or infer correct answers from knowledge.
19. Return ONLY the JSON object. No markdown. No explanation. No preamble.

═══════════════════════════════
SUPPORTED QUESTION TYPES
═══════════════════════════════
mcq | match_following | assertion_reason | statement_based | numerical | diagram_based | table_based | unknown

═══════════════════════════════
REQUIRED JSON SCHEMA
═══════════════════════════════
{
  "pages": [
    {
      "page_number": <integer>,
      "questions": [
        {
          "question_number": "<string>",
          "question_type": "<mcq|match_following|assertion_reason|statement_based|numerical|diagram_based|table_based|unknown>",
          "tamil_question": "<Tamil text or null>",
          "english_question": "<English text or null>",
          "options": {
            "A": "<text or null>",
            "B": "<text or null>",
            "C": "<text or null>",
            "D": "<text or null>",
            "E": null
          },
          "correct_option": null,
          "source_page": <integer>,
          "extraction_status": "<complete|partial|unreadable>",
          "has_diagram": false
        }
      ]
    }
  ]
}

Return ONLY this JSON. No other text.`;

// ─── Types ─────────────────────────────────────────────────────────────────────
interface PageImage {
  page_number: number;
  image_base64: string;   // raw base64, no data-URI prefix
  mime_type: string;      // e.g. "image/jpeg"
}

interface ExtractedQuestion {
  question_number: string;
  question_type: string;
  tamil_question: string | null;
  english_question: string | null;
  options: Record<string, string | null>;
  correct_option: string | null;
  source_page: number;
  extraction_status: "complete" | "partial" | "unreadable";
  has_diagram: boolean;
}

interface PageResult {
  page_number: number;
  questions: ExtractedQuestion[];
}

interface ExtractionResponse {
  pages: PageResult[];
}

// ─── JSON repair helper ────────────────────────────────────────────────────────
function extractAndParseJson(raw: string): ExtractionResponse {
  let text = raw.trim();

  // Strip markdown fences
  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  }

  // First attempt: direct parse
  try {
    return JSON.parse(text);
  } catch (_e1) {
    // Second attempt: find outer JSON object boundaries
    const start = text.indexOf("{");
    const end   = text.lastIndexOf("}");
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch (_e2) { /* fall through */ }
    }
    // Third attempt: find outer JSON array boundaries (Gemini sometimes wraps in [])
    const aStart = text.indexOf("[");
    const aEnd   = text.lastIndexOf("]");
    if (aStart !== -1 && aEnd > aStart) {
      try {
        const arr = JSON.parse(text.slice(aStart, aEnd + 1));
        // Wrap bare array into our expected shape
        return { pages: Array.isArray(arr) ? arr : [] };
      } catch (_e3) { /* fall through */ }
    }
    throw new Error(`INVALID_JSON: Could not parse Gemini response. First 200 chars: ${text.slice(0, 200)}`);
  }
}

// ─── Normalize a single question from raw Gemini output ──────────────────────
function normalizeQuestion(q: any, pageNum: number, idx: number): ExtractedQuestion {
  const qNum = String(q.question_number ?? idx + 1).trim();

  const validTypes = [
    "mcq","match_following","assertion_reason","statement_based",
    "numerical","diagram_based","table_based","unknown",
  ];
  const qType = validTypes.includes(q.question_type) ? q.question_type : "mcq";

  // Options: accept both object {A,B,C,D} and array [{label,text}]
  let options: Record<string, string | null> = { A: null, B: null, C: null, D: null, E: null };
  if (q.options && typeof q.options === "object" && !Array.isArray(q.options)) {
    for (const k of ["A","B","C","D","E"]) {
      const v = q.options[k];
      options[k] = v != null ? String(v).trim() || null : null;
    }
  } else if (Array.isArray(q.options)) {
    const labels = ["A","B","C","D","E"];
    q.options.forEach((o: any, i: number) => {
      const label = o?.label ?? labels[i];
      const text  = o?.text ?? (typeof o === "string" ? o : null);
      if (label && text != null) options[String(label).toUpperCase()] = String(text).trim() || null;
    });
  }

  const correctOpt = q.correct_option
    ? String(q.correct_option).toUpperCase().trim()
    : null;
  const validOpt = ["A","B","C","D","E"].includes(correctOpt ?? "") ? correctOpt : null;

  const validStatuses = ["complete","partial","unreadable"];
  const status = validStatuses.includes(q.extraction_status) ? q.extraction_status : "complete";

  return {
    question_number:   qNum,
    question_type:     qType,
    tamil_question:    q.tamil_question   ? String(q.tamil_question).trim()   : null,
    english_question:  q.english_question ? String(q.english_question).trim() : null,
    options,
    correct_option:    validOpt,
    source_page:       Number(q.source_page ?? pageNum),
    extraction_status: status as "complete" | "partial" | "unreadable",
    has_diagram:       Boolean(q.has_diagram),
  };
}

// ─── Normalize full response ──────────────────────────────────────────────────
function normalizeResponse(raw: any): ExtractionResponse {
  if (!raw || typeof raw !== "object") {
    throw new Error("INVALID_JSON: Response is not an object");
  }

  // Handle both { pages: [...] } and direct array
  const pagesRaw: any[] = Array.isArray(raw.pages)
    ? raw.pages
    : Array.isArray(raw)
    ? raw
    : [];

  const pages: PageResult[] = pagesRaw.map((p: any) => {
    const pageNum = Number(p.page_number ?? 1);
    const rawQs   = Array.isArray(p.questions) ? p.questions : [];
    const questions = rawQs
      .filter((q: any) => q && typeof q === "object")
      .map((q: any, i: number) => normalizeQuestion(q, pageNum, i));
    return { page_number: pageNum, questions };
  });

  return { pages };
}

// ─── Resource usage logging helper ─────────────────────────────────────────────
function logRequestSize(pageImages: PageImage[]): void {
  let totalBase64Bytes = 0;
  for (const pi of pageImages) {
    const cleanB64 = pi.image_base64.replace(/^data:image\/\w+;base64,/, "");
    totalBase64Bytes += cleanB64.length;
  }
  const totalBase64MB = (totalBase64Bytes / (1024 * 1024)).toFixed(2);
  const estimatedDecodedMB = (totalBase64Bytes * 0.75 / (1024 * 1024)).toFixed(2);
  
  console.log(`[RESOURCE] Processing ${pageImages.length} page(s)`);
  console.log(`[RESOURCE] Total base64 size: ${totalBase64MB} MB`);
  console.log(`[RESOURCE] Estimated decoded size: ${estimatedDecodedMB} MB`);
}

// ─── Gemini API caller (single attempt, one model) ────────────────────────────
async function callGemini(
  apiKey: string,
  model: string,
  pageImages: PageImage[]
): Promise<ExtractionResponse> {

  console.log(`[GEMINI] Using model: ${model}`);
  logRequestSize(pageImages);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  // Build parts: system prompt + one inlineData part per page image
  const parts: any[] = [{ text: SYSTEM_PROMPT }];

  for (const pi of pageImages) {
    // Strip any data-URI prefix the client may have included
    // DO NOT create multiple copies — use the cleaned string directly
    const cleanB64 = pi.image_base64.replace(/^data:image\/\w+;base64,/, "");
    parts.push({
      inlineData: {
        mimeType: pi.mime_type || "image/jpeg",
        data: cleanB64,
      },
    });
  }

  // Add the per-batch instruction
  const pageNums = pageImages.map((p) => p.page_number).join(", ");
  parts.push({
    text: `Extract all multiple-choice questions from page(s) ${pageNums}. ` +
          `Each question object must include the source_page field matching the page it came from. ` +
          `Return ONLY the JSON object matching the schema above.`,
  });

  const body = JSON.stringify({
    contents: [{ parts }],
    generationConfig: {
      temperature: 0.1,
      // No responseMimeType — not universally supported; we parse JSON from text
    },
  });

  // Release image references AFTER JSON.stringify to free memory before network call
  for (const pi of pageImages) {
    pi.image_base64 = "";
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body,
  });

  const rawText = await res.text();

  if (!res.ok) {
    let errMsg = rawText;
    try {
      errMsg = JSON.parse(rawText)?.error?.message ?? rawText;
    } catch { /* keep raw */ }

    // Classify the error so callers can decide whether to retry / skip model
    const isModelGone =
      res.status === 404 ||
      /not available|not found|model.*deprecated|is no longer available|no longer supported/i.test(errMsg);

    if (isModelGone) {
      const e: any = new Error(`MODEL_NOT_SUPPORTED: ${model} — ${errMsg.slice(0, 200)}`);
      e.code = "MODEL_NOT_SUPPORTED";
      throw e;
    }

    if (res.status === 429) {
      const e: any = new Error(`GEMINI_RATE_LIMIT: ${errMsg.slice(0, 200)}`);
      e.code = "GEMINI_RATE_LIMIT";
      e.retryAfterMs = (() => {
        const m = errMsg.match(/retry.*?(\d+(?:\.\d+)?)\s*s/i);
        return m ? Math.ceil(parseFloat(m[1]) + 3) * 1000 : 20_000;
      })();
      throw e;
    }

    if (res.status >= 500) {
      const e: any = new Error(`GEMINI_API_ERROR: HTTP ${res.status} — ${errMsg.slice(0, 200)}`);
      e.code = "GEMINI_API_ERROR";
      throw e;
    }

    const e: any = new Error(`GEMINI_API_ERROR: HTTP ${res.status} — ${errMsg.slice(0, 200)}`);
    e.code = "GEMINI_API_ERROR";
    throw e;
  }

  // Parse the successful response
  let geminiData: any;
  try {
    geminiData = JSON.parse(rawText);
  } catch {
    throw new Error("GEMINI_API_ERROR: Response is not valid JSON");
  }

  const content = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!content) {
    throw new Error("GEMINI_API_ERROR: Empty content in Gemini response");
  }

  // Parse + normalize the extraction JSON
  const rawParsed = extractAndParseJson(content);
  return normalizeResponse(rawParsed);
}

// ─── Main handler ─────────────────────────────────────────────────────────────
serve(async (req: any) => {
  // ── CORS preflight ──
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS, status: 200 });
  }

  try {
    // ── Auth ──
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    if (!authHeader) {
      return jsonError(401, "UNAUTHORIZED", "Missing Authorization header");
    }

    const supabaseUrl     = Deno.env.get("SUPABASE_URL")             ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")        ?? "";
    const serviceRoleKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();

    // Accept anon key, service role key, or a valid user JWT (length heuristic)
    const isAuthorized =
      token === supabaseAnonKey ||
      token === serviceRoleKey ||
      token.length > 20;

    if (!isAuthorized) {
      return jsonError(401, "UNAUTHORIZED", "Invalid authorization token");
    }

    // ── API key ──
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiApiKey) {
      return jsonError(500, "GEMINI_API_ERROR", "GEMINI_API_KEY secret is not configured in Supabase Vault");
    }

    // ── Parse request body ──
    let body: any;
    try {
      body = await req.json();
    } catch {
      return jsonError(400, "INVALID_REQUEST", "Request body is not valid JSON");
    }

    // RESOURCE LIMIT: Accept ONLY ONE page per request to avoid HTTP 546
    // Expected: { pages: [{ page_number, image_base64, mime_type }] }
    // Also supports legacy single-page: { imageBase64, mimeType, pageNumber }
    let pageImages: PageImage[] = [];

    if (Array.isArray(body.pages) && body.pages.length > 0) {
      // ENFORCE: Only process the FIRST page
      if (body.pages.length > 1) {
        console.warn(`[RESOURCE] Client sent ${body.pages.length} pages — processing only the first to avoid RESOURCE_LIMIT`);
      }
      const p = body.pages[0];
      pageImages = [{
        page_number:   Number(p.page_number ?? 1),
        image_base64:  String(p.image_base64 ?? p.imageBase64 ?? ""),
        mime_type:     String(p.mime_type ?? p.mimeType ?? "image/jpeg"),
      }];
    } else if (body.imageBase64) {
      // Legacy single-page format (backwards compatibility)
      pageImages = [{
        page_number:  Number(body.pageNumber ?? 1),
        image_base64: String(body.imageBase64),
        mime_type:    String(body.mimeType ?? "image/jpeg"),
      }];
    } else {
      return jsonError(400, "INVALID_REQUEST", "Request must include 'pages' array or 'imageBase64'");
    }

    // Validate images are present
    if (!pageImages[0]?.image_base64) {
      return jsonError(400, "IMAGE_PROCESSING_ERROR", "Page has no image data");
    }

    // ── Try models with retry logic ──
    const models      = getModelFallbacks();
    let lastErr: any  = null;
    let result: ExtractionResponse | null = null;
    let usedModel     = "";

    for (const model of models) {
      let attempt = 0;
      const maxAttempts = 2; // Reduced from 3 to save resources

      while (attempt < maxAttempts) {
        attempt++;
        try {
          result    = await callGemini(geminiApiKey, model, pageImages);
          usedModel = model;
          break; // success
        } catch (err: any) {
          lastErr = err;

          if (err.code === "MODEL_NOT_SUPPORTED") {
            // Skip to next model immediately
            console.warn(`[vision] Model ${model} not supported, trying next`);
            break;
          }

          if (err.code === "GEMINI_RATE_LIMIT") {
            if (attempt < maxAttempts) {
              const wait = Math.min(err.retryAfterMs ?? 20_000, 30_000); // Cap wait time
              console.warn(`[vision] Rate limit on ${model}, waiting ${wait}ms`);
              await new Promise((r) => setTimeout(r, wait));
              continue; // retry same model
            }
            break; // exhausted retries for this model, try next
          }

          if (err.code === "GEMINI_API_ERROR") {
            if (attempt < maxAttempts) {
              const backoff = 1000 * attempt; // Reduced backoff
              console.warn(`[vision] API error on ${model} attempt ${attempt}, retrying in ${backoff}ms`);
              await new Promise((r) => setTimeout(r, backoff));
              continue;
            }
            break;
          }

          if (err.code === "INVALID_JSON" && attempt < maxAttempts) {
            // One JSON repair retry
            console.warn(`[vision] Invalid JSON from ${model}, retrying once`);
            await new Promise((r) => setTimeout(r, 500));
            continue;
          }

          // Unknown error — don't retry
          break;
        }
      }

      if (result) break; // got a result, stop trying models
    }

    if (!result) {
      const code = lastErr?.code ?? "GEMINI_API_ERROR";
      const msg  = lastErr?.message ?? "All Gemini models failed";
      console.error(`[vision] All models failed. Last error: ${msg}`);
      return jsonError(502, code, msg);
    }

    // ── Return successful extraction ──
    console.log(`[SUCCESS] Extracted ${result.pages[0]?.questions?.length ?? 0} questions from page ${pageImages[0].page_number}`);
    return new Response(
      JSON.stringify({ ...result, model_used: usedModel }),
      { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );

  } catch (fatal: any) {
    console.error("[vision] Unhandled error:", fatal);
    
    // Check if this is the HTTP 546 RESOURCE_LIMIT error
    if (fatal?.message?.includes("RESOURCE_LIMIT") || fatal?.message?.includes("546")) {
      console.error("[RESOURCE_LIMIT] Edge function exhausted compute resources");
      return jsonError(546, "RESOURCE_LIMIT_EXCEEDED", 
        "Edge function ran out of memory processing this page. Try reducing image size or splitting into smaller batches.");
    }
    
    return jsonError(500, "INTERNAL_ERROR", fatal?.message ?? "Edge function crashed");
  }
});

// ─── Helper ───────────────────────────────────────────────────────────────────
function jsonError(status: number, code: string, message: string) {
  return new Response(
    JSON.stringify({ error: code, message }),
    { status, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
  );
}