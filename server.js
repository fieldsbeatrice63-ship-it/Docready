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
* Use sophisticated, high-level, and industry-appropriate vocabulary where it enhances clarity and professionalism
* Avoid basic, repetitive, or elementary wording
* Language should reflect real-world executive, corporate, academic, or professional communication standards
* Maintain clarity while elevating tone — do not overcomplicate or distort meaning


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
* Ensure vocabulary reflects professional credibility and real-world application
* Do not downgrade tone to casual or conversational language

PERSONAL DATA PROTECTION RULE:
- Never invent, assume, autofill, or generate personal details that the user did not explicitly provide.
- This includes but is not limited to full names, mailing addresses, email addresses, phone numbers, dates of birth, employers, schools, job titles, company names, and license numbers.
- If a document requires personal details that are missing, leave a clear placeholder such as [Full Name], [Address], [Phone Number], [Email Address], [Employer], or [School Name].
- Do not replace placeholders with fictional or guessed information.
- For resumes, cover letters, applications, and profile-based documents, only use the facts the user actually provided.
- If the user asks for a resume or similar document without enough information, provide a structured professional draft with placeholders instead of made-up details.

CORE OBJECTIVE:
Every document must sound like it was written by someone who is articulate, composed under pressure, and fully aware of professional standards and expectations.
- All documents must be formatted using the highest professional standards, ensuring proper structure, spacing, and clarity.
- All language must remain accurate, authoritative, and professionally written at all times.
- Every document should reflect strong, confident, and well-structured communication appropriate for official, legal, financial, or professional use.
The result should feel credible, respected, and taken seriously in any workplace or formal setting.

`;


app.use(cors());
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(process.cwd(), "public")));
function getDocumentFormattingInstruction(docType, template) {
  const type = (docType || "").toLowerCase();
  const selectedTemplate = (template || "").toLowerCase();

  if (type === "resume") {
    return `
Format this as a professional resume.
- Place the candidate name at the top if provided
- Include contact information directly under the name if provided
- Structure the document with clear sections such as Professional Summary, Experience, Skills, and Education
- Use concise, achievement-oriented bullet points where appropriate
- Do not format this like an essay, letter, or paragraph-only document
- Ensure the structure is resume-specific and professionally organized
- Apply the selected template style: ${selectedTemplate || "resume-classic"}
`;
  }

  if (type === "cover-letter") {
    return `
Format this as a professional cover letter.
- Use a formal business-letter structure
- Include an opening, body, and closing
- Maintain a refined, persuasive, and professional tone
- Do not format this like a resume or essay
- Apply the selected template style: ${selectedTemplate || "general-professional"}
`;
  }

  if (type === "resignation-letter") {
    return `
Format this as a formal resignation letter.
- Use a clean business-letter structure
- State the resignation clearly and professionally
- Keep the tone composed, firm, and respectful
- Do not format this like a resume or essay
- Apply the selected template style: ${selectedTemplate || "business-formal"}
`;
  }

  if (type === "legal") {
    return `
Format this as a legal-style professional document.
- Use a formal heading and clean paragraph structure
- Maintain precise, controlled, professional language
- Present terms, dates, parties, and purpose clearly if provided
- Do not format this like a resume or essay
- Apply the selected template style: ${selectedTemplate || "legal-standard"}
`;
  }

  if (type === "business") {
    return `
Format this as a professional business document.
- Use strong headings where appropriate
- Maintain executive-level clarity and structure
- Present the message in a polished, business-ready form
- Do not format this like a resume or essay
- Apply the selected template style: ${selectedTemplate || "business-formal"}
`;
  }

  if (type === "essay") {
    return `
Format this as a professional essay.
- Do NOT format it like a resume
- Do NOT place resume headings such as Skills, Experience, or Education
- Begin with a proper essay title if appropriate
- Use clean paragraph structure and natural academic flow
- Maintain a polished, intelligent, professional tone
- Ensure the body begins like an essay, not like a resume or business letter
- Apply the selected template style: ${selectedTemplate || "essay-standard"}
`;
  }

  if (type === "ebook") {
    return `
Format this as a professional eBook or written content document.
- Do NOT format it like a resume
- Use a clear title and organized section headings or chapters where appropriate
- Maintain clean paragraph spacing and polished long-form structure
- Use refined, engaging, intelligent wording
- Apply the selected template style: ${selectedTemplate || "ebook-clean"}
`;
  }

  if (type === "other") {
    return `
Format this as a general professional document.
- Determine the most appropriate professional structure based on the provided content
- Maintain a polished, organized, professional format
- Do not default to resume formatting unless the content clearly indicates a resume
- Apply the selected template style: ${selectedTemplate || "general-professional"}
`;
  }

  return `
Format this as a professional document using the most appropriate structure for the content provided.
Do not default to resume formatting unless the content clearly requires it.
Apply the selected template style: ${selectedTemplate || "general-professional"}
`;
}
app.post("/api/generate-document", async (req, res) => {
  try {
    const { content, docType, template } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: "Content is required." });
    }

    const formattingInstruction = getDocumentFormattingInstruction(docType, template);

    const response = await client.responses.create({
      model: "gpt-4.1",
      input: [
        {
          role: "system",
          content: FORMATFLOW_SYSTEM_PROMPT
        },
        {
          role: "user",
          content: `
Document Type: ${docType || "general professional document"}
Template: ${template || "general-professional"}

Formatting Instructions:
${formattingInstruction}

