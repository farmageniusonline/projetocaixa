import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConferenceHistoryService } from '../conferenceHistory';
import { db, getCurrentUserId } from '../../lib/database';

vi.mock('../../lib/database');

describe('ConferenceHistoryService', () => {
  const mockUserId = '00000000-0000-0000-0000-000000000001';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUserId).mockResolvedValue(mockUserId);
  });

  describe('saveBankingUpload', () => {
    it('saves banking upload data correctly', async () => {
      const mockData = [
        {
          documentNumber: 'DOC001',
          date: '2024-01-15',
          description: 'Transaction 1',
          value: 100,
          bankName: 'Bank A',
          accountNumber: '12345',
          transactionType: 'credit',
          balance: 1000
        },
        {
          documentNumber: 'DOC002',
          date: '2024-01-15',
          description: 'Transaction 2',
          value: 200,
          bankName: 'Bank B',
          accountNumber: '67890',
          transactionType: 'debit',
          balance: 800
        }
      ];

      const mockInsert = vi.fn().mockResolvedValue({ error: null });
      const mockFrom = vi.fn().mockReturnValue({ insert: mockInsert });
      vi.mocked(db).from = mockFrom;

      await ConferenceHistoryService.saveBankingUpload(
        mockData,
        'test.xlsx',
        '2024-01-15',
        'automatic'
      );

      expect(mockFrom).toHaveBeenCalledWith('conference_history');
      expect(mockInsert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            operation_date: '2024-01-15',
            operation_type: 'banking_upload',
            document_number: 'DOC001',
            value: 100,
            file_name: 'test.xlsx',
            upload_mode: 'automatic',
            user_id: mockUserId
          })
        ])
      );
    });

    it('throws error when save fails', async () => {
      const mockError = new Error('Database error');
      const mockInsert = vi.fn().mockResolvedValue({ error: mockError });
      const mockFrom = vi.fn().mockReturnValue({ insert: mockInsert });
      vi.mocked(db).from = mockFrom;

      await expect(
        ConferenceHistoryService.saveBankingUpload([], 'test.xlsx', '2024-01-15', 'manual')
      ).rejects.toThrow(mockError);
    });
  });

  describe('saveCashConference', () => {
    it('saves cash conference with conferred status', async () => {
      const mockItem = {
        documentNumber: 'DOC001',
        description: 'Cash transaction',
        value: 150
      };

      const mockInsert = vi.fn().mockResolvedValue({ error: null });
      const mockFrom = vi.fn().mockReturnValue({ insert: mockInsert });
      vi.mocked(db).from = mockFrom;

      await ConferenceHistoryService.saveCashConference(
        mockItem,
        '2024-01-15',
        'conferred'
      );

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          operation_date: '2024-01-15',
          operation_type: 'cash_conference',
          document_number: 'DOC001',
          value: 150,
          status: 'conferred',
          conferred_by: mockUserId,
          user_id: mockUserId
        })
      );
    });

    it('saves cash conference with not_found status', async () => {
      const mockItem = { value: 75 };

      const mockInsert = vi.fn().mockResolvedValue({ error: null });
      const mockFrom = vi.fn().mockReturnValue({ insert: mockInsert });
      vi.mocked(db).from = mockFrom;

      await ConferenceHistoryService.saveCashConference(
        mockItem,
        '2024-01-15',
        'not_found'
      );

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'not_found',
          value: 75
        })
      );
    });
  });

  describe('saveNotFound', () => {
    it('saves not found value with proper formatting', async () => {
      const mockInsert = vi.fn().mockResolvedValue({ error: null });
      const mockFrom = vi.fn().mockReturnValue({ insert: mockInsert });
      vi.mocked(db).from = mockFrom;

      await ConferenceHistoryService.saveNotFound('123,45', '2024-01-15');

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          operation_date: '2024-01-15',
          operation_type: 'not_found',
          value: 123.45,
          status: 'not_found',
          metadata: { originalValue: '123,45' }
        })
      );
    });

    it('handles invalid numeric values', async () => {
      const mockInsert = vi.fn().mockResolvedValue({ error: null });
      const mockFrom = vi.fn().mockReturnValue({ insert: mockInsert });
      vi.mocked(db).from = mockFrom;

      await ConferenceHistoryService.saveNotFound('invalid', '2024-01-15');

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          value: 0
        })
      );
    });
  });

  describe('getHistoryByDate', () => {
    it('fetches history for specific date', async () => {
      const mockData = [
        { id: '1', operation_date: '2024-01-15', operation_type: 'banking_upload' },
        { id: '2', operation_date: '2024-01-15', operation_type: 'cash_conference' }
      ];

      const mockOrder = vi.fn().mockResolvedValue({ data: mockData, error: null });
      const mockEq2 = vi.fn().mockReturnValue({ order: mockOrder });
      const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq1 });
      const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });
      vi.mocked(db).from = mockFrom;

      const result = await ConferenceHistoryService.getHistoryByDate('2024-01-15');

      expect(mockFrom).toHaveBeenCalledWith('conference_history');
      expect(mockEq1).toHaveBeenCalledWith('operation_date', '2024-01-15');
      expect(mockEq2).toHaveBeenCalledWith('user_id', mockUserId);
      expect(result).toEqual(mockData);
    });

    it('returns empty array when no data found', async () => {
      const mockOrder = vi.fn().mockResolvedValue({ data: null, error: null });
      const mockEq2 = vi.fn().mockReturnValue({ order: mockOrder });
      const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq1 });
      const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });
      vi.mocked(db).from = mockFrom;

      const result = await ConferenceHistoryService.getHistoryByDate('2024-01-15');

      expect(result).toEqual([]);
    });
  });

  describe('getDailySummary', () => {
    it('fetches daily summary successfully', async () => {
      const mockSummary = {
        operation_date: '2024-01-15',
        banking_total_uploaded: 10,
        banking_total_value: 5000,
        cash_conferred_count: 5,
        total_value: 3000
      };

      const mockSingle = vi.fn().mockResolvedValue({ data: mockSummary, error: null });
      const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });
      vi.mocked(db).from = mockFrom;

      const result = await ConferenceHistoryService.getDailySummary('2024-01-15');

      expect(mockFrom).toHaveBeenCalledWith('daily_summary');
      expect(result).toEqual(mockSummary);
    });

    it('returns null when no summary found', async () => {
      const mockSingle = vi.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' }
      });
      const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });
      vi.mocked(db).from = mockFrom;

      const result = await ConferenceHistoryService.getDailySummary('2024-01-15');

      expect(result).toBeNull();
    });
  });

  describe('updateConferenceStatus', () => {
    it('updates status to conferred', async () => {
      const mockEq2 = vi.fn().mockResolvedValue({ error: null });
      const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq1 });
      const mockFrom = vi.fn().mockReturnValue({ update: mockUpdate });
      vi.mocked(db).from = mockFrom;

      await ConferenceHistoryService.updateConferenceStatus('123', 'conferred');

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'conferred',
          conferred_by: mockUserId
        })
      );
      expect(mockEq1).toHaveBeenCalledWith('id', '123');
      expect(mockEq2).toHaveBeenCalledWith('user_id', mockUserId);
    });
  });

  describe('clearDayHistory', () => {
    it('deletes all history for specific date', async () => {
      const mockEq2 = vi.fn().mockResolvedValue({ error: null });
      const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
      const mockDelete = vi.fn().mockReturnValue({ eq: mockEq1 });
      const mockFrom = vi.fn().mockReturnValue({ delete: mockDelete });
      vi.mocked(db).from = mockFrom;

      await ConferenceHistoryService.clearDayHistory('2024-01-15');

      expect(mockDelete).toHaveBeenCalled();
      expect(mockEq1).toHaveBeenCalledWith('operation_date', '2024-01-15');
      expect(mockEq2).toHaveBeenCalledWith('user_id', mockUserId);
    });
  });
});