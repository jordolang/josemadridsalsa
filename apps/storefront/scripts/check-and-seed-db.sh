#!/bin/bash

echo "Checking production database..."

if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL must be set before running this script."
  exit 1
fi

echo "Running migrations..."
npx prisma db push --skip-generate

echo "Seeding database..."
npm run db:seed

echo "Checking if products exist..."
npx prisma db execute --stdin << 'SQL'
SELECT COUNT(*) as product_count FROM products;
SQL

echo "Done! Check your website now."
