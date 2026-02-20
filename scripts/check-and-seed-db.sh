#!/bin/bash

echo "Checking production database..."

# Set the direct database URL (not the Accelerate URL)
export DATABASE_URL="postgres://d113aa485f22861c11968bb73c881cf9d94237260a82ccce900063c78c8ef456:sk_18tNM4N1m_SE0CjWAUJal@db.prisma.io:5432/postgres?sslmode=require"

echo "Running migrations..."
npx prisma db push --skip-generate

echo "Seeding database..."
npm run db:seed

echo "Seeding nutrition facts & ingredients..."
npm run db:seed:nutrition

echo "Checking if products exist..."
npx prisma db execute --stdin << 'SQL'
SELECT COUNT(*) as product_count FROM products;
SQL

echo "Done! Check your website now."
