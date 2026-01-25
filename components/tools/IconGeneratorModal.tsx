'use client';

import { useState, useEffect } from 'react';

interface GoogleImage {
  link: string;
  thumbnail: string;
  title: string;
  contextLink: string;
}

interface IconGeneratorModalProps {
  unitName: string;
  faction: string;
  datasheetId?: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (url: string) => void;
}

export default function IconGeneratorModal({
  unitName,
  faction,
  datasheetId,
  isOpen,
  onClose,
  onSuccess
}: IconGeneratorModalProps) {
  const [searchResults, setSearchResults] = useState<GoogleImage[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [stylePrompt, setStylePrompt] = useState('');
  const [searchError, setSearchError] = useState<{ message: string; setupInstructions?: { title: string; steps: string[] } } | null>(null);

  // Auto-search on open
  useEffect(() => {
    if (isOpen) {
      // Reset state
      setSearchResults([]);
      setSelectedImage(null);
      setGeneratedUrl(null);
      setGenerating(false);
      setStylePrompt('');
      setSearchError(null);
      
      // Trigger search
      performSearch(`Warhammer 40k ${unitName} miniature`);
    }
  }, [isOpen, unitName]);

  const performSearch = async (query: string) => {
    setSearching(true);
    setSearchError(null);
    try {
      const res = await fetch(`/api/admin/icons/search?query=${encodeURIComponent(query)}`);
      const data = await res.json();
      
      if (!res.ok) {
        setSearchError({
          message: data.error || 'Failed to search for images',
          setupInstructions: data.setupInstructions
        });
        setSearchResults([]);
        return;
      }
      
      if (data.images) {
        setSearchResults(data.images);
        setSearchError(null);
      }
    } catch (err) {
      console.error(err);
      setSearchError({
        message: 'Network error while searching for images'
      });
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const generateIcon = async () => {
    if (!selectedImage) return;
    
    setGenerating(true);
    try {
      const res = await fetch('/api/admin/icons/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: selectedImage,
          unitName: unitName,
          faction: faction,
          stylePrompt: stylePrompt,
          datasheetId: datasheetId || null,
        })
      });
      const data = await res.json();
      if (data.success) {
        setGeneratedUrl(data.url);
        if (onSuccess) onSuccess(data.url);
      } else {
        alert('Generation failed: ' + data.error);
      }
    } catch (err) {
      console.error(err);
      alert('Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-grimlog-black/45 backdrop-blur-[2px]"
        onClick={onClose}
      />
      
      {/* Bottom Sheet */}
      <div 
        className="relative bg-grimlog-slate-light border-t-2 border-grimlog-steel w-full max-w-5xl mx-auto h-[90vh] rounded-t-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ animation: 'slideUp 0.3s ease-out' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag Handle */}
        <div className="flex justify-center py-3 bg-grimlog-slate-dark border-b border-grimlog-steel">
          <div className="w-12 h-1.5 bg-grimlog-steel/70 rounded-full" />
        </div>

        {/* Modal Header */}
        <div className="p-6 border-b border-grimlog-steel flex justify-between items-center bg-grimlog-slate-dark">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Generate Icon: <span className="text-grimlog-orange">{unitName}</span></h2>
            <p className="text-gray-600 text-sm">{faction}</p>
          </div>
          <button 
            onClick={onClose} 
            className="text-gray-500 hover:text-gray-900 hover:bg-gray-200 text-2xl w-10 h-10 flex items-center justify-center rounded-lg transition-colors"
          >
            ×
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden bg-grimlog-slate-light">
          {/* Left: Search & Select */}
          <div className="w-1/2 border-r border-grimlog-steel flex flex-col">
            <div className="p-4 border-b border-grimlog-steel bg-grimlog-slate-dark">
              <h3 className="font-bold mb-2 text-grimlog-orange">Step 1: Select Reference Image</h3>
              <form onSubmit={(e) => { e.preventDefault(); performSearch((e.target as any).query.value); }} className="flex gap-2">
                <input 
                  name="query"
                  defaultValue={`Warhammer 40k ${unitName} miniature`}
                  className="flex-1 bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:border-grimlog-orange"
                />
                <button type="submit" className="bg-grimlog-steel hover:bg-grimlog-light-steel px-4 py-2 rounded-lg text-sm text-gray-900 font-bold">Search</button>
              </form>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-grimlog-slate-light">
              {searching ? (
                <div className="text-center py-8 text-gray-500">Searching...</div>
              ) : searchError ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-3">
                  <div className="text-red-600 font-bold">⚠️ {searchError.message}</div>
                  {searchError.setupInstructions && (
                    <div className="bg-white rounded p-3 space-y-2 text-sm border border-red-100">
                      <div className="text-grimlog-orange font-semibold">{searchError.setupInstructions.title}</div>
                      <ol className="list-decimal list-inside space-y-1 text-gray-600 text-xs">
                        {searchError.setupInstructions.steps.map((step, i) => (
                          <li key={i}>{step}</li>
                        ))}
                      </ol>
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <a 
                          href="https://programmablesearchengine.google.com/" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-grimlog-orange hover:text-grimlog-amber underline text-xs"
                        >
                          Open Google Programmable Search Engine →
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              ) : searchResults.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No results found. Try a different search query.</div>
              ) : (
                searchResults.map((img, i) => (
                  <div 
                    key={i} 
                    onClick={() => setSelectedImage(img.link)}
                    className={`cursor-pointer border-2 rounded-lg overflow-hidden relative group h-48 ${selectedImage === img.link ? 'border-grimlog-orange shadow-lg' : 'border-gray-200 hover:border-gray-400'}`}
                  >
                    <img src={img.thumbnail} className="w-full h-full object-cover" alt={img.title} />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-xs p-2 truncate opacity-0 group-hover:opacity-100 transition-opacity text-white">
                      {img.title}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right: Generate & Preview */}
          <div className="w-1/2 flex flex-col bg-grimlog-slate-light">
            <div className="p-4 border-b border-grimlog-steel bg-grimlog-slate-dark">
              <h3 className="font-bold mb-2 text-grimlog-orange">Step 2: Style & Generate</h3>
              <div className="space-y-2">
                <label className="text-xs text-gray-600 block">Style Prompt (Optional override)</label>
                <textarea 
                  value={stylePrompt}
                  onChange={(e) => setStylePrompt(e.target.value)}
                  placeholder="Default: Flat, high contrast, vector art style..."
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm h-20 text-gray-800 focus:outline-none focus:border-grimlog-orange"
                />
              </div>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center p-8 bg-grimlog-slate-light">
              {generating ? (
                <div className="text-center">
                  <div className="w-12 h-12 border-4 border-grimlog-orange border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-grimlog-orange animate-pulse">Generating with Gemini (Nano Banana)...</p>
                </div>
              ) : generatedUrl ? (
                <div className="text-center space-y-4">
                  <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-lg inline-block">
                    <img src={generatedUrl} className="w-64 h-64 object-contain" alt="Generated Icon" />
                  </div>
                  <p className="text-green-600 font-bold">Icon Generated & Saved!</p>
                  <div className="flex gap-2 justify-center">
                    <button onClick={() => setGeneratedUrl(null)} className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 text-gray-700 font-bold">Try Again</button>
                    <button onClick={onClose} className="px-4 py-2 bg-green-600 rounded-lg hover:bg-green-500 text-white font-bold">Done</button>
                  </div>
                </div>
              ) : selectedImage ? (
                <div className="text-center space-y-4">
                  <div className="bg-white p-2 rounded-lg border border-gray-200 inline-block opacity-70">
                    <img src={selectedImage} className="w-32 h-32 object-contain" alt="Selected Reference" />
                  </div>
                  <p className="text-gray-600 text-sm">Reference selected. Ready to generate.</p>
                  <button 
                    onClick={generateIcon}
                    className="px-8 py-3 bg-grimlog-orange hover:bg-grimlog-amber text-gray-900 font-bold rounded-lg shadow-lg transform hover:scale-105 transition-all"
                  >
                    Generate Icon
                  </button>
                </div>
              ) : (
                <div className="text-gray-500 text-center">
                  <p>Select an image from the left to begin.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
