import React, { useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Download, ArrowLeft, FileCode, AlertTriangle } from 'lucide-react';

interface SummaryViewProps {
  summary: string;
  onReset: () => void;
}

export const SummaryView: React.FC<SummaryViewProps> = ({ summary, onReset }) => {
  
  // DEBUG: Validate text content on mount
  useEffect(() => {
    if (typeof summary === 'string') {
        console.log(`DEBUG: View loaded with text length: ${summary.length}`);
    } else {
        console.error("CRITICAL ERROR: Summary is not a string:", summary);
    }
    window.scrollTo(0, 0);
  }, [summary]);

  const getSafeText = (content: any): string => {
      if (typeof content === 'string') return content;
      if (typeof content === 'object' && content !== null) {
          return content.text || JSON.stringify(content);
      }
      return String(content || "");
  };

  const safeSummary = getSafeText(summary);

  const handleHtmlExport = () => {
    // 1. Get the rendered HTML content directly from the DOM to ensure exact formatting matches
    const contentElement = document.getElementById('markdown-container');
    const renderedContent = contentElement ? contentElement.innerHTML : '';
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `Lecture_Summary_${dateStr}.html`;

    // 2. Construct the full HTML5 document with embedded CSS and Metadata
    const htmlDocument = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LectureSense Summary - ${dateStr}</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: #ffffff;
            color: #1f2937;
            line-height: 1.6;
            max-width: 800px;
            margin: 2rem auto;
            padding: 2rem;
            box-shadow: 0 0 20px rgba(0,0,0,0.05);
            border-radius: 8px;
        }
        
        /* Typography & Layout */
        h1, h2, h3, h4, h5, h6 {
            color: #111827;
            margin-top: 1.5em;
            margin-bottom: 0.5em;
            font-weight: 700;
        }
        h1 { font-size: 2.25rem; border-bottom: 2px solid #e5e7eb; padding-bottom: 0.5rem; margin-top: 0; }
        h2 { font-size: 1.75rem; }
        h3 { font-size: 1.5rem; }
        
        p { margin-bottom: 1rem; }
        
        /* Lists */
        ul, ol {
            margin-bottom: 1rem;
            padding-right: 1.5rem; /* Right padding for RTL */
        }
        li { margin-bottom: 0.25rem; }
        
        /* Code & Emphasis */
        strong { color: #000; }
        code {
            background-color: #f3f4f6;
            padding: 0.2rem 0.4rem;
            border-radius: 4px;
            font-family: monospace;
            font-size: 0.9em;
        }
        
        /* Header Info */
        .meta-header {
            text-align: center;
            color: #6b7280;
            margin-bottom: 3rem;
            padding-bottom: 1rem;
            border-bottom: 1px solid #e5e7eb;
            font-size: 0.9rem;
        }
        .meta-header h1 {
            border: none;
            margin-bottom: 0.25rem;
            color: #456f7d; /* Vet Blue */
        }
    </style>
</head>
<body>
    <div class="meta-header">
        <h1>סיכום הרצאה וטרינרית</h1>
        <p>LectureSense AI Companion • ${new Date().toLocaleDateString('he-IL')}</p>
    </div>
    
    <!-- Rendered Content -->
    ${renderedContent}

    <script>
        // Auto-print option just in case they want it later
        // window.print(); 
    </script>
</body>
</html>`;

    // 3. Create Blob and trigger download
    const blob = new Blob([htmlDocument], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadMarkdown = () => {
    const blob = new Blob([safeSummary], { type: 'text/markdown;charset=utf-8' });
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
      {/* Header - Fixed to ensure it's always clickable and on top */}
      <div className="fixed top-0 left-0 right-0 z-50 w-full bg-gray-900/95 backdrop-blur border-b border-gray-800 shadow-md">
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
              <span>Save MD</span>
            </button>
             <button
              type="button"
              onClick={handleHtmlExport}
              className="flex items-center gap-2 px-6 py-2 bg-vet-600 hover:bg-vet-500 text-white rounded-lg font-medium transition-colors shadow-lg cursor-pointer hover:shadow-vet-500/20"
              title="Save formatted HTML file (Opens in browser)"
            >
              <FileCode className="w-4 h-4" />
              <span>Save as HTML</span>
            </button>
          </div>
        </div>
      </div>

      {/* Spacer for Fixed Header */}
      <div className="h-24 w-full"></div>

      {/* Content Area */}
      <div className="w-full max-w-4xl px-6 flex-grow">
        <div className="bg-white text-gray-900 rounded-xl shadow-2xl h-full overflow-hidden">
          
          {/* Validation Warning */}
          {safeSummary.length === 0 && (
             <div className="bg-red-50 text-red-600 p-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                <span>Error: No summary text available to display.</span>
             </div>
          )}

          {/* View Header */}
          <div className="bg-vet-900 text-white p-8">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-3xl font-bold mb-2 text-vet-100">סיכום הרצאה וטרינרית</h1>
                <p className="opacity-80 text-vet-300">LectureSense AI Analysis</p>
              </div>
              <div className="text-left text-sm opacity-60">
                <p>{new Date().toLocaleDateString('he-IL')}</p>
                <p>Generated by Gemini 3 Pro</p>
              </div>
            </div>
          </div>

          {/* Markdown Content - ID added for extraction */}
          <div className="p-8 text-lg leading-relaxed text-right" dir="rtl">
            <article id="markdown-container" className="prose prose-lg max-w-none prose-headings:text-vet-800 prose-p:text-gray-800 prose-strong:text-vet-900">
               <ReactMarkdown>{safeSummary}</ReactMarkdown>
            </article>
          </div>
          
          {/* Footer */}
          <div className="bg-gray-50 p-6 text-center text-gray-500 text-sm rounded-b-xl border-t border-gray-100">
            Generated automatically by LectureSense. Verify all medical details with original source material.
          </div>
        </div>
      </div>
    </div>
  );
};