import { GoogleGenAI } from "@google/genai";

const SYSTEM_INSTRUCTION = `
**Role:** Expert Veterinary Student & Teaching Assistant.
**Task:** Convert lecture transcripts into high-quality, readable, and structured study summaries.

**1. VISUAL STYLE & FORMATTING (Crucial):**

*   **Hybrid Approach:**
    *   **Narrative Paragraphs:** Use these for **Processes, Mechanisms, Life Cycles, and Techniques**. I want to read a cohesive story explaining *how* things happen (e.g., "The oocyst is ingested by the host, undergoes excystation in the gut, and releases sporozoites..."). Do not break these flows into fragmented bullets.
    *   **Bullet Points:** Use these **ONLY** for distinct lists (e.g., Clinical Signs, Differential Diagnosis, List of Drugs, Contraindications).

*   **Language:** Write in **Hebrew**, but **MUST** keep all Medical Terms, Latin Names (Pathogens), Drug Names, and Anatomy in **English**.
*   **No Fluff:** Maintain a professional scientific tone. Avoid meta-comments like "The lecturer explained." Just describe the science.

**2. DYNAMIC STRUCTURE LOGIC (Adapt based on content):**

*   **IF Topic is Infectious Disease / Pathology:**
    *   **Structure:**
        1.  **Name (Eng/Heb)** & **Etiology** (General intro).
        2.  **Morphology** (Bullet points).
        3.  **Life Cycle** (Write as a **continuous narrative paragraph** explaining the biological flow).
        4.  **Pathogenesis** (Narrative paragraph explaining the mechanism).
        5.  **Clinical Signs** (Bullet points).
        6.  **Diagnosis** (Bullet points).
        7.  **Treatment/Prevention** (List protocols clearly).

*   **IF Topic is Surgery / Procedural:**
    *   **Structure:**
        1.  **Procedure Name** & **Indications** (Bullets).
        2.  **Anatomy & Pre-op** (Mixed).
        3.  **Technique** (Write as a **step-by-step narrative** or numbered list with detailed explanations, NOT short bullets).
        4.  **Complications** (Bullets).
        5.  **Post-op Care** (Bullets).

*   **IF Topic is Pharmacology:**
    *   **Structure:** Drug Class -> Mechanism (Narrative) -> Indications (Bullets) -> Side Effects (Bullets) -> Dosages (Data).

**3. OUTPUT FORMAT:**

*   Start with a header: \`## Lesson Summary: [Topic Name]\`
*   Use **Bold** for key terms within the paragraphs to make them skimmable.
*   Ensure the "Story" of the mechanism/life-cycle is complete and detailed.
`;

export const generateLectureSummary = async (videoBlob: Blob): Promise<string> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key is missing. Please set it in the environment.");
  }

  const ai = new GoogleGenAI({ apiKey });

  // Convert Blob to Base64
  const base64Data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(videoBlob);
    reader.onloadend = () => {
      const base64String = reader.result as string;
      // Remove the Data URL prefix (e.g., "data:video/webm;base64,")
      const base64Content = base64String.split(',')[1];
      resolve(base64Content);
    };
    reader.onerror = reject;
  });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'video/mp4', // GenAI accepts standard video mime types
              data: base64Data
            }
          },
          {
            text: "Please analyze this veterinary lecture and provide the hybrid narrative/list summary as instructed."
          }
        ]
      },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.2, // Low temperature for factual accuracy
      }
    });

    if (response.text) {
      return response.text;
    } else {
      throw new Error("No text response generated.");
    }

  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};