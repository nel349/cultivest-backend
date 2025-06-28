# Database Scripts

## Overview

This directory contains database schema files and utilities for the Cultivest multi-chain investment platform.

## 🚀 Quick Start

### New Deployment
```bash
# For production with full Solana support
psql your_database -f scripts/schema-v3.sql

# For testing without Solana
psql your_database -f scripts/schema-v2.sql
```

### Existing Deployment
```bash
# Run individual migrations (if needed)
psql your_database -f scripts/add-solana-support.sql
```

## 📁 Current Schema Files

### Production Ready
- **`schema-v3.sql`** - ✅ **LATEST** - Full tri-chain support (Bitcoin + Algorand + Solana)
  - Asset Types: BTC (1), ALGO (2), USDC (3), SOL (4)
  - 678 lines, complete tri-chain wallet system
- **`schema-v2.sql`** - ⚡ **STABLE** - Multi-chain without Solana (Bitcoin + Algorand)
  - Asset Types: BTC (1), ALGO (2), USDC (3)
  - 637 lines, good for testing
- **`schema.sql`** - 📚 **LEGACY** - Original single-chain (Algorand only)
  - 349 lines, deprecated but kept for reference

### Migration Files
- **`add-solana-support.sql`** - Incremental Solana migration (use V3 instead)

### Development Utilities
- **`clean-users.sql`** - Reset user data for development
- **`simple-setup.ts`** - TypeScript setup utilities
- **`cleanup-obsolete-migrations.sh`** - Remove obsolete migration files

## 🔄 Schema Versioning

We use **consolidated schema versions** instead of multiple migration files:

| Version | Status | Features | Use Case |
|---------|--------|----------|----------|
| **V1** | Deprecated | Algorand only | Historical reference |
| **V2** | Stable | Bitcoin + Algorand | Testing without Solana |
| **V3** | Latest | Bitcoin + Algorand + Solana | Production deployment |

### Migration Strategy
1. **New projects**: Use `schema-v3.sql` directly
2. **Existing projects**: Apply incremental migrations or export/import data
3. **Testing**: Use `schema-v2.sql` for simpler setup

## 🧹 Cleanup Obsolete Files

Run the cleanup script to remove migration files that have been consolidated:

```bash
cd cultivest-backend
./scripts/cleanup-obsolete-migrations.sh
```

This will safely remove:
- `add-deposits-table.sql` → Consolidated into V2+
- `bitcoin-migration.sql` → Consolidated into V2+
- `bitcoin-migration-clean.sql` → Consolidated into V2+
- `add-investment-tx-field.sql` → Consolidated into V2+
- `create-user-portfolio-table.sql` → Consolidated into V2+

## 📊 Database Specifications

### Precision Standards
- **Bitcoin**: `DECIMAL(18,8)` - Satoshi precision
- **Algorand**: `DECIMAL(18,6)` - Standard crypto precision  
- **Solana**: `DECIMAL(18,9)` - Lamport precision
- **USD**: `DECIMAL(18,2)` - Currency precision

### Asset Type Mapping
- **Type 1**: Bitcoin (BTC) 
- **Type 2**: Algorand (ALGO)
- **Type 3**: USD Coin (USDC/USDCa)
- **Type 4**: Solana (SOL)

## 🛠️ Development Workflow

### Local Setup
```bash
# Drop existing database and start fresh
dropdb cultivest_dev
createdb cultivest_dev

# Apply latest schema
psql cultivest_dev -f scripts/schema-v3.sql

# Start development server
npm run dev
```

### Testing Migrations
```bash
# Test on development database first
psql cultivest_dev -f scripts/add-solana-support.sql

# Verify application still works
npm test
```

## 🔒 Production Deployment

### Pre-deployment Checklist
- [ ] Backup production database
- [ ] Test schema changes in staging
- [ ] Verify all application code compatibility
- [ ] Plan maintenance window
- [ ] Prepare rollback strategy

### Deployment Commands
```bash
# Create backup
pg_dump production_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Apply schema (choose appropriate version)
psql production_db -f scripts/schema-v3.sql

# Verify deployment
psql production_db -c "SELECT COUNT(*) FROM users;"
```

## 🆘 Troubleshooting

### Common Issues

**Column already exists**
```sql
-- Use IF NOT EXISTS in migrations
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS solana_address VARCHAR(44);
```

**Missing dependencies**
```bash
# Install PostgreSQL client tools
brew install postgresql  # macOS
sudo apt-get install postgresql-client  # Ubuntu
```

**Permission errors**
```bash
# Set correct database permissions
GRANT ALL PRIVILEGES ON DATABASE cultivest TO your_user;
```

### Recovery
1. **Schema mismatch**: Check current version with `\d` in psql
2. **Data corruption**: Restore from backup and reapply changes
3. **Performance issues**: Check indexes with `\di` in psql

## 📚 Documentation

For detailed versioning information, see:
- **[Schema Versioning Guide](../docs/SCHEMA_VERSIONING.md)** - Complete versioning strategy
- **[Architecture Guide](../docs/ALGORAND_ARCHITECTURE.md)** - System architecture
- **[Smart Contracts Guide](../docs/SMART_CONTRACTS_GUIDE.md)** - NFT and contract integration

## 🚧 Future Plans

### V4 Roadmap (Planned)
- Ethereum support (Asset Type 5)
- Layer 2 integration (Polygon, Arbitrum)
- Enhanced analytics tables
- Performance optimizations

---

**Last Updated**: December 2024  
**Current Version**: V3 (Tri-chain with Solana)  
**Contact**: Development Team for migration support