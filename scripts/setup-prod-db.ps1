# Production Database Setup Script
# Run this after you have the DATABASE_URL from Supabase dashboard

param(
    [Parameter(Mandatory=$true)]
    [string]$DatabaseUrl
)

Write-Host "Setting up production database schema..." -ForegroundColor Green

# Set environment variable for this session
$env:DATABASE_URL = $DatabaseUrl

# Push schema to production
Write-Host "Pushing Prisma schema..." -ForegroundColor Yellow
npx prisma db push --accept-data-loss

# Generate Prisma client
Write-Host "Generating Prisma client..." -ForegroundColor Yellow
npx prisma generate

Write-Host "Schema setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Migrate reference data (see DATA_MIGRATION.md)"
Write-Host "2. Configure OAuth providers in Supabase dashboard"
Write-Host "3. Set up environment variables in Vercel"


