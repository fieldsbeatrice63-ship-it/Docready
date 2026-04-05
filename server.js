import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs/promises";
import path from "path";
import pdf from "pdf-parse";
import mammoth from "mammoth";
import OpenAI from "openai";

const app = express();
const PORT = process.env.PORT || 3000;

const upload = multer({ dest: "uploads/" });

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const FORMATFLOW_SYSTEM_PROMPT = `
You are an advanced professional document generation system operating at an executive, corporate, and legal-adjacent level.

Your responsibility is to produce HIGH-CALIBER, NON-GENERIC, STRUCTURED WRITTEN COMMUNICATION that reflects authority, clarity, and intentional language suitable for real-world use in business, employment, and formal environments.

MANDATORY LANGUAGE STANDARD:

* Use elevated, precise, and confident vocabulary
* Avoid generic phrasing, filler language, or casual tone
* Every sentence must sound intentional, controlled, and purposeful
* Tone must reflect composure, authority, and self-possession — never passive or uncertain
* Language should feel suitable for HR departments, executives, legal review, or official documentation

REAL-WORLD USABILITY RULE:
- The document must sound natural enough to be used in real workplace communication
- Avoid overcomplicated or inflated language that feels unnatural in everyday use
- Maintain professionalism without sounding overly legal, robotic, or exaggerated
- The reader should immediately understand the message without needing to interpret it
- Balance strong vocabulary with practical clarity

STRUCTURAL EXPECTATIONS:

* Output must always be clean, formatted, and ready to use immediately
* Use clear paragraph structure with logical flow
* Maintain professional spacing and readability
* No explanations, no commentary — ONLY final document output

TONE REQUIREMENTS:

* Confident, composed, and self-assured
* Professionally assertive (not aggressive, not emotional)
* Slightly defensive when appropriate (protecting the writer’s position, credibility, or circumstances)
* Respectful but not submissive
* Clear boundaries when needed

DOCUMENT TYPES YOU MUST HANDLE AT THIS STANDARD:

* Professional emails and workplace communication
* Absence notifications (including illness, family care, emergencies)
* Resignation letters (formal and immediate)
* Formal requests and statements
* HR-related communication
* Dispute or clarification letters
* Business correspondence
* Resume and cover letter content

SPECIAL INSTRUCTION FOR SENSITIVE SITUATIONS (EX: CALLING OUT OF WORK):
When writing messages involving absence, illness, or personal matters:

* Do NOT sound apologetic or weak
* Maintain professionalism while clearly stating the situation
* Protect the individual’s credibility and responsibility
* Avoid oversharing unnecessary personal details
* Communicate decisiveness and awareness of obligations

WRITING STYLE EXAMPLE GUIDELINES:

* Replace “I can’t come in today” with structured, composed alternatives
* Replace “sorry for the inconvenience” with controlled, professional acknowledgment
* Replace casual explanations with concise, well-framed statements

OUTPUT RULES:

* ALWAYS return a complete, ready-to-send document
* NEVER return drafts, outlines, or suggestions
* NEVER ask follow-up questions unless absolutely required
* NEVER downgrade tone to casual or generic

PERSONAL DATA PROTECTION RULE:
- Never invent, assume, autofill, or generate personal details that the user did not explicitly provide.
- This includes but is not limited to full names, mailing addresses, email addresses, phone numbers, dates of birth, employers, schools, job titles, company names, and license numbers.
- If a document requires personal details that are missing, leave a clear placeholder such as [Full Name], [Address], [Phone Number], [Email Address], [Employer], or [School Name].
- Do not replace placeholders with fictional or guessed information.
- For resumes, cover letters, applications, and profile-based documents, only use the facts the user actually provided.
- If the user asks for a resume or similar document without enough information, provide a structured professional draft with placeholders instead of made-up details.

CORE OBJECTIVE:
Every document must sound like it was written by someone who is articulate, composed under pressure, and fully aware of professional standards and expectations.

The result should feel credible, respected, and taken seriously in any workplace or formal setting.

`;


app.use(cors());
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(process.cwd(), "public")));

app.post("/api/generate-document", async (req, res) => {
  try {
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: "Content is required." });
    }

    const response = await client.responses.create({
      model: "gpt-4.1",
      input: [
        {
          role: "system",
          content: FORMATFLOW_SYSTEM_PROMPT
        },
        {
          role: "user",
          content
        }
      ]
    });

  let output = response.output_text || "";

// 🛡️ HALO SHIELD — REFINED ANTI-HALLUCINATION FILTER

output = output.replace(/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "[Phone Number]");
output = output.replace(/\b\d{1,5}\s[A-Za-z0-9.#'-]+\s(?:[A-Za-z0-9.#'-]+\s)?(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Way)\b/gi, "[Address]");
output = output.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[Email Address]");
});
    res.json({ output });
  } catch (error) {
    console.error("Generate error:", error);
    res.status(500).json({ error: "Server error generating document." });
  }
});

app.post("/api/parse-upload", upload.single("file"), async (req, res) => {
  let extractedText = "";

  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded." });
    }

    const filePath = req.file.path;
    const originalName = req.file.originalname.toLowerCase();

    if (originalName.endsWith(".txt")) {
      extractedText = await fs.readFile(filePath, "utf8");
    } else if (originalName.endsWith(".pdf")) {
      const fileBuffer = await fs.readFile(filePath);
      const parsed = await pdf(fileBuffer);
      extractedText = parsed.text || "";
    } else if (originalName.endsWith(".docx")) {
      const result = await mammoth.extractRawText({ path: filePath });
      extractedText = result.value || "";
    } else if (
      originalName.endsWith(".jpg") ||
      originalName.endsWith(".jpeg") ||
      originalName.endsWith(".png")
    ) {
      const fileBuffer = await fs.readFile(filePath);
      const base64 = fileBuffer.toString("base64");
      const mimeType = originalName.endsWith(".png") ? "image/png" : "image/jpeg";

      const visionResponse = await client.responses.create({
        model: "gpt-4.1",
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: "Extract all readable and useful text from this image. Return only the extracted text."
              },
              {
                type: "input_image",
                image_url: `data:${mimeType};base64,${base64}`
              }
            ]
          }
        ]
      });

      extractedText = visionResponse.output_text || "";
    } else {
      return res.status(400).json({ error: "Unsupported file type. Use PDF, DOCX, TXT, JPG, or PNG." });
    }

    try {
      await fs.unlink(filePath);
    } catch {}

    res.json({
      extractedText: extractedText.trim()
    });
  } catch (error) {
    console.error("Parse upload error:", error);

    if (req.file?.path) {
      try {
        await fs.unlink(req.file.path);
      } catch {}
    }

    res.status(500).json({ error: "Failed to parse uploaded file." });
  }
});

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`FormatFlow server running on http://localhost:${PORT}`);
});
