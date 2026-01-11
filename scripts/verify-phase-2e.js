#!/usr/bin/env node

/**
 * Phase 2E Implementation Verification Script
 * Checks code-level requirements automatically
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const adminDir = path.join(rootDir, 'apps', 'admin');
const mobileDir = path.join(rootDir, 'apps', 'mobile');

let allPassed = true;
const results = [];

function checkFileExists(filePath, description) {
  const fullPath = path.join(rootDir, filePath);
  const exists = fs.existsSync(fullPath);
  if (!exists) {
    results.push(`❌ ${description}: File not found at ${filePath}`);
    return false;
  }
  results.push(`✅ ${description}: Found at ${filePath}`);
  return true;
}

function checkFileContains(filePath, searchText, description) {
  const fullPath = path.join(rootDir, filePath);
  if (!fs.existsSync(fullPath)) {
    results.push(`❌ ${description}: File not found`);
    return false;
  }
  const content = fs.readFileSync(fullPath, 'utf8');
  const contains = content.includes(searchText);
  if (!contains) {
    results.push(`❌ ${description}: Not found in ${filePath}`);
    return false;
  }
  results.push(`✅ ${description}: Found in ${filePath}`);
  return true;
}

console.log('🔍 Verifying Phase 2E Implementation...\n');

// 2E.1 Shared Auth Rules
console.log('📋 2E.1 Shared Auth Rules');
checkFileExists('apps/admin/lib/auth.ts', 'Admin auth utilities');
checkFileExists('apps/mobile/lib/auth.ts', 'Mobile auth utilities');
checkFileContains('apps/admin/lib/auth.ts', 'getCurrentProfile', 'getCurrentProfile function (admin)');
checkFileContains('apps/mobile/lib/auth.ts', 'getCurrentProfile', 'getCurrentProfile function (mobile)');
checkFileContains('apps/admin/lib/auth.ts', 'signIn', 'signIn function (admin)');
checkFileContains('apps/mobile/lib/auth.ts', 'signIn', 'signIn function (mobile)');
checkFileContains('apps/mobile/lib/auth.ts', 'signUp', 'signUp function (mobile)');
checkFileContains('apps/admin/lib/auth.ts', 'signUp', 'signUp function (admin)');

// 2E.2 Admin App Auth
console.log('\n📋 2E.2 Admin App Auth');
checkFileExists('apps/admin/app/login/page.tsx', 'Admin login page');
checkFileExists('apps/admin/app/forbidden/page.tsx', 'Admin forbidden page');
checkFileExists('apps/admin/app/register/page.tsx', 'Admin register page');
checkFileExists('apps/admin/proxy.ts', 'Admin route guard (proxy)');
checkFileContains('apps/admin/proxy.ts', 'profile.role !== \'admin\'', 'Admin role check in proxy');
checkFileContains('apps/admin/app/login/page.tsx', 'Email', 'Email field in admin login');
checkFileContains('apps/admin/app/login/page.tsx', 'Password', 'Password field in admin login');
checkFileContains('apps/admin/app/login/page.tsx', 'Button', 'Sign in button (shadcn/ui)');
checkFileContains('apps/admin/app/login/page.tsx', 'toast', 'Toast notifications');

// 2E.3 Mobile App Auth
console.log('\n📋 2E.3 Mobile App Auth');
checkFileExists('apps/mobile/app/login.tsx', 'Mobile login screen');
checkFileExists('apps/mobile/app/register.tsx', 'Mobile register screen');
checkFileExists('apps/mobile/app/(tabs)/account.tsx', 'Mobile account screen');
checkFileExists('apps/mobile/contexts/AuthContext.tsx', 'Mobile AuthContext');
checkFileContains('apps/mobile/app/(tabs)/account.tsx', 'signOut', 'Logout button in account screen');
checkFileContains('apps/mobile/app/(tabs)/orders.tsx', 'router.push(\'/login\')', 'Orders tab requires login');
checkFileContains('apps/mobile/app/(tabs)/pets.tsx', 'router.push(\'/login\')', 'Pets tab requires login');
checkFileContains('apps/mobile/contexts/AuthContext.tsx', 'getSession', 'Session reading on startup');
checkFileContains('apps/mobile/contexts/AuthContext.tsx', 'onAuthStateChange', 'Auth state listener');

// Route Guards
console.log('\n📋 Route Guards');
checkFileContains('apps/admin/proxy.ts', '/products', 'Products route protection');
checkFileContains('apps/admin/proxy.ts', '/login', 'Login redirect');
checkFileContains('apps/admin/proxy.ts', '/forbidden', 'Forbidden redirect');

console.log('\n' + '='.repeat(60));
console.log('📊 Verification Results:\n');
results.forEach(r => console.log(r));

const failed = results.filter(r => r.startsWith('❌')).length;
const passed = results.filter(r => r.startsWith('✅')).length;

console.log('\n' + '='.repeat(60));
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`📝 Total: ${results.length}`);

if (failed === 0) {
  console.log('\n🎉 All code-level checks passed!');
  console.log('\n⚠️  Note: Manual testing is still required for:');
  console.log('   - Actual login/register flows');
  console.log('   - Session persistence');
  console.log('   - Route guard behavior');
  console.log('   - Profile creation after signup');
  process.exit(0);
} else {
  console.log('\n⚠️  Some checks failed. Please review the results above.');
  process.exit(1);
}







