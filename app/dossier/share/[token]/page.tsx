'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import GrimlogFrame from '@/components/MechanicusFrame';
import DossierReport from '@/components/DossierReport';
import { 
  DossierAnalysis,
  DossierStrategicAnalysis,
  ListSuggestion,
} from '@/lib/dossierAnalysis';
import { generateDossierHTML, SynergyExportData } from '@/lib/dossierExport';
import { DossierExportData } from '@/components/DossierReport';

interface SharedDossier {
  id: string;
  userId: string;
  faction: string;
  detachment: string | null;
  totalPoints: number;
  unitCount: number;
  modelCount: number;
  listName: string | null;
  spiritIconUrl: string | null;
  localAnalysis: DossierAnalysis;
  strategicAnalysis: DossierStrategicAnalysis;
  listSuggestions: ListSuggestion[] | null;
  visibility: 'private' | 'link' | 'public';
  shareToken: string | null;
  viewCount: number;
  createdAt: string;
  isOwner: boolean;
  authorName: string;
}

export default function SharedDossierPage() {
  const params = useParams();
  const token = params?.token as string;
  
  const [dossier, setDossier] = useState<SharedDossier | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    
    const fetchDossier = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const response = await fetch(`/api/dossier/share/${token}`);
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('This shared dossier link is invalid or has expired');
          }
          if (response.status === 403) {
            throw new Error('This dossier is private');
          }
          throw new Error('Failed to load shared dossier');
        }
        
        const data = await response.json();
        setDossier(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchDossier();
  }, [token]);

  // Handle HTML export
  const handleExport = async (exportData: DossierExportData) => {
    if (!dossier) return;

    try {
      let synergyDataForExport: SynergyExportData | null = null;
      if (exportData.synergyData) {
        synergyDataForExport = {
          ...exportData.synergyData,
          unitData: exportData.synergyData.unitData,
        };
      }

      const html = await generateDossierHTML(
        dossier.localAnalysis, 
        {
          units: [],
          detectedFaction: dossier.faction,
          detectedDetachment: dossier.detachment || null,
          detectedPointsLimit: null,
          parsingConfidence: 1.0,
        },
        dossier.strategicAnalysis,
        dossier.spiritIconUrl || exportData.spiritIconUrl,
        exportData.unitIcons,
        synergyDataForExport,
        dossier.listName || 'Army Analysis',
        dossier.listSuggestions || []
      );

      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeName = (dossier.listName || dossier.faction || 'army-analysis').toLowerCase().replace(/[^a-z0-9]+/g, '-');
      a.download = `tactical-dossier-${safeName}-${new Date().toISOString().split('T')[0]}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export error:', err);
    }
  };

  return (
    <>
      <GrimlogFrame />
      
      <main className="min-h-screen pt-4 pb-8 bg-grimlog-black">
        <div className="container mx-auto px-4 max-w-7xl">
          {/* Header */}
          <header className="py-4 border-b-2 border-grimlog-steel mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <Link
                href="/dossier"
                className="px-4 py-2 bg-grimlog-darkGray hover:bg-grimlog-gray text-grimlog-amber font-bold tracking-wider border border-grimlog-amber transition-all uppercase text-sm"
              >
                ← Dossier Home
              </Link>
              <h1 className="text-xl font-bold text-grimlog-orange tracking-wider uppercase">
                📋 Shared Dossier
              </h1>
            </div>
            
            {/* Shared Info */}
            <div className="flex items-center gap-4">
              {dossier && (
                <>
                  <span className="text-grimlog-steel text-sm">
                    Shared by {dossier.authorName}
                  </span>
                  <span className="text-grimlog-steel/50">•</span>
                  <span className="text-grimlog-steel text-sm">
                    👁 {dossier.viewCount} views
                  </span>
                </>
              )}
            </div>
          </header>

          {/* Loading State */}
          {isLoading && (
            <div className="text-center py-20">
              <span className="text-grimlog-orange text-xl animate-pulse">
                Loading shared dossier...
              </span>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="text-center py-20">
              <div className="text-grimlog-red text-xl mb-4">{error}</div>
              <p className="text-grimlog-steel mb-6">
                The link may have been removed or made private by the owner.
              </p>
              <Link
                href="/dossier"
                className="inline-block px-6 py-3 bg-grimlog-orange hover:bg-grimlog-amber text-grimlog-black font-bold uppercase tracking-wider transition-all"
              >
                Create Your Own Dossier
              </Link>
            </div>
          )}

          {/* Dossier Content */}
          {dossier && (
            <>
              {/* Shared Banner */}
              <div className="bg-grimlog-darkGray border border-grimlog-steel rounded-lg p-4 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🔗</span>
                  <div>
                    <p className="text-grimlog-amber font-bold">
                      {dossier.listName || `${dossier.faction} Dossier`}
                    </p>
                    <p className="text-grimlog-steel text-sm">
                      {dossier.totalPoints}pts • {dossier.unitCount} units • Shared by {dossier.authorName}
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Link
                    href="/dossier/gallery"
                    className="px-4 py-2 border border-grimlog-steel text-grimlog-light-steel hover:border-grimlog-amber hover:text-grimlog-amber font-bold uppercase text-sm transition-colors"
                  >
                    Browse Gallery
                  </Link>
                </div>
              </div>

              <DossierReport
                analysis={dossier.localAnalysis}
                strategicAnalysis={dossier.strategicAnalysis}
                listSuggestions={dossier.listSuggestions || []}
                spiritIconUrl={dossier.spiritIconUrl}
                onExport={handleExport}
                // Don't pass share controls if not owner
                dossierId={dossier.isOwner ? dossier.id : undefined}
                dossierVisibility={dossier.isOwner ? dossier.visibility : undefined}
                dossierShareToken={dossier.isOwner ? dossier.shareToken : undefined}
                listName={dossier.listName || undefined}
              />
            </>
          )}
        </div>
      </main>
    </>
  );
}

