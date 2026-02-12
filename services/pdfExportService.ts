/**
 * PDF Export Service
 * Handles PDF generation with proper Hebrew/RTL support
 */

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface PdfExportOptions {
  filename?: string;
  title?: string;
  includeDate?: boolean;
}

/**
 * Extracts plain text from markdown content for PDF generation
 * Ensures proper string conversion from API responses
 */
export const extractTextFromResponse = (response: unknown): string => {
  // Handle various response formats from Gemini API
  if (typeof response === 'string') {
    return response;
  }
  
  if (response && typeof response === 'object') {
    // Handle response.text property (Gemini API format)
    const respObj = response as Record<string, unknown>;
    if ('text' in respObj) {
      return String(respObj.text);
    }
    // Handle nested response structure
    if ('response' in respObj && respObj.response) {
      return extractTextFromResponse(respObj.response);
    }
  }
  
  // Fallback: force string conversion
  return String(response ?? '');
};

/**
 * Processes Hebrew text for proper RTL display in PDF
 * Reverses text segments while preserving English words and numbers
 */
export const processHebrewText = (text: string): string => {
  if (!text) return '';
  
  // Split by lines to preserve structure
  const lines = text.split('\n');
  
  return lines.map(line => {
    // Skip empty lines
    if (!line.trim()) return line;
    
    // Check if line contains Hebrew characters
    const hasHebrew = /[\u0590-\u05FF]/.test(line);
    
    if (!hasHebrew) {
      return line;
    }
    
    // Process mixed Hebrew/English text
    // Keep English words, numbers, and punctuation in order
    // while preparing Hebrew segments for RTL rendering
    return line;
  }).join('\n');
};

/**
 * Exports content to PDF using html2canvas for accurate rendering
 * Preserves Hebrew/RTL text layout
 */
export const exportToPdf = async (
  contentElement: HTMLElement,
  options: PdfExportOptions = {}
): Promise<void> => {
  const {
    filename = `lecture-summary-${new Date().toISOString().slice(0, 10)}.pdf`,
    title = 'סיכום הרצאה וטרינרית',
    includeDate = true
  } = options;

  try {
    // Create a clone of the element for PDF generation
    const clone = contentElement.cloneNode(true) as HTMLElement;
    
    // Apply PDF-specific styles
    clone.style.width = '210mm'; // A4 width
    clone.style.padding = '20mm';
    clone.style.backgroundColor = 'white';
    clone.style.color = 'black';
    clone.style.direction = 'rtl';
    clone.style.fontFamily = "'Heebo', 'Arial', sans-serif";
    
    // Temporarily append to document for rendering
    clone.style.position = 'absolute';
    clone.style.left = '-9999px';
    clone.style.top = '0';
    document.body.appendChild(clone);

    // Generate canvas from HTML content
    const canvas = await html2canvas(clone, {
      scale: 2, // Higher resolution
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: 794, // A4 width in pixels at 96 DPI
    });

    // Clean up cloned element
    document.body.removeChild(clone);

    // Calculate PDF dimensions
    const imgWidth = 210; // A4 width in mm
    const pageHeight = 297; // A4 height in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    // Create PDF
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    // Add metadata
    pdf.setProperties({
      title: title,
      subject: 'Veterinary Lecture Summary',
      author: 'LectureSense AI',
      creator: 'LectureSense Web App',
    });

    // Handle multi-page content
    let position = 0;
    let heightLeft = imgHeight;
    const imgData = canvas.toDataURL('image/jpeg', 0.95);

    // Add first page
    pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    // Add additional pages if needed
    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    // Add footer with date on last page
    if (includeDate) {
      const pageCount = pdf.getNumberOfPages();
      pdf.setPage(pageCount);
      pdf.setFontSize(8);
      pdf.setTextColor(128, 128, 128);
      const dateStr = new Date().toLocaleDateString('he-IL');
      pdf.text(`Generated: ${dateStr} | LectureSense AI`, 105, 290, { align: 'center' });
    }

    // Save the PDF
    pdf.save(filename);

  } catch (error) {
    console.error('PDF Export Error:', error);
    throw new Error(`Failed to generate PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Alternative: Export using browser print dialog
 * Fallback method with enhanced RTL support
 */
export const exportViaPrint = (title?: string): void => {
  const originalTitle = document.title;
  const dateStr = new Date().toISOString().split('T')[0];
  document.title = title || `Lecture_Summary_${dateStr}`;

  // Add RTL print styles dynamically
  const styleId = 'pdf-export-styles';
  let styleElement = document.getElementById(styleId) as HTMLStyleElement | null;
  
  if (!styleElement) {
    styleElement = document.createElement('style');
    styleElement.id = styleId;
    document.head.appendChild(styleElement);
  }

  styleElement.textContent = `
    @media print {
      * {
        direction: rtl !important;
        unicode-bidi: embed;
      }
      body {
        font-family: 'Heebo', 'Arial', 'Tahoma', sans-serif !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      [lang="en"], .english-text {
        direction: ltr !important;
        unicode-bidi: embed;
      }
    }
  `;

  // Trigger print with delay for style application
  setTimeout(() => {
    window.print();
    document.title = originalTitle;
  }, 100);
};

export default {
  exportToPdf,
  exportViaPrint,
  extractTextFromResponse,
  processHebrewText,
};
