import React, { useState, useEffect } from 'react';
import StorageAdapter from '../lib/storageAdapter';

export const StorageStatus: React.FC = () => {
  const [stats, setStats] = useState<{
    type: 'IndexedDB' | 'Supabase';
    stats?: any;
  } | null>(null);

  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const storageStats = await StorageAdapter.getStorageStats();
        setStats(storageStats);
      } catch (error) {
        console.warn('Failed to load storage stats:', error);
      }
    };

    loadStats();
  }, []);

  if (!stats) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50">
      <button
        onClick={() => setIsVisible(!isVisible)}
        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
          stats.type === 'IndexedDB'
            ? 'bg-green-600 text-white hover:bg-green-700'
            : 'bg-blue-600 text-white hover:bg-blue-700'
        }`}
      >
        {stats.type}
      </button>

      {isVisible && stats.stats && (
        <div className="absolute bottom-8 left-0 bg-gray-800 text-white rounded-lg p-3 shadow-lg min-w-[200px]">
          <h4 className="font-semibold mb-2">Storage Stats</h4>
          <div className="text-xs space-y-1">
            <div>Bank Uploads: {stats.stats.bank_uploads}</div>
            <div>Bank Entries: {stats.stats.bank_entries}</div>
            <div>Cash Conferences: {stats.stats.cash_conference_entries}</div>
            <div>Not Found: {stats.stats.not_found_history}</div>
            <div>Manual Entries: {stats.stats.manual_entries}</div>
            <div>Day Selections: {stats.stats.day_selection}</div>
            {stats.stats.total_storage_mb !== undefined && (
              <div className="pt-1 border-t border-gray-600">
                Storage: ~{stats.stats.total_storage_mb} MB
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default StorageStatus;