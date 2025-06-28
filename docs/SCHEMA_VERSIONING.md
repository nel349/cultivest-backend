# Database Schema Versioning Guide

## Overview

This document outlines the database schema versioning strategy for the Cultivest multi-chain investment platform. Instead of maintaining multiple migration scripts, we use consolidated schema versions that capture the complete database state at major milestones.

## Current Schema Versions

### V1 (Original) - `schema.sql`
**Status**: DEPRECATED - Use V2 or V3 instead
- **Size**: 16KB, 349 lines
- **Features**: Basic single-chain Algorand platform
- **Tables**: `users`, `wallets`, `transactions`, `investment_positions`, `badges`, `educational_content`, `deposits`
- **Blockchain Support**: Algorand only
- **Asset Types**: USDC/USDCa only

### V2 (Multi-Chain) - `schema-v2.sql` 
**Status**: STABLE CHECKPOINT
- **Size**: 28KB, 637 lines
- **Features**: Bitcoin + Algorand multi-chain platform
- **Major Changes from V1**:
  - Added Bitcoin wallet support (`bitcoin_address`, `encrypted_bitcoin_private_key`, `balance_btc`)
  - New `investments` table for Bitcoin/Algorand tracking
  - Enhanced `deposits` table with multi-currency support (`target_currency`, `amount_btc`)
  - NFT portfolio system (`portfolio_nfts`, `position_nfts`, `user_nft_portfolios`)
  - Bitcoin-focused badges and educational content
  - Multi-chain balance tracking in `users` table
- **Blockchain Support**: Bitcoin + Algorand
- **Asset Types**: BTC (Type 1), ALGO (Type 2), USDC (Type 3)

### V3 (Tri-Chain + Solana) - `schema-v3.sql`
**Status**: LATEST WITH SOLANA
- **Size**: 28KB, 678 lines
- **Features**: Bitcoin + Algorand + Solana tri-chain platform
- **Major Changes from V2**:
  - Added Solana wallet support (`solana_address`, `encrypted_solana_private_key`, `balance_sol`)
  - Extended investment tracking for SOL (`estimated_sol`, `solana_price_usd`)
  - Solana deposit support (`amount_sol`, target_currency='sol', status='sol_received')
  - Tri-chain portfolio NFTs (`sol_holdings`)
  - Solana-focused badges and educational content
  - Enhanced constraint validation for SOL assets
- **Blockchain Support**: Bitcoin + Algorand + Solana
- **Asset Types**: BTC (Type 1), ALGO (Type 2), USDC (Type 3), SOL (Type 4)

## Key Schema Changes by Version

### V1 → V2 Changes
```sql
-- Wallets table enhancements
ALTER TABLE wallets ADD COLUMN bitcoin_address VARCHAR(64);
ALTER TABLE wallets ADD COLUMN encrypted_bitcoin_private_key TEXT;
ALTER TABLE wallets ADD COLUMN balance_btc DECIMAL(18,8) DEFAULT 0;
ALTER TABLE wallets ADD COLUMN blockchain VARCHAR(20) DEFAULT 'multi-chain';

-- New investments table
CREATE TABLE investments (
  target_asset VARCHAR(10) CHECK (target_asset IN ('BTC', 'ALGO', 'USDC')),
  estimated_btc DECIMAL(18,8),
  bitcoin_price_usd DECIMAL(18,2),
  -- ... other fields
);

-- NFT portfolio system
CREATE TABLE portfolio_nfts (...);
CREATE TABLE position_nfts (...);
CREATE TABLE user_nft_portfolios (...);
```

### V2 → V3 Changes
```sql
-- Add Solana support to wallets
ALTER TABLE wallets ADD COLUMN solana_address VARCHAR(44);
ALTER TABLE wallets ADD COLUMN encrypted_solana_private_key TEXT;
ALTER TABLE wallets ADD COLUMN balance_sol DECIMAL(18,9) DEFAULT 0;

-- Update constraints for Solana
ALTER TABLE investments ADD CONSTRAINT check_target_asset 
CHECK (target_asset IN ('BTC', 'ALGO', 'USDC', 'SOL'));

-- Add Solana fields to investments
ALTER TABLE investments ADD COLUMN estimated_sol DECIMAL(18,9);
ALTER TABLE investments ADD COLUMN solana_price_usd DECIMAL(18,6);

-- Add Solana support to deposits and portfolios
ALTER TABLE deposits ADD COLUMN amount_sol DECIMAL(18,9);
ALTER TABLE portfolio_nfts ADD COLUMN sol_holdings DECIMAL(18,9) DEFAULT 0;
```

## Migration Strategy

### For New Deployments
Use the latest schema version directly:

```bash
# For new production deployment
psql -f cultivest-backend/scripts/schema-v3.sql

# For testing with V2 (without Solana)
psql -f cultivest-backend/scripts/schema-v2.sql
```

### For Existing Deployments
If you're running an older version, you have two options:

#### Option 1: Incremental Migration (Production)
```bash
# If on V1, apply individual migrations
psql -f cultivest-backend/scripts/bitcoin-migration.sql
psql -f cultivest-backend/scripts/create-user-portfolio-table.sql
psql -f cultivest-backend/scripts/add-investment-tx-field.sql
psql -f cultivest-backend/scripts/add-solana-support.sql
```

