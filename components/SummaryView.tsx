import React, { useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Download, ArrowLeft, Printer } from 'lucide-react';

interface SummaryViewProps {
  summary: string;
  onReset: () => void;
}

export const SummaryView: React.FC<SummaryViewProps> = ({ summary, onReset }) => {
  
  // Ensure we are scrolled to top when view opens
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const handlePdfExport = () => {
    // 1. Set title for PDF filename
    const originalTitle = document.title;
    const dateStr = new Date().toISOString().split('T')[0];
    document.title = `Lecture_Summary_${dateStr}`;

    // 2. Trigger print (which allows "Save as PDF")
    // The timeout allows the UI to update/render if needed before the dialog freezes the main thread
    setTimeout(() => {
      window.print();
      // Restore title after dialog closes
      document.title = originalTitle;
    }, 100);
  };

  const handleDownloadMarkdown = () => {
    const blob = new Blob([summary], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lecture-summary-${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full min-h-screen flex flex-col items-center bg-gray-900 pb-12">
       <style>{`
        @media print {
          @page {
            margin: 15mm;
            size: A4;
          }
          html, body {
            height: auto !important;
            min-height: 100% !important;
            overflow: visible !important;
            background-color: white !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          body {
            color: black !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          #root {
            display: block !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
          }
          /* Hide all non-content elements */
          .no-print {
            display: none !important;
          }
          /* Ensure text wrapping and prevent awkward breaks */
          p, li, h1, h2, h3 {
            page-break-inside: avoid;
          }
          /* Hide the fixed header placeholder in print */
          .print-header-spacer {
            display: none;
          }
        }
      `}</style>

      {/* Header - Fixed to ensure it's always clickable and on top */}
      <div className="fixed top-0 left-0 right-0 z-50 w-full bg-gray-900/95 backdrop-blur border-b border-gray-800 no-print shadow-md">
        <div className="max-w-4xl mx-auto px-6 py-4 flex justify-between items-center">
          <button 
            type="button"
            onClick={onReset}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors cursor-pointer group"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span>Back to Recorder</span>
          </button>
          <div className="flex gap-4">
             <button
              type="button"
              onClick={handleDownloadMarkdown}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg font-medium transition-colors border border-gray-700 cursor-pointer"
              title="Download raw text file"
            >
              <Download className="w-4 h-4" />
              <span>Save Text</span>
            </button>
             <button
              type="button"
              onClick={handlePdfExport}
              className="flex items-center gap-2 px-6 py-2 bg-vet-600 hover:bg-vet-500 text-white rounded-lg font-medium transition-colors shadow-lg cursor-pointer hover:shadow-vet-500/20"
              title="Open Print Dialog to Save as PDF"
            >
              <Printer className="w-4 h-4" />
              <span>Print / PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* Spacer for Fixed Header */}
      <div className="h-24 w-full print-header-spacer"></div>

      {/* Content Area - Designed for both Screen and Print */}
      <div className="w-full max-w-4xl px-6 flex-grow print:p-0 print:max-w-none print:w-full">
        <div className="bg-white text-gray-900 rounded-xl shadow-2xl print:shadow-none print:rounded-none print:border-none print:m-0 h-full overflow-hidden">
          {/* Print Header */}
          <div className="bg-vet-900 text-white p-8 print:bg-white print:text-black print:p-0 print:mb-6 print:border-b-2 print:border-black">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-3xl font-bold mb-2 text-vet-100 print:text-black">סיכום הרצאה וטרינרית</h1>
                <p className="opacity-80 print:opacity-100 text-vet-300 print:text-gray-600">LectureSense AI Analysis</p>
              </div>
              <div className="text-left text-sm opacity-60 print:opacity-100 print:text-gray-600">
                <p>{new Date().toLocaleDateString('he-IL')}</p>
                <p>Generated by Gemini 3 Pro</p>
              </div>
            </div>
          </div>

          {/* Markdown Content */}
          <div className="p-8 print:p-0 text-lg leading-relaxed text-right print:text-black" dir="rtl">
            <article className="prose prose-lg max-w-none prose-headings:text-vet-800 prose-p:text-gray-800 prose-strong:text-vet-900 print:prose-headings:text-black print:prose-p:text-black print:prose-strong:text-black print:prose-li:text-black">
               <ReactMarkdown>{summary}</ReactMarkdown>
            </article>
          </div>
          
          {/* Footer */}
          <div className="bg-gray-50 p-6 text-center text-gray-500 text-sm print:hidden rounded-b-xl border-t border-gray-100">
            Generated automatically by LectureSense. Verify all medical details with original source material.
          </div>
        </div>
      </div>
    </div>
  );
};