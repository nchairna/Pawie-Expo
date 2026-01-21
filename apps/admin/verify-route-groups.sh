#!/bin/bash
# Verify route groups structure

echo "Verifying route groups migration..."
echo ""

# Check if new route groups exist
echo "Checking route groups..."
if [ -d "app/(auth)" ]; then
  echo "✓ (auth) route group exists"
else
  echo "✗ (auth) route group missing"
  exit 1
fi

if [ -d "app/(dashboard)" ]; then
  echo "✓ (dashboard) route group exists"
else
  echo "✗ (dashboard) route group missing"
  exit 1
fi

echo ""
echo "Checking layouts..."
if [ -f "app/(auth)/layout.tsx" ]; then
  echo "✓ Auth layout exists"
else
  echo "✗ Auth layout missing"
  exit 1
fi

if [ -f "app/(dashboard)/layout.tsx" ]; then
  echo "✓ Dashboard layout exists"
else
  echo "✗ Dashboard layout missing"
  exit 1
fi

echo ""
echo "Checking key pages in (auth)..."
for page in login register forbidden; do
  if [ -d "app/(auth)/$page" ]; then
    echo "✓ $page exists in (auth)"
  else
    echo "✗ $page missing from (auth)"
    exit 1
  fi
done

echo ""
echo "Checking key pages in (dashboard)..."
for page in products orders inventory families tags autoships discounts; do
  if [ -d "app/(dashboard)/$page" ]; then
    echo "✓ $page exists in (dashboard)"
  else
    echo "✗ $page missing from (dashboard)"
    exit 1
  fi
done

if [ -f "app/(dashboard)/page.tsx" ]; then
  echo "✓ Dashboard home page exists"
else
  echo "✗ Dashboard home page missing"
  exit 1
fi

echo ""
echo "Checking old directories (should still exist until manual cleanup)..."
OLD_DIRS=("app/products" "app/orders" "app/login")
for dir in "${OLD_DIRS[@]}"; do
  if [ -d "$dir" ]; then
    echo "⚠ $dir still exists (needs cleanup after verification)"
  fi
done

echo ""
echo "✓ All route groups verified successfully!"
echo ""
echo "Next steps:"
echo "1. Start dev server: pnpm dev:admin"
echo "2. Test all routes listed in ROUTE_GROUPS_MIGRATION.md"
echo "3. Once verified, run cleanup script or manually delete old directories"
