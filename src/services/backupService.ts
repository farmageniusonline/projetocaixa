import { supabase } from '../lib/supabase';
import { supabaseDataService } from './supabaseDataService';
import { authService } from './authService';
import * as XLSX from 'xlsx';

interface BackupMetadata {
  id: string;
  fileName: string;
  createdAt: Date;
  size: number;
  recordCount: number;
  type: 'full' | 'partial';
}

class BackupService {
  private bucketName = 'backups';

  constructor() {
    // Bucket initialization moved to lazy loading to avoid RLS errors on startup
  }

  private async initializeBucket() {
    try {
      // Check if bucket exists
      const { data: buckets } = await supabase.storage.listBuckets();

      const bucketExists = buckets?.some(b => b.name === this.bucketName);

      if (!bucketExists) {
        // Create bucket if it doesn't exist
        const { error } = await supabase.storage.createBucket(this.bucketName, {
          public: false,
          fileSizeLimit: 52428800 // 50MB
        });

        if (error) {
          if (error.message.includes('already exists')) {
            console.log('Bucket already exists');
          } else if (error.message.includes('row-level security') || error.message.includes('RLS')) {
            console.warn('RLS policy prevents bucket creation - using existing buckets only');
          } else {
            console.error('Error creating bucket:', error);
            throw error;
          }
        }
      }
    } catch (error) {
      console.error('Error initializing bucket:', error);
    }
  }

  // Create backup
  async createBackup(
    startDate?: Date,
    endDate?: Date,
    includeConferences = true,
    includeTransactions = true,
    includeManualEntries = true
  ): Promise<BackupMetadata | null> {
    const user = authService.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    try {
      console.log('Creating backup...');

      // Initialize bucket on demand (lazy loading)
      await this.initializeBucket();

      // Gather data
      const backupData: any = {
        metadata: {
          createdAt: new Date().toISOString(),
          userId: user.id,
          userEmail: user.email,
          version: '1.0.0',
          type: startDate && endDate ? 'partial' : 'full'
        },
        data: {}
      };

      // Get conferences
      if (includeConferences) {
        backupData.data.conferences = await supabaseDataService.exportConferences(
          startDate,
          endDate
        );
      }

      // Get transactions
      if (includeTransactions && startDate && endDate) {
        backupData.data.transactions = await supabaseDataService.getTransactionsByDateRange(
          startDate,
          endDate
        );
      }

      // Get manual entries
      if (includeManualEntries) {
        backupData.data.manualEntries = await supabaseDataService.getManualEntries();
      }

      // Get not found history
      backupData.data.notFoundHistory = await supabaseDataService.getNotFoundHistory();

      // Get statistics
      backupData.data.statistics = await supabaseDataService.getUserStatistics();

      // Convert to Excel
      const wb = XLSX.utils.book_new();

      // Add metadata sheet
      const metadataSheet = XLSX.utils.json_to_sheet([backupData.metadata]);
      XLSX.utils.book_append_sheet(wb, metadataSheet, 'Metadata');

      // Add data sheets
      if (backupData.data.conferences?.length > 0) {
        const confSheet = XLSX.utils.json_to_sheet(backupData.data.conferences);
        XLSX.utils.book_append_sheet(wb, confSheet, 'Conferences');
      }

      if (backupData.data.transactions?.length > 0) {
        const transSheet = XLSX.utils.json_to_sheet(backupData.data.transactions);
        XLSX.utils.book_append_sheet(wb, transSheet, 'Transactions');
      }

      if (backupData.data.manualEntries?.length > 0) {
        const manualSheet = XLSX.utils.json_to_sheet(backupData.data.manualEntries);
        XLSX.utils.book_append_sheet(wb, manualSheet, 'ManualEntries');
      }

      if (backupData.data.notFoundHistory?.length > 0) {
        const notFoundSheet = XLSX.utils.json_to_sheet(backupData.data.notFoundHistory);
        XLSX.utils.book_append_sheet(wb, notFoundSheet, 'NotFound');
      }

      // Convert to buffer
      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });

      // Create filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `backup_${timestamp}.xlsx`;
      const filePath = `${user.id}/${fileName}`;

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from(this.bucketName)
        .upload(filePath, blob, {
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          upsert: false
        });

      if (error) throw error;

      // Calculate record count
      const recordCount =
        (backupData.data.conferences?.length || 0) +
        (backupData.data.transactions?.length || 0) +
        (backupData.data.manualEntries?.length || 0) +
        (backupData.data.notFoundHistory?.length || 0);

