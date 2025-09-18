# Supabase Integration Documentation

## Overview

This document describes the complete Supabase integration for the Farmagênius Caixa application.

## Configuration

### Environment Variables
```env
VITE_SUPABASE_URL=https://artgvpolienazfaalwtk.supabase.co
VITE_SUPABASE_ANON_KEY=[your-anon-key]
VITE_DATABASE_MODE=supabase # Options: indexeddb | supabase | hybrid
VITE_ORG_NAME=farmageniusonline
VITE_PROJECT_NAME=farmageniuscaixa
```

## Database Schema

The complete database schema is located in `/supabase/schema.sql`. Execute this file in the Supabase SQL editor to set up the database.

### Main Tables

1. **profiles** - User profiles extending Supabase Auth
2. **banking_files** - Uploaded banking file metadata
3. **banking_transactions** - Individual banking transactions
4. **cash_conference** - Cash conference entries
5. **manual_entries** - Manual transaction entries
6. **not_found_history** - History of values not found
7. **performance_logs** - Performance monitoring data
8. **audit_logs** - Audit trail for all operations

### RLS Policies

All tables have Row Level Security (RLS) enabled with policies that ensure users can only access their own data.

## Services

### 1. Authentication Service (`authService.ts`)
- User sign up, sign in, sign out
- Password reset and update
- Profile management
- Session handling

### 2. Supabase Data Service (`supabaseDataService.ts`)
- Banking file uploads
- Transaction searches
- Conference operations
- Manual entry management
- Statistics and reporting

### 3. Sync Service (`syncService.ts`)
- Offline/online synchronization
- Conflict resolution
- Queue management for offline operations
- Real-time sync status monitoring

### 4. Backup Service (`backupService.ts`)
- Create full or partial backups
- Store backups in Supabase Storage
- Download and restore backups
- Automatic scheduled backups

### 5. Data Adapter (`dataAdapter.ts`)
- Abstraction layer between IndexedDB and Supabase
- Supports three modes: indexeddb, supabase, hybrid
- Seamless switching between storage backends

## Authentication Components

### Login Component (`components/Auth/Login.tsx`)
- Email/password authentication
- Password recovery
- Remember me functionality
- Error handling with user feedback

### SignUp Component (`components/Auth/SignUp.tsx`)
- New user registration
- Email verification
- Profile setup
- Password strength validation

## Usage

### Setting Database Mode

1. **IndexedDB Mode** (Default)
   - Works offline
   - No authentication required
   - Data stored locally in browser

2. **Supabase Mode**
   - Requires authentication
   - Data stored in cloud
   - Real-time sync across devices

3. **Hybrid Mode**
   - Works offline and online
   - Local-first with cloud sync
   - Best user experience

### Switching Modes

Update the `VITE_DATABASE_MODE` environment variable:
```javascript
// In code
dataAdapter.setMode('supabase');
```

## API Functions

### Search Transactions by Value
```javascript
const transactions = await supabaseDataService.searchTransactionsByValue(100.50);
```

### Transfer to Conference
```javascript
const result = await supabaseDataService.transferToConference(transactionId);
```

### Create Backup
```javascript
const backup = await backupService.createBackup(
  startDate,
  endDate,
  true, // includeConferences
  true, // includeTransactions
  true  // includeManualEntries
);
```

### Sync Data
```javascript
const syncResult = await syncService.forceSyncNow();
console.log(`Uploaded: ${syncResult.uploaded}, Downloaded: ${syncResult.downloaded}`);
```

## Security

1. **Row Level Security (RLS)**: All database tables have RLS policies ensuring data isolation
2. **Authentication**: Supabase Auth handles user authentication securely
3. **API Keys**: Service role keys should never be exposed to the client
4. **Storage**: Backup files are stored in private buckets with signed URL access

## Migration Guide

### From IndexedDB to Supabase

1. Export existing data from IndexedDB
2. Set up Supabase project and run schema
3. Update environment variables
4. Switch to Supabase mode
5. Import data using backup restore

### Data Migration Script

```javascript
// Example migration script
async function migrateToSupabase() {
  // 1. Export from IndexedDB
  const localData = await indexedDbService.getHistoryByDate(date);

  // 2. Upload to Supabase
  for (const item of localData) {
    await supabaseDataService.uploadBankingFile(
      item.fileName,
      item.transactions,
      item.operationDate
    );
  }

  // 3. Switch mode
  dataAdapter.setMode('supabase');
}
```

## Troubleshooting

### Common Issues

1. **Authentication Errors**
   - Verify Supabase URL and keys
   - Check network connectivity
   - Ensure user is verified

2. **Sync Failures**
   - Check offline queue in IndexedDB
   - Verify network status
   - Review error logs

3. **Permission Errors**
   - Verify RLS policies
   - Check user role permissions
   - Ensure proper authentication

## Performance Considerations

1. **Batch Operations**: Use batch functions for multiple operations
2. **Pagination**: Implement pagination for large datasets
3. **Caching**: Utilize hybrid mode for optimal performance
4. **Indexing**: Ensure proper database indexes are in place

## Testing

### Unit Tests
```bash
npm run test
```

### E2E Tests with Supabase
```bash
npm run test:e2e
```

### Test Coverage
- Authentication flows: ✅
- Data operations: ✅
- Sync mechanisms: ✅
- Backup/restore: ✅

## Deployment

1. Set production environment variables
2. Run database migrations
3. Configure Supabase project settings
4. Deploy application
5. Monitor performance and errors

## Support

For issues or questions:
- Check Supabase documentation: https://supabase.com/docs
- Review application logs
- Contact support team

## License

This integration is part of the Farmagênius Caixa application.
All rights reserved.