import React, { useState } from "react";
import { Image as ImageIcon, Maximize2, X } from "lucide-react";

interface RichQuestionTextProps {
  text: string;
  diagramUrl?: string | null;
  className?: string;
}

export const RichQuestionText: React.FC<RichQuestionTextProps> = ({
  text,
  diagramUrl,
  className = "",
}) => {
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  // Extract embedded markdown images: ![alt](url)
  const imageRegex = /!\[([^\]]*)\]\((data:image\/[^;]+;base64,[^)]+|https?:\/\/[^)]+)\)/g;

  const parts: Array<{ type: "text" | "image"; content: string; alt?: string }> = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = imageRegex.exec(text)) !== null) {
    const textBefore = text.slice(lastIndex, match.index).trim();
    if (textBefore) {
      parts.push({ type: "text", content: textBefore });
    }
    parts.push({ type: "image", content: match[2], alt: match[1] || "Figure / Diagram" });
    lastIndex = match.index + match[0].length;
  }

  const textAfter = text.slice(lastIndex).trim();
  if (textAfter) {
    parts.push({ type: "text", content: textAfter });
  }

  // If diagramUrl was passed separately and wasn't embedded in the text
  const hasEmbeddedDiagram = parts.some((p) => p.type === "image");
  const showStandaloneDiagram = diagramUrl && !hasEmbeddedDiagram;

  return (
    <div className={`space-y-3 ${className}`}>
      {parts.length === 0 && !showStandaloneDiagram && (
        <div className="whitespace-pre-wrap leading-relaxed">{text}</div>
      )}

      {parts.map((part, idx) => {
        if (part.type === "text") {
          return (
            <div key={idx} className="whitespace-pre-wrap leading-relaxed">
              {part.content}
            </div>
          );
        }

        return (
          <div key={idx} className="my-3 group relative inline-block max-w-full">
            <div className="p-2.5 rounded-2xl bg-slate-900 border border-slate-700/80 shadow-lg inline-block">
              <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-slate-800 text-[11px] text-slate-400">
                <span className="flex items-center gap-1 font-semibold text-indigo-400">
                  <ImageIcon className="w-3.5 h-3.5" />
                  {part.alt || "Question Diagram"}
                </span>
                <button
                  type="button"
                  onClick={() => setZoomedImage(part.content)}
                  className="hover:text-white flex items-center gap-0.5 text-[10px] font-medium transition-colors"
                >
                  <Maximize2 className="w-3 h-3" />
                  <span>Enlarge</span>
                </button>
              </div>
              <img
                src={part.content}
                alt={part.alt || "Question Diagram"}
                className="max-h-64 max-w-full object-contain rounded-xl bg-white/95 p-2 transition-transform cursor-pointer"
                onClick={() => setZoomedImage(part.content)}
              />
            </div>
          </div>
        );
      })}

      {showStandaloneDiagram && diagramUrl && (
        <div className="my-3 group relative inline-block max-w-full">
          <div className="p-2.5 rounded-2xl bg-slate-900 border border-slate-700/80 shadow-lg inline-block">
            <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-slate-800 text-[11px] text-slate-400">
              <span className="flex items-center gap-1 font-semibold text-indigo-400">
                <ImageIcon className="w-3.5 h-3.5" />
                Question Diagram
              </span>
              <button
                type="button"
                onClick={() => setZoomedImage(diagramUrl)}
                className="hover:text-white flex items-center gap-0.5 text-[10px] font-medium transition-colors"
              >
                <Maximize2 className="w-3 h-3" />
                <span>Enlarge</span>
              </button>
            </div>
            <img
              src={diagramUrl}
              alt="Question Diagram"
              className="max-h-64 max-w-full object-contain rounded-xl bg-white/95 p-2 cursor-pointer"
              onClick={() => setZoomedImage(diagramUrl)}
            />
          </div>
        </div>
      )}

      {/* Lightbox / Zoom Modal */}
      {zoomedImage && (
        <div
          role="dialog"
          aria-label="Image preview dialog"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in"
          onClick={() => setZoomedImage(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-700 p-4 rounded-2xl shadow-2xl overflow-hidden flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex items-center justify-between pb-3 mb-2 border-b border-slate-800">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-indigo-400" />
                Diagram High-Resolution View
              </span>
              <button
                type="button"
                onClick={() => setZoomedImage(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-auto max-h-[75vh] w-full flex items-center justify-center p-2">
              <img
                src={zoomedImage}
                alt="Enlarged Diagram"
                className="max-h-full max-w-full object-contain rounded-xl bg-white p-3 shadow-md"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
