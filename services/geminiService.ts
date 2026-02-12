/**
 * Gemini AI Service
 * Handles communication with Google Gemini API for lecture summarization
 * 
 * Features:
 * - Non-blocking async operations
 * - Proper error handling and retries
 * - Safe text extraction from API responses
 * - Configurable system prompts
 */

import { GoogleGenAI } from '@google/genai';

// === Configuration ===

const DEFAULT_MODEL = 'gemini-3-pro-preview';
const DEFAULT_TEMPERATURE = 0.2;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

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

// === Types ===

export interface GeminiServiceConfig {
  apiKey?: string;
  model?: string;
  temperature?: number;
  maxRetries?: number;
}

export interface ProgressCallback {
  (status: 'uploading' | 'processing' | 'complete', progress?: number): void;
}

// === Helper Functions ===

/**
 * Safely extract text from Gemini API response
 * Handles various response formats and ensures string output
 */
export const extractResponseText = (response: unknown): string => {
  if (!response) {
    throw new Error('Empty response from API');
  }

  // Direct string response
  if (typeof response === 'string') {
    return response;
  }

  // Object with text property
  if (typeof response === 'object' && response !== null) {
    const resp = response as Record<string, unknown>;
    
    // Standard response.text format
    if ('text' in resp && resp.text !== undefined) {
      return String(resp.text);
    }
    
    // Nested response structure
    if ('response' in resp && resp.response) {
      return extractResponseText(resp.response);
    }

    // Try candidates array (some API versions)
    if ('candidates' in resp && Array.isArray(resp.candidates)) {
      const candidate = resp.candidates[0];
      if (candidate?.content?.parts?.[0]?.text) {
        return String(candidate.content.parts[0].text);
      }
    }
  }

  // Fallback: force string conversion
  const forcedString = String(response);
  if (forcedString === '[object Object]') {
    throw new Error('Unable to extract text from API response');
  }
  
  return forcedString;
};

/**
 * Convert Blob to Base64 string
 * Uses FileReader API for non-blocking conversion
 */
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onloadend = () => {
      try {
        const base64String = reader.result as string;
        // Remove Data URL prefix (e.g., "data:video/webm;base64,")
        const base64Content = base64String.split(',')[1];
        if (!base64Content) {
          reject(new Error('Failed to extract base64 content'));
          return;
        }
        resolve(base64Content);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read blob data'));
    };
    
    reader.readAsDataURL(blob);
  });
};

/**
 * Sleep utility for retry delays
 */
const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Get API key from environment
 */
const getApiKey = (): string => {
  const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'API Key is missing. Please set GEMINI_API_KEY in your environment.'
    );
  }
  return apiKey;
};

// === Main Service Functions ===

/**
 * Generate lecture summary from video blob
 * 
 * @param videoBlob - The recorded video blob
 * @param config - Optional configuration overrides
 * @param onProgress - Optional progress callback
 * @returns Promise<string> - The generated summary text
 */
export const generateLectureSummary = async (
  videoBlob: Blob,
  config: GeminiServiceConfig = {},
  onProgress?: ProgressCallback
): Promise<string> => {
  const {
    apiKey = getApiKey(),
    model = DEFAULT_MODEL,
    temperature = DEFAULT_TEMPERATURE,
    maxRetries = MAX_RETRIES,
  } = config;

  const ai = new GoogleGenAI({ apiKey });

  // Convert blob to base64
  onProgress?.('uploading', 0);
  const base64Data = await blobToBase64(videoBlob);
  onProgress?.('uploading', 100);

  // Attempt API call with retries
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      onProgress?.('processing', (attempt / (maxRetries + 1)) * 100);

      const response = await ai.models.generateContent({
        model,
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: 'video/mp4',
                data: base64Data,
              },
            },
            {
              text: 'Please analyze this veterinary lecture and provide the hybrid narrative/list summary as instructed.',
            },
          ],
        },
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          temperature,
        },
      });

      // Extract text safely using our helper function
      const text = extractResponseText(response);
      
      if (!text || text.trim().length === 0) {
        throw new Error('Empty response from Gemini API');
      }

      onProgress?.('complete', 100);
      return text;

    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(
        `Gemini API attempt ${attempt + 1}/${maxRetries + 1} failed:`,
        lastError.message
      );

      // Don't retry on authentication errors
      if (lastError.message.includes('API Key') || 
          lastError.message.includes('401') ||
          lastError.message.includes('403')) {
        break;
      }

      // Wait before retry
      if (attempt < maxRetries) {
        await sleep(RETRY_DELAY_MS * (attempt + 1));
      }
    }
  }

  // All retries exhausted
  console.error('Gemini API Error (all retries failed):', lastError);
  throw lastError || new Error('Unknown error during API call');
};

/**
 * Validate API key without making a full request
 */
export const validateApiKey = async (): Promise<boolean> => {
  try {
    const apiKey = getApiKey();
    // Basic validation - check key format
    return apiKey.length > 20;
  } catch {
    return false;
  }
};

export default {
  generateLectureSummary,
  extractResponseText,
  validateApiKey,
};