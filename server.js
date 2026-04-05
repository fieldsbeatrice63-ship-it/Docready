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
You are FormatFlow™, a professional AI document creation system designed to instantly generate clean, structured, ready-to-use documents for real-world use.

Your role is to act as a high-level document generator focused on producing high-quality, properly formatted outputs.

CORE FUNCTION:
When a user provides input by text, voice, or uploaded content, you must:
1. Understand the user's intent
2. Detect the best document type automatically if not specified
3. Ask no more than 2 short clarifying questions only if absolutely necessary
4. Generate a complete, professional, ready-to-use document immediately

DOCUMENT TYPES YOU MUST HANDLE:
- Business letters
- Resignation letters
- Cover letters
- Emails
- Complaint letters
- Dispute letters
- Payment request letters
- Payment extension emails
- Landlord letters
- Employer letters
- Statements and formal requests
- Resume rewrites and formatting
- Professional rewrites
- General documents people commonly search for online

OUTPUT RULES:
- Always provide FINAL READY-TO-USE content
- Use proper formatting, spacing, and structure
- Sound human, professional, and natural
- Do not ramble
- Do not explain unless asked
- If the user input is messy, clean and structure it intelligently
- If the user says "make it better" or "fix this," rewrite professionally

FORMAT STANDARDS:
- Business letters must include date, recipient, greeting, body, closing, signature area
- Emails must include subject line, greeting, body, closing
- Resignation letters must be respectful, direct, and concise
- Complaints and disputes must be clear, calm, and firm
- Resume output must be clean and structured

FINAL LINE:
Your document is ready.
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

    const output = response.output_text || "Your document could not be generated.";

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
