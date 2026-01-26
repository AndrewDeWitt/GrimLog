'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import GrimlogFrame from '@/components/MechanicusFrame';
import BriefReport from '@/components/BriefReport';
import {
  BriefAnalysis,
  BriefStrategicAnalysis,
  ListSuggestion,
} from '@/lib/briefAnalysis';
import { generateBriefHTML, SynergyExportData } from '@/lib/briefExport';
import { BriefExportData } from '@/components/BriefReport';

interface SharedBrief {
  id: string;
  userId: string;
  faction: string;
  detachment: string | null;
  totalPoints: number;
  unitCount: number;
  modelCount: number;
  listName: string | null;
  spiritIconUrl: string | null;
  localAnalysis: BriefAnalysis;
  strategicAnalysis: BriefStrategicAnalysis;
  listSuggestions: ListSuggestion[] | null;
  visibility: 'private' | 'link' | 'public';
  shareToken: string | null;
  viewCount: number;
  createdAt: string;
  isOwner: boolean;
  authorName: string;
}

export default function SharedBriefPage() {
  const params = useParams();
  const token = params?.token as string;
  
  const [brief, setBrief] = useState<SharedBrief | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    
    const fetchBrief = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const response = await fetch(`/api/brief/share/${token}`);
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('This shared brief link is invalid or has expired');
          }
          if (response.status === 403) {
            throw new Error('This brief is private');
          }
          throw new Error('Failed to load shared brief');
        }
        
        const data = await response.json();
        setBrief(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchBrief();
  }, [token]);

  // Handle HTML export
  const handleExport = async (exportData: BriefExportData) => {
    if (!brief) return;

    try {
      let synergyDataForExport: SynergyExportData | null = null;
      if (exportData.synergyData) {
        synergyDataForExport = {
          ...exportData.synergyData,
          unitData: exportData.synergyData.unitData,
        };
      }

      const html = await generateBriefHTML(
        brief.localAnalysis, 
        {
          units: [],
          detectedFaction: brief.faction,
          detectedDetachment: brief.detachment || null,
          detectedPointsLimit: null,
          parsingConfidence: 1.0,
        },
        brief.strategicAnalysis,
        brief.spiritIconUrl || exportData.spiritIconUrl,
        exportData.unitIcons,
        synergyDataForExport,
        brief.listName || 'Army Analysis',
        brief.listSuggestions || []
      );

      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeName = (brief.listName || brief.faction || 'army-analysis').toLowerCase().replace(/[^a-z0-9]+/g, '-');
      a.download = `tactical-brief-${safeName}-${new Date().toISOString().split('T')[0]}.html`;
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
                href="/brief"
                className="px-4 py-2 bg-grimlog-darkGray hover:bg-grimlog-gray text-grimlog-amber font-bold tracking-wider border border-grimlog-amber transition-all uppercase text-sm"
              >
                ← Brief Home
              </Link>
              <h1 className="text-xl font-bold text-grimlog-orange tracking-wider uppercase">
                📋 Shared Brief
              </h1>
            </div>
            
            {/* Shared Info */}
            <div className="flex items-center gap-4">
              {brief && (
                <>
                  <span className="text-grimlog-steel text-sm">
                    Shared by {brief.authorName}
                  </span>
                  <span className="text-grimlog-steel/50">•</span>
                  <span className="text-grimlog-steel text-sm">
                    👁 {brief.viewCount} views
                  </span>
                </>
              )}
            </div>
          </header>

          {/* Loading State */}
          {isLoading && (
            <div className="text-center py-20">
              <span className="text-grimlog-orange text-xl animate-pulse">
                Loading shared brief...
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
                href="/brief"
                className="inline-block px-6 py-3 bg-grimlog-orange hover:bg-grimlog-amber text-grimlog-black font-bold uppercase tracking-wider transition-all"
              >
                Create Your Own Brief
              </Link>
            </div>
          )}

          {/* Brief Content */}
          {brief && (
            <>
              {/* Shared Banner */}
              <div className="bg-grimlog-darkGray border border-grimlog-steel rounded-lg p-4 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🔗</span>
                  <div>
                    <p className="text-grimlog-amber font-bold">
                      {brief.listName || `${brief.faction} Brief`}
                    </p>
                    <p className="text-grimlog-steel text-sm">
                      {brief.totalPoints}pts • {brief.unitCount} units • Shared by {brief.authorName}
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Link
                    href="/brief/gallery"
                    className="px-4 py-2 border border-grimlog-steel text-grimlog-light-steel hover:border-grimlog-amber hover:text-grimlog-amber font-bold uppercase text-sm transition-colors"
                  >
                    Browse Gallery
                  </Link>
                </div>
              </div>

              <BriefReport
                analysis={brief.localAnalysis}
                strategicAnalysis={brief.strategicAnalysis}
                listSuggestions={brief.listSuggestions || []}
                spiritIconUrl={brief.spiritIconUrl}
                onExport={handleExport}
                // Don't pass share controls if not owner
                briefId={brief.isOwner ? brief.id : undefined}
                briefVisibility={brief.isOwner ? brief.visibility : undefined}
                briefShareToken={brief.isOwner ? brief.shareToken : undefined}
                listName={brief.listName || undefined}
              />
            </>
          )}
        </div>
      </main>
    </>
  );
}