#### Option 2: Fresh Schema with Data Export (Recommended)
```bash
# 1. Export existing data
pg_dump --data-only --inserts your_db > data_backup.sql

# 2. Drop and recreate with V3
psql -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
psql -f cultivest-backend/scripts/schema-v3.sql

# 3. Restore data (may need adaptation for new fields)
psql -f data_backup.sql
```

## Obsolete Migration Files

With the consolidated schema versions, these individual migration files can be **SAFELY DELETED**:

### Ready for Deletion
- `add-deposits-table.sql` → Consolidated into V2+
- `bitcoin-migration.sql` → Consolidated into V2+
- `bitcoin-migration-clean.sql` → Consolidated into V2+
- `add-investment-tx-field.sql` → Consolidated into V2+
- `create-user-portfolio-table.sql` → Consolidated into V2+
- `add-solana-support.sql` → Consolidated into V3

### Keep These Files
- `schema.sql` → Historical reference (V1)
- `schema-v2.sql` → Stable checkpoint without Solana
- `schema-v3.sql` → Latest with full tri-chain support
- `clean-users.sql` → Utility script for development
- `simple-setup.ts` → Development setup script

## Database Field Specifications

### Precision Standards
- **Bitcoin**: `DECIMAL(18,8)` - 8 decimal places (satoshi precision)
- **Algorand**: `DECIMAL(18,6)` - 6 decimal places (standard crypto precision)
- **Solana**: `DECIMAL(18,9)` - 9 decimal places (lamport precision)
- **USD Values**: `DECIMAL(18,2)` - 2 decimal places (currency standard)
- **Percentages**: `DECIMAL(8,4)` - 4 decimal places (2.5000%)

### Address Formats
- **Bitcoin**: `VARCHAR(64)` - Base58 encoded addresses
- **Algorand**: `VARCHAR(64)` - Base32 encoded, 58 characters
- **Solana**: `VARCHAR(44)` - Base58 encoded, 32-44 characters

### Asset Type Mapping
- **Type 1**: Bitcoin (BTC)
- **Type 2**: Algorand (ALGO)  
- **Type 3**: USD Coin (USDC/USDCa)
- **Type 4**: Solana (SOL)

## Best Practices

### Before Schema Changes
1. **Test locally** with the new schema version
2. **Backup production database** before any changes
3. **Verify all application code** works with new schema
4. **Update API contracts** and TypeScript interfaces

### Schema Evolution Rules
1. **Never remove existing columns** without careful deprecation
2. **Always add new columns as nullable** initially
3. **Use CHECK constraints** for data validation
4. **Create indexes** for new searchable fields
5. **Update RLS policies** for new tables

### Version Control
1. **Tag releases** with schema version used
2. **Document breaking changes** in release notes
3. **Keep schema files** in version control
4. **Test migrations** in staging environment first

## Development Workflow

### Local Development
```bash
# Start fresh with latest schema
dropdb cultivest_dev
createdb cultivest_dev
psql cultivest_dev -f cultivest-backend/scripts/schema-v3.sql
npm run dev
```

### Feature Development
```bash
# Create feature branch
git checkout -b feature/new-blockchain-support

# Modify schema-v3.sql for new features
# Test changes locally
# Update TypeScript interfaces
# Update API endpoints

# When ready, increment to V4
cp schema-v3.sql schema-v4.sql
# Make changes to schema-v4.sql
```

### Production Deployment
```bash
# 1. Test with production-like data volume
# 2. Plan maintenance window
# 3. Execute migration during low-traffic period
# 4. Monitor application health post-migration
# 5. Have rollback plan ready
```

## Troubleshooting

### Common Issues

#### Column Already Exists
```sql
-- Use IF NOT EXISTS for safety
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS solana_address VARCHAR(44);
```

#### Constraint Violations
```sql
-- Check existing data before adding constraints
SELECT target_asset, COUNT(*) FROM investments 
WHERE target_asset NOT IN ('BTC', 'ALGO', 'USDC', 'SOL') 
GROUP BY target_asset;
```

#### Index Creation Failures
```sql
-- Use IF NOT EXISTS for idempotent operations
CREATE INDEX IF NOT EXISTS idx_wallets_solana_address ON wallets(solana_address);
```

### Recovery Procedures

#### Schema Version Mismatch
1. Check current schema version in database
2. Compare with application expectations
3. Apply missing migrations or rollback to compatible version

#### Data Corruption
1. Restore from latest backup
2. Apply migrations step by step
3. Validate data integrity at each step

## Future Versioning

### When to Create New Version
- **Major blockchain addition** (new asset type)
- **Breaking schema changes** (column removals, type changes)
- **Major feature additions** (new table relationships)
- **Performance optimizations** (significant index changes)

### Version Naming Convention
- **V4**: Next major version (e.g., Ethereum support, Asset Type 5)
- **V5**: Further expansions (e.g., Polygon, Arbitrum)
- **V6**: Major architectural changes (e.g., sharding, partitioning)

---

**Last Updated**: December 2024  
**Current Production Version**: V3 (Tri-chain with Solana)  
**Next Planned Version**: V4 (TBD - possibly Ethereum support) 