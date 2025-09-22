-- ==========================================
-- Performance Indexes for Manipularium
-- ==========================================
-- Run these indexes on your Supabase database for optimal performance

-- 1. Bank Entries Indexes
-- Most queries filter by day and user_id together
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bank_entries_day_user_id
ON bank_entries(day, user_id);

-- Status filtering is common
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bank_entries_status_day
ON bank_entries(status, day) WHERE status != 'archived';

-- Value-based searches
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bank_entries_value_cents
ON bank_entries(value_cents) WHERE status = 'pending';

-- Date range queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bank_entries_transaction_date
ON bank_entries(transaction_date) WHERE status != 'archived';

-- 2. Cash Conference Entries Indexes
-- Primary query pattern
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cash_conference_day_user_id
ON cash_conference_entries(day, user_id);

-- Conference status filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cash_conference_status_date
ON cash_conference_entries(conference_status, conference_date)
WHERE conference_status = 'active';

-- Value matching for reconciliation
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cash_conference_value_day
ON cash_conference_entries(conferred_value, day);

-- 3. Not Found History Indexes
-- Daily queries by user
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_not_found_day_user_id
ON not_found_history(day, user_id);

-- Search timestamp for recent searches
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_not_found_search_timestamp
ON not_found_history(search_timestamp DESC) WHERE status = 'not_found';

-- Value pattern searching
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_not_found_normalized_value
ON not_found_history(normalized_value) WHERE status = 'not_found';

-- 4. Manual Entries Indexes
-- User daily operations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_manual_entries_day_user_id
ON manual_entries(day, user_id);

-- Entry type filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_manual_entries_type_date
ON manual_entries(entry_type, created_at);

-- 5. Banking Files/Uploads Indexes
-- User file history
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bank_uploads_day_user_id
ON bank_uploads(day, user_id);

-- Upload status tracking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bank_uploads_status_date
ON bank_uploads(upload_status, upload_date) WHERE upload_status != 'failed';

-- File name searches
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bank_uploads_filename
ON bank_uploads(file_name) WHERE upload_status = 'completed';

-- 6. Profiles and Authentication
-- Username lookups (case-insensitive)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_username_lower
ON profiles(LOWER(username));

-- Active user filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_active_role
ON profiles(is_active, role) WHERE is_active = true;

-- 7. Composite Indexes for Complex Queries
-- Banking transactions with multiple filters
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bank_entries_complex
ON bank_entries(user_id, day, status, payment_type)
WHERE status IN ('pending', 'conferred');

-- Conference reconciliation
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cash_conference_reconciliation
ON cash_conference_entries(user_id, conference_date, conference_status, conferred_value)
WHERE conference_status = 'active';

-- Performance monitoring index
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_operation_performance
ON bank_entries(created_at, value_cents)
WHERE created_at > NOW() - INTERVAL '7 days';

-- ==========================================
-- Index Maintenance Commands
-- ==========================================

-- Check index usage
-- SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
-- FROM pg_stat_user_indexes
-- ORDER BY idx_scan DESC;

-- Check index sizes
-- SELECT schemaname, tablename, indexname,
--        pg_size_pretty(pg_relation_size(indexrelid)) as index_size
-- FROM pg_stat_user_indexes
-- ORDER BY pg_relation_size(indexrelid) DESC;

-- Monitor query performance
-- SELECT query, calls, total_time, mean_time, rows
-- FROM pg_stat_statements
-- WHERE query ILIKE '%bank_entries%' OR query ILIKE '%cash_conference%'
-- ORDER BY total_time DESC;

-- ==========================================
-- Application-Level Optimizations
-- ==========================================

-- Enable row-level security with proper policies
-- ALTER TABLE bank_entries ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE cash_conference_entries ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE not_found_history ENABLE ROW LEVEL SECURITY;

-- Create optimized RLS policies
-- CREATE POLICY bank_entries_user_policy ON bank_entries
-- FOR ALL USING (auth.uid() = user_id);

-- CREATE POLICY cash_conference_user_policy ON cash_conference_entries
-- FOR ALL USING (auth.uid() = user_id);

-- ==========================================
-- Performance Recommendations
-- ==========================================

/*
1. VACUUM and ANALYZE regularly:
   - Run VACUUM ANALYZE weekly on high-traffic tables
   - Monitor table bloat with pg_stat_user_tables

2. Connection pooling:
   - Use pgBouncer or Supabase pooling
   - Limit concurrent connections per user

3. Query optimization:
   - Always include user_id in WHERE clauses for RLS
   - Use LIMIT for pagination instead of OFFSET
   - Prefer EXISTS over IN for subqueries

4. Application-level caching:
   - Cache frequently accessed data in IndexedDB
   - Implement stale-while-revalidate pattern
   - Use React Query for server state management

5. Monitoring:
   - Set up alerts for slow queries (>1s)
   - Monitor index hit ratio (should be >95%)
   - Track connection pool utilization
*/