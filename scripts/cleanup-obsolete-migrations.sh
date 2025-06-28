#!/bin/bash

# Cleanup Obsolete Migration Files
# This script removes migration files that have been consolidated into schema-v2.sql and schema-v3.sql
# Run this from the cultivest-backend directory

set -e

echo "🧹 Cultivest Database Schema Cleanup"
echo "=====================================ꘫ"
echo ""

# Check if we're in the right directory
if [ ! -f "scripts/schema-v2.sql" ] || [ ! -f "scripts/schema-v3.sql" ]; then
    echo "❌ Error: Please run this script from the cultivest-backend directory"
    echo "   Expected files: scripts/schema-v2.sql and scripts/schema-v3.sql"
    exit 1
fi

echo "📍 Current directory: $(pwd)"
echo "✅ Found schema-v2.sql and schema-v3.sql"
echo ""

# Files to be removed (consolidated into V2 and V3)
OBSOLETE_FILES=(
    "scripts/add-deposits-table.sql"
    "scripts/bitcoin-migration.sql"
    "scripts/bitcoin-migration-clean.sql"
    "scripts/add-investment-tx-field.sql"
    "scripts/create-user-portfolio-table.sql"
    "scripts/add-solana-support.sql"
)

# Files to keep
KEEP_FILES=(
    "scripts/schema.sql"
    "scripts/schema-v2.sql"
    "scripts/schema-v3.sql"
    "scripts/clean-users.sql"
    "scripts/simple-setup.ts"
    "scripts/README.md"
    "scripts/cleanup-obsolete-migrations.sh"
)

echo "🔍 Checking obsolete files..."
echo ""

# Check which files exist
FILES_TO_DELETE=()
for file in "${OBSOLETE_FILES[@]}"; do
    if [ -f "$file" ]; then
        FILES_TO_DELETE+=("$file")
        echo "   📄 Found: $file"
    else
        echo "   ⚪ Missing: $file (already removed)"
    fi
done

echo ""

if [ ${#FILES_TO_DELETE[@]} -eq 0 ]; then
    echo "✅ No obsolete files found. Cleanup already completed!"
    exit 0
fi

echo "📋 Summary:"
echo "   Files to DELETE: ${#FILES_TO_DELETE[@]}"
echo "   Files to KEEP: ${#KEEP_FILES[@]}"
echo ""

echo "💾 Files that will be KEPT (important):"
for file in "${KEEP_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "   ✅ $file"
    else
        echo "   ⚠️  $file (missing)"
    fi
done
echo ""

echo "🗑️  Files that will be DELETED (obsolete):"
for file in "${FILES_TO_DELETE[@]}"; do
    echo "   ❌ $file"
done
echo ""

# Safety confirmation
read -p "⚠️  Are you sure you want to delete these obsolete migration files? (y/N): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Cleanup cancelled. No files were deleted."
    exit 0
fi

echo ""
echo "🗑️  Deleting obsolete migration files..."
echo ""

# Delete files
DELETED_COUNT=0
for file in "${FILES_TO_DELETE[@]}"; do
    if [ -f "$file" ]; then
        echo "   🗑️  Deleting: $file"
        rm "$file"
        DELETED_COUNT=$((DELETED_COUNT + 1))
    fi
done

echo ""
echo "✅ Cleanup completed successfully!"
echo "   📊 Deleted $DELETED_COUNT obsolete migration files"
echo ""

# Show final state
echo "📁 Current schema files:"
ls -la scripts/schema*.sql 2>/dev/null || echo "   No schema files found"
echo ""

echo "📚 Next steps:"
echo "   1. Use 'scripts/schema-v2.sql' for deployments without Solana"
echo "   2. Use 'scripts/schema-v3.sql' for deployments with Solana support"
echo "   3. See 'docs/SCHEMA_VERSIONING.md' for detailed documentation"
echo ""

echo "🎉 Database schema versioning is now clean and organized!" 