Source Content:
${content}
`
        }
      ]
    });

    let output = response.output_text || "";

   
    res.json({ output });
  } catch (error) {
    console.error("Generate error:", error);
    res.status(500).json({ error: "Server error generating document." });
  }
});
app.post("/api/rewrite-document", async (req, res) => {
  try {
    const { content, type } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: "Content is required." });
    }

   let instruction = "";

if (type === "professional") {
  instruction = `Rewrite this document with stronger, more sophisticated, and highly professional language.

Correct all grammar, spelling, and sentence structure while maintaining a polished, authoritative, and professional tone.

Enhance clarity, improve flow, and refine sentence structure to ensure the document reads smoothly and confidently.

Expand the document where appropriate to add depth, precision, and professional strength.

Condense any unnecessary wording while keeping the message clear, impactful, and direct.
- If a specific recipient name, company, bureau, landlord, lender, employer, or department is provided, replace generic salutations such as "To Whom It May Concern" with a more specific and professional salutation when appropriate.
- Avoid generic openings when the document already contains enough recipient information to support a more direct greeting.

IMPORTANT STRUCTURE RULES:
- Preserve ALL header and identifying lines exactly as written.
- Do NOT remove or alter the sender name, sender address, city/state/zip, date, recipient name, recipient address, subject line, reference line, account number, or signature name.
- Maintain the original document formatting, spacing, and line structure.
- Only improve the wording of the body paragraphs.
- Return the FULL document, not just the rewritten portion.
- Do not omit, replace, or relocate any personal or reference information.
- If a specific recipient name, company, bureau, landlord, lender, employer, or department is provided, replace generic salutations such as "To Whom It May Concern" with a more specific and professional salutation when appropriate.
- Avoid generic openings when the document already contains enough recipient information to support a more direct greeting.
- All documents must be formatted using the highest professional standards, ensuring proper structure, spacing, and clarity.
- All language must remain accurate, authoritative, and professionally written at all times.
- Every document should reflect strong, confident, and well-structured communication appropriate for official, legal, financial, or professional use.
- If a specific recipient name, company, bureau, landlord, lender, employer, or department is provided, use a direct and professional salutation instead of "To Whom It May Concern" when appropriate.
- Use "To Whom It May Concern" only when no specific recipient information is available.
`;

  
} else if (type === "grammar") {
  instruction = `Correct all grammar, spelling, and sentence structure errors while maintaining a professional tone.

Do not change the meaning of the content.

Preserve all names, addresses, and formatting exactly as written.`;

} else if (type === "expand") {
  instruction = `Expand this document with more detail, clarity, and professional depth.

Add supporting language where needed to strengthen the message.

Preserve all names, addresses, and formatting exactly as written.`;

} else if (type === "shorten") {
  instruction = `Condense this document while keeping it clear, professional, and impactful.

Remove unnecessary or repetitive wording while preserving the core message.

Preserve all names, addresses, and formatting exactly as written.`;
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
          content: `${instruction}\n\n${content}`
        }
      ]
    });

   
    let output = response.output_text || "";

   
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


const DESTINATION_MAP = {
  experian: {
    name: "Experian",
    address: "P.O. Box 4500, Allen, TX 75013"
  },
  equifax: {
    name: "Equifax",
    address: "P.O. Box 740256, Atlanta, GA 30374"
  },
  transunion: {
    name: "TransUnion",
    address: "P.O. Box 2000, Chester, PA 19016"
  }
};
app.post("/api/send-verify", async (req, res) => {
  try {
  const {
  document,
  docType,
  senderName,
  senderEmail,
  recipientName,
  recipientEmail,
  deliveryNote,
  deliveryType,
  destinationType,   // NEW
  customAddress      // NEW
} = req.body;
    if (!document || !document.trim()) {
      return res.status(400).json({ error: "Document is required." });
    }
let resolvedRecipient = "";
let resolvedAddress = "";

if (destinationType && DESTINATION_MAP[destinationType]) {
  resolvedRecipient = DESTINATION_MAP[destinationType].name;
  resolvedAddress = DESTINATION_MAP[destinationType].address;
} else if (destinationType === "custom") {
  resolvedRecipient = recipientName || "Custom Recipient";
  resolvedAddress = customAddress || "";
} else {
  resolvedRecipient = recipientName || "Unknown Recipient";
  resolvedAddress = "";
}
    let deliveryMethod = "standard";

if (safeDeliveryType === "certified") {
  deliveryMethod = "certified";
}
     const verificationId = "VFY-" + Date.now();
    const deliveryJob = {
  deliveryId: "DLV-" + Date.now(),
  method: deliveryMethod,
  recipient: resolvedRecipient,
  address: resolvedAddress,
  status: "queued",
  createdAt: new Date().toISOString()
};
    const receipt = {
  verificationId,
  deliveryId: deliveryJob.deliveryId,
  timestamp: new Date().toISOString(),
  docType: docType || "general document",
  senderName: senderName || "",
  senderEmail: senderEmail || "",
  recipientName: resolvedRecipient,
  recipientAddress: resolvedAddress,
  deliveryType: deliveryMethod,
  deliveryNote: deliveryNote || "",
  status: "Delivery queued"
};
   

   
   return res.json({
  success: true,
  receipt,
  deliveryJob
});

} catch (error) {
  console.error("Send Verify Error:", error);

  return res.status(500).json({
    error: "Send Verify failed",
    message: "An error occurred while processing delivery"
  });
}
app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`FormatFlow server running on http://localhost:${PORT}`);
});