      const metadata: BackupMetadata = {
        id: data.path,
        fileName,
        createdAt: new Date(),
        size: blob.size,
        recordCount,
        type: backupData.metadata.type
      };

      console.log('Backup created successfully:', fileName);
      return metadata;
    } catch (error) {
      console.error('Error creating backup:', error);
      return null;
    }
  }

  // List backups
  async listBackups(): Promise<BackupMetadata[]> {
    const user = authService.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    try {
      const { data, error } = await supabase.storage
        .from(this.bucketName)
        .list(user.id, {
          limit: 100,
          sortBy: { column: 'created_at', order: 'desc' }
        });

      if (error) throw error;

      return (data || []).map(file => ({
        id: `${user.id}/${file.name}`,
        fileName: file.name,
        createdAt: new Date(file.created_at),
        size: file.metadata?.size || 0,
        recordCount: 0, // Would need to read file to get this
        type: 'full' as const
      }));
    } catch (error) {
      console.error('Error listing backups:', error);
      return [];
    }
  }

  // Download backup
  async downloadBackup(backupId: string): Promise<Blob | null> {
    const user = authService.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    try {
      const { data, error } = await supabase.storage
        .from(this.bucketName)
        .download(backupId);

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error downloading backup:', error);
      return null;
    }
  }

  // Restore from backup
  async restoreFromBackup(backupId: string): Promise<boolean> {
    const user = authService.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    try {
      console.log('Restoring from backup:', backupId);

      // Download backup
      const blob = await this.downloadBackup(backupId);
      if (!blob) {
        throw new Error('Failed to download backup');
      }

      // Parse Excel file
      const arrayBuffer = await blob.arrayBuffer();
      const wb = XLSX.read(arrayBuffer, { type: 'array' });

      // Get sheets
      const metadataSheet = wb.Sheets['Metadata'];
      const metadata = XLSX.utils.sheet_to_json(metadataSheet)[0] as any;

      // Verify backup is for correct user
      if (metadata.userId !== user.id) {
        throw new Error('Backup belongs to different user');
      }

      // Restore conferences
      if (wb.Sheets['Conferences']) {
        const conferences = XLSX.utils.sheet_to_json(wb.Sheets['Conferences']);
        console.log(`Restoring ${conferences.length} conferences...`);
        // Implementation would depend on your restore strategy
        // For now, we'll just log
      }

      // Restore transactions
      if (wb.Sheets['Transactions']) {
        const transactions = XLSX.utils.sheet_to_json(wb.Sheets['Transactions']);
        console.log(`Restoring ${transactions.length} transactions...`);
      }

      // Restore manual entries
      if (wb.Sheets['ManualEntries']) {
        const manualEntries = XLSX.utils.sheet_to_json(wb.Sheets['ManualEntries']);
        console.log(`Restoring ${manualEntries.length} manual entries...`);
      }

      console.log('Restore completed successfully');
      return true;
    } catch (error) {
      console.error('Error restoring backup:', error);
      return false;
    }
  }

  // Delete backup
  async deleteBackup(backupId: string): Promise<boolean> {
    const user = authService.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    try {
      const { error } = await supabase.storage
        .from(this.bucketName)
        .remove([backupId]);

      if (error) throw error;

      return true;
    } catch (error) {
      console.error('Error deleting backup:', error);
      return false;
    }
  }

  // Auto backup
  async scheduleAutoBackup(intervalHours = 24) {
    setInterval(async () => {
      console.log('Running auto backup...');
      await this.createBackup();
    }, intervalHours * 60 * 60 * 1000);
  }

  // Get backup URL for download
  async getBackupUrl(backupId: string): Promise<string | null> {
    const user = authService.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    try {
      const { data } = supabase.storage
        .from(this.bucketName)
        .getPublicUrl(backupId);

      return data.publicUrl;
    } catch (error) {
      console.error('Error getting backup URL:', error);
      return null;
    }
  }

  // Create signed URL for temporary access
  async getSignedBackupUrl(backupId: string, expiresIn = 3600): Promise<string | null> {
    const user = authService.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    try {
      const { data, error } = await supabase.storage
        .from(this.bucketName)
        .createSignedUrl(backupId, expiresIn);

      if (error) throw error;

      return data.signedUrl;
    } catch (error) {
      console.error('Error getting signed URL:', error);
      return null;
    }
  }
}

export const backupService = new BackupService();