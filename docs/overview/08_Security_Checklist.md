# Doc 08 — Security Checklist

**Product**: Pawie
**Version**: v1.0
**Last Updated**: 2026-01-10
**Status**: Source of Truth

---

## 1. Purpose

This document provides security guidelines and checklists for developing and deploying the Pawie e-commerce platform. Follow these practices throughout development and verify all items before production release.

**Applies to**:
- Mobile app (Expo/React Native)
- Admin app (Next.js)
- Backend (Supabase/PostgreSQL)
- Infrastructure and deployment

---

## 2. Security Principles

1. **Defense in Depth**: Multiple layers of security, never rely on a single control
2. **Least Privilege**: Grant minimum permissions needed for each role
3. **Secure by Default**: Security should not require opt-in
4. **Never Trust Client**: All validation and authorization on server
5. **Fail Securely**: Errors should not expose sensitive information
6. **Audit Everything**: Log security-relevant events for investigation

---

## 3. Development Phase Security

### 3.1 Environment & Secrets Management

| Item | Check | Notes |
|------|-------|-------|
| `.env` files in `.gitignore` | [ ] | Never commit environment files |
| No secrets in code | [ ] | Search codebase for API keys, passwords |
| No secrets in comments | [ ] | Remove TODO comments with credentials |
| Separate env per environment | [ ] | dev/staging/prod have different keys |
| Service role key NOT in client apps | [ ] | **CRITICAL**: Only anon key in mobile/admin |
| Rotate compromised secrets immediately | [ ] | Have a rotation procedure ready |

**Verification Commands**:
```bash
# Search for potential secrets in codebase
grep -r "sk_live\|sk_test\|password\|secret\|apikey" --include="*.ts" --include="*.tsx" --include="*.js"

# Check for .env files tracked by git
git ls-files | grep -E "\.env"

# Search for Supabase service role key patterns
grep -r "service_role\|eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" --include="*.ts" --include="*.tsx"
```

---

### 3.2 Authentication Security

| Item | Check | Notes |
|------|-------|-------|
| Password minimum length (8+ chars) | [ ] | Enforce in Supabase Auth settings |
| Email verification enabled | [ ] | Prevent fake account creation |
| Rate limiting on auth endpoints | [ ] | Supabase has built-in, verify enabled |
| Session expiry configured | [ ] | Reasonable timeout (e.g., 7 days) |
| Secure session storage (mobile) | [ ] | Use SecureStore, not AsyncStorage for tokens |
| HttpOnly cookies (admin) | [ ] | Prevent XSS token theft |
| Logout clears all session data | [ ] | Verify on both apps |
| Password reset flow secure | [ ] | Token expires, single use |
| No user enumeration | [ ] | Same error for "user not found" and "wrong password" |

**Mobile App Token Storage**:
```typescript
// WRONG - Insecure
import AsyncStorage from '@react-native-async-storage/async-storage';
await AsyncStorage.setItem('token', accessToken);

// RIGHT - Secure
import * as SecureStore from 'expo-secure-store';
await SecureStore.setItemAsync('token', accessToken);
```

---

### 3.3 Row Level Security (RLS)

| Item | Check | Notes |
|------|-------|-------|
| RLS enabled on ALL tables | [ ] | No exceptions |
| No `USING (true)` policies in production | [ ] | Review all policies |
| Admin check uses `is_admin()` function | [ ] | Centralized admin verification |
| Users can only access own data | [ ] | Test with multiple user accounts |
| Anon users have read-only product access | [ ] | Verify cannot modify |
| Service role bypasses RLS (server only) | [ ] | Never expose service role to client |
| RLS policies tested with different roles | [ ] | Test as anon, user, admin |

**RLS Verification Queries**:
```sql
-- Check RLS is enabled on all tables
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';

-- List all RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public';

-- Test user isolation (run as user A, should not see user B data)
SELECT * FROM orders WHERE user_id != auth.uid();  -- Should return 0 rows
```

**Common RLS Mistakes to Avoid**:
```sql
-- WRONG: Allows anyone to read all data
CREATE POLICY "Anyone can read" ON products FOR SELECT USING (true);

-- RIGHT: Only published products visible to non-admins
CREATE POLICY "Published products visible" ON products FOR SELECT
USING (is_published = true OR is_admin());

-- WRONG: Trusts client-provided user_id
CREATE POLICY "Insert own data" ON orders FOR INSERT
WITH CHECK (true);  -- Anyone can insert with any user_id!

-- RIGHT: Enforces authenticated user
CREATE POLICY "Insert own data" ON orders FOR INSERT
WITH CHECK (user_id = auth.uid());
```

---

### 3.4 Input Validation & Sanitization

| Item | Check | Notes |
|------|-------|-------|
| Server-side validation on ALL inputs | [ ] | Never trust client validation alone |
| SQL injection prevention | [ ] | Use parameterized queries only |
| XSS prevention (admin app) | [ ] | Sanitize user-generated content |
| File upload validation | [ ] | Check file type, size, content |
| Price/quantity validated server-side | [ ] | Prevent negative or overflow values |
| Email format validation | [ ] | Server-side regex check |
| Phone number format validation | [ ] | Server-side validation |
| Address field length limits | [ ] | Prevent buffer overflow attacks |

**Parameterized Query Examples**:
```typescript
// WRONG - SQL Injection vulnerable
const { data } = await supabase
  .from('products')
  .select('*')
  .filter('name', 'eq', `${userInput}`);  // String interpolation is risky

// RIGHT - Supabase client handles parameterization
const { data } = await supabase
  .from('products')
  .select('*')
  .eq('name', userInput);  // Properly parameterized

// WRONG - Raw SQL with string concatenation
const result = await supabase.rpc('search', {
  query: `%${userInput}%`  // Could inject SQL
});

// RIGHT - Use proper escaping in function
CREATE FUNCTION search(query text) AS $$
  SELECT * FROM products WHERE name ILIKE '%' || query || '%';
  -- PostgreSQL handles escaping
$$;
```

**File Upload Validation**:
```typescript
// Validate file before upload
function validateImageFile(file: File): boolean {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  const maxSize = 5 * 1024 * 1024; // 5MB

  if (!allowedTypes.includes(file.type)) {
    throw new Error('Invalid file type');
  }
  if (file.size > maxSize) {
    throw new Error('File too large');
  }
  return true;
}
```

---

### 3.5 API Security

| Item | Check | Notes |
|------|-------|-------|
| All API calls use HTTPS | [ ] | No HTTP in production |
| API rate limiting configured | [ ] | Prevent abuse/DDoS |
| CORS configured correctly | [ ] | Restrict to known origins |
| No sensitive data in URLs | [ ] | Use POST body instead |
| API errors don't leak internals | [ ] | Generic error messages to client |
| Request size limits set | [ ] | Prevent large payload attacks |
| Timeout limits configured | [ ] | Prevent slow loris attacks |

**CORS Configuration (Supabase)**:
```
# In Supabase Dashboard > Settings > API
Allowed Origins:
- https://admin.pawie.com (production admin)
- https://pawie.com (if web app exists)
- http://localhost:3000 (development only - remove in prod)
```

---

### 3.6 Data Protection

| Item | Check | Notes |
|------|-------|-------|
| PII encrypted at rest | [ ] | Supabase handles this |
| PII encrypted in transit | [ ] | HTTPS enforced |
| Passwords hashed (never stored plain) | [ ] | Supabase Auth handles this |
| Payment data never stored | [ ] | Use payment provider tokens |
| Sensitive logs redacted | [ ] | No passwords/tokens in logs |
| Data retention policy defined | [ ] | How long to keep user data |
| Data deletion capability | [ ] | GDPR/privacy law compliance |
| Backup encryption | [ ] | Encrypted database backups |

**Sensitive Data Handling**:
```typescript
// WRONG - Logging sensitive data
console.log('User login:', { email, password });
console.log('Order created:', { ...order, creditCard });

// RIGHT - Redact sensitive fields
console.log('User login:', { email, password: '[REDACTED]' });
console.log('Order created:', { orderId: order.id, userId: order.user_id });
```

---

### 3.7 Mobile App Security (Expo/React Native)

| Item | Check | Notes |
|------|-------|-------|
| Secure token storage | [ ] | Use expo-secure-store |
| Certificate pinning (optional) | [ ] | Prevent MITM attacks |
| No sensitive data in AsyncStorage | [ ] | Only use for non-sensitive cache |
| App obfuscation enabled | [ ] | Hermes + ProGuard for Android |
| Debug mode disabled in release | [ ] | __DEV__ checks |
| Deep link validation | [ ] | Validate all deep link parameters |
| Biometric auth for sensitive actions | [ ] | Optional: order placement |
| Screen capture prevention (optional) | [ ] | For sensitive screens |
| Jailbreak/root detection (optional) | [ ] | Warn users on compromised devices |

**Secure Storage Implementation**:
```typescript
// lib/secureStorage.ts
import * as SecureStore from 'expo-secure-store';

export async function saveSecurely(key: string, value: string): Promise<void> {
  await SecureStore.setItemAsync(key, value, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED,
  });
}

export async function getSecurely(key: string): Promise<string | null> {
  return await SecureStore.getItemAsync(key);
}

export async function deleteSecurely(key: string): Promise<void> {
  await SecureStore.deleteItemAsync(key);
}
```

---

### 3.8 Admin App Security (Next.js)

| Item | Check | Notes |
|------|-------|-------|
| Admin routes protected | [ ] | Middleware checks admin role |
| CSRF protection enabled | [ ] | Next.js has built-in support |
| Content Security Policy (CSP) | [ ] | Prevent XSS attacks |
| X-Frame-Options header | [ ] | Prevent clickjacking |
| Secure cookie settings | [ ] | HttpOnly, Secure, SameSite |
| Admin action audit logging | [ ] | Log who did what when |
| Session timeout for admin | [ ] | Shorter than regular users |
| IP allowlist (optional) | [ ] | Restrict admin access by IP |
| Two-factor authentication | [ ] | Recommended for admin accounts |

**Security Headers (next.config.js)**:
```javascript
// next.config.js
const securityHeaders = [
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on'
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload'
  },
  {
    key: 'X-Frame-Options',
    value: 'SAMEORIGIN'
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  },
  {
    key: 'Referrer-Policy',
    value: 'origin-when-cross-origin'
  },
  {
    key: 'Content-Security-Policy',
    value: "default-src 'self'; img-src 'self' https://*.supabase.co; script-src 'self' 'unsafe-eval' 'unsafe-inline';"
  }
];

module.exports = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};
```

**Admin Middleware**:
```typescript
// middleware.ts
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  const { data: { session } } = await supabase.auth.getSession();

  // Check if accessing admin routes
  if (req.nextUrl.pathname.startsWith('/admin') ||
      req.nextUrl.pathname.startsWith('/products') ||
      req.nextUrl.pathname.startsWith('/orders')) {

    if (!session) {
      return NextResponse.redirect(new URL('/login', req.url));
    }

    // Verify admin role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.redirect(new URL('/forbidden', req.url));
    }
  }

  return res;
}
```

---

## 4. Pre-Production Security Checklist

### 4.1 Code Review Checklist

| Item | Check | Reviewer |
|------|-------|----------|
| No hardcoded secrets | [ ] | |
| No console.log with sensitive data | [ ] | |
| All user inputs validated | [ ] | |
| RLS policies reviewed | [ ] | |
| Error handling doesn't leak info | [ ] | |
| Authentication flows secure | [ ] | |
| Authorization checks on all endpoints | [ ] | |
| File uploads validated | [ ] | |
| SQL injection prevention verified | [ ] | |
| XSS prevention verified | [ ] | |

---

### 4.2 Infrastructure Checklist

| Item | Check | Notes |
|------|-------|-------|
| HTTPS enforced everywhere | [ ] | No HTTP allowed |
| SSL certificates valid | [ ] | Auto-renewal configured |
| Database not publicly accessible | [ ] | Only through Supabase API |
| Supabase project security settings reviewed | [ ] | Check dashboard |
| API keys rotated from development | [ ] | Fresh keys for production |
| Backup strategy in place | [ ] | Automated daily backups |
| Disaster recovery plan documented | [ ] | How to restore service |
| Monitoring and alerting configured | [ ] | Sentry, PostHog, etc. |

---

### 4.3 Supabase-Specific Security

| Item | Check | Notes |
|------|-------|-------|
| Email confirmations enabled | [ ] | Settings > Auth |
| Password strength requirements set | [ ] | Min 8 chars recommended |
| JWT expiry configured appropriately | [ ] | Balance security vs UX |
| RLS enabled on ALL tables | [ ] | Database > Tables |
| Service role key secured | [ ] | Only in server environments |
| Database webhooks reviewed | [ ] | No unintended triggers |
| Storage bucket policies set | [ ] | RLS on storage |
| Edge Functions secured | [ ] | Proper auth checks |
| API rate limits configured | [ ] | Settings > API |
| Allowed redirect URLs restricted | [ ] | Auth > URL Configuration |

**Storage Bucket Security**:
```sql
-- Public read for product images (anyone can view)
CREATE POLICY "Public read product images" ON storage.objects
FOR SELECT USING (bucket_id = 'product-images');

-- Only admin can upload/modify product images
CREATE POLICY "Admin manage product images" ON storage.objects
FOR ALL USING (
  bucket_id = 'product-images' AND
  is_admin()
);

-- Users can only access their own uploads
CREATE POLICY "Users manage own uploads" ON storage.objects
FOR ALL USING (
  bucket_id = 'user-uploads' AND
  auth.uid()::text = (storage.foldername(name))[1]
);
```

---

### 4.4 Dependency Security

| Item | Check | Notes |
|------|-------|-------|
| Run `npm audit` / `pnpm audit` | [ ] | Fix high/critical vulnerabilities |
| Dependencies up to date | [ ] | Regular updates |
| No unnecessary dependencies | [ ] | Remove unused packages |
| Lock file committed | [ ] | pnpm-lock.yaml in git |
| License compliance checked | [ ] | No GPL in commercial app |

**Vulnerability Check Commands**:
```bash
# Check for vulnerabilities
pnpm audit

# Update dependencies
pnpm update

# Check outdated packages
pnpm outdated

# Interactive update
pnpm update -i
```

---

## 5. Production Security Monitoring

### 5.1 Logging Requirements

| Event Type | Log Level | Retention |
|------------|-----------|-----------|
| Authentication success/failure | INFO | 90 days |
| Authorization failures | WARN | 90 days |
| Admin actions (CRUD) | INFO | 1 year |
| Order creation | INFO | 1 year |
| Payment events | INFO | 7 years |
| Security incidents | ERROR | 7 years |
| RLS policy violations | ERROR | 90 days |

**Audit Log Schema**:
```sql
CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp timestamptz DEFAULT now(),
  user_id uuid REFERENCES profiles(id),
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id uuid,
  old_value jsonb,
  new_value jsonb,
  ip_address inet,
  user_agent text
);

-- RLS: Only admins can read audit logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin read audit logs" ON audit_logs
FOR SELECT USING (is_admin());

-- No one can modify audit logs (append-only)
CREATE POLICY "No modifications" ON audit_logs
FOR UPDATE USING (false);
CREATE POLICY "No deletions" ON audit_logs
FOR DELETE USING (false);
```

---

### 5.2 Alerting Thresholds

| Alert | Threshold | Action |
|-------|-----------|--------|
| Failed login attempts | >10 per minute per IP | Temporary IP block |
| RLS violations | Any occurrence | Investigate immediately |
| Error rate spike | >5% of requests | Page on-call |
| Database connections | >80% capacity | Scale up |
| API response time | >2s p95 | Investigate |
| Storage usage | >80% capacity | Add storage |
| Failed orders | >5% of attempts | Investigate |

---

### 5.3 Incident Response

**Severity Levels**:

| Level | Description | Response Time | Examples |
|-------|-------------|---------------|----------|
| P1 - Critical | Data breach, complete outage | 15 minutes | User data exposed, site down |
| P2 - High | Partial outage, security risk | 1 hour | Auth broken, payment failing |
| P3 - Medium | Degraded service | 4 hours | Slow performance, minor bug |
| P4 - Low | Minor issue | 24 hours | UI glitch, typo |

**Incident Response Steps**:
1. **Detect**: Monitoring alerts or user report
2. **Contain**: Stop the bleeding (disable feature, block IP, etc.)
3. **Investigate**: Determine root cause
4. **Remediate**: Fix the issue
5. **Communicate**: Notify affected users if required
6. **Post-mortem**: Document and prevent recurrence

---

## 6. E-Commerce Specific Security

### 6.1 Payment Security (Future Phase)

| Item | Check | Notes |
|------|-------|-------|
| PCI DSS compliance | [ ] | Use compliant payment provider |
| Never store card numbers | [ ] | Only tokenized references |
| Payment provider webhook validation | [ ] | Verify signatures |
| Idempotent payment processing | [ ] | Prevent double charges |
| Payment amount validated server-side | [ ] | Never trust client price |
| Refund authorization controlled | [ ] | Admin only |

**Price Validation Pattern**:
```typescript
// WRONG - Trust client-provided price
async function createOrder(items: CartItem[], totalFromClient: number) {
  // Using client total - DANGEROUS!
  await insertOrder({ total: totalFromClient });
}

// RIGHT - Recalculate on server
async function createOrder(items: CartItem[]) {
  // Server recalculates everything
  const pricing = await computeCartPricing(items);
  await insertOrder({
    subtotal: pricing.subtotal,
    discount: pricing.discount,
    total: pricing.total  // Server-calculated
  });
}
```

---

### 6.2 Inventory Security

| Item | Check | Notes |
|------|-------|-------|
| Inventory cannot go negative | [ ] | Constraint in database |
| Inventory changes are atomic | [ ] | Transaction-safe |
| Inventory movements audited | [ ] | Full history |
| Race condition prevention | [ ] | SELECT FOR UPDATE |
| Admin-only manual adjustments | [ ] | RLS enforced |

**Inventory Transaction Safety**:
```sql
-- Atomic inventory decrement with check
CREATE OR REPLACE FUNCTION decrement_inventory(
  p_product_id uuid,
  p_quantity integer
) RETURNS boolean AS $$
DECLARE
  v_current_stock integer;
BEGIN
  -- Lock the row for update
  SELECT stock_quantity INTO v_current_stock
  FROM inventory
  WHERE product_id = p_product_id
  FOR UPDATE;

  IF v_current_stock IS NULL THEN
    RAISE EXCEPTION 'Product not in inventory';
  END IF;

  IF v_current_stock < p_quantity THEN
    RETURN false;  -- Insufficient stock
  END IF;

  UPDATE inventory
  SET stock_quantity = stock_quantity - p_quantity,
      updated_at = now()
  WHERE product_id = p_product_id;

  -- Log the movement
  INSERT INTO inventory_movements (product_id, change_quantity, reason)
  VALUES (p_product_id, -p_quantity, 'order');

  RETURN true;
END;
$$ LANGUAGE plpgsql;
```

---

### 6.3 Order Security

| Item | Check | Notes |
|------|-------|-------|
| Users can only view own orders | [ ] | RLS policy |
| Order prices immutable after creation | [ ] | Snapshot locked |
| Order status transitions validated | [ ] | State machine |
| Cancellation has time window | [ ] | Business rule |
| Admin audit trail for status changes | [ ] | Log who changed what |

---

### 6.4 User Data Privacy

| Item | Check | Notes |
|------|-------|-------|
| Privacy policy published | [ ] | Required by law |
| Terms of service published | [ ] | Required by law |
| User can export their data | [ ] | GDPR right to portability |
| User can delete their account | [ ] | GDPR right to erasure |
| Data minimization practiced | [ ] | Only collect what's needed |
| Consent for marketing | [ ] | Opt-in required |
| Third-party data sharing disclosed | [ ] | In privacy policy |

**Account Deletion Function**:
```sql
CREATE OR REPLACE FUNCTION delete_user_account(p_user_id uuid)
RETURNS void AS $$
BEGIN
  -- Verify caller is the user or admin
  IF auth.uid() != p_user_id AND NOT is_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Anonymize orders (keep for business records)
  UPDATE orders SET
    shipping_address_id = NULL
  WHERE user_id = p_user_id;

  -- Delete personal data
  DELETE FROM addresses WHERE user_id = p_user_id;
  DELETE FROM pets WHERE user_id = p_user_id;
  DELETE FROM autoships WHERE user_id = p_user_id;

  -- Anonymize profile
  UPDATE profiles SET
    full_name = 'Deleted User',
    phone = NULL,
    deleted_at = now()
  WHERE id = p_user_id;

  -- Note: Auth user deletion handled separately via Supabase Auth API
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 7. Security Testing

### 7.1 Manual Testing Checklist

| Test | Status | Notes |
|------|--------|-------|
| Login as user A, try to access user B's orders | [ ] | Should fail |
| Login as user, try to access admin pages | [ ] | Should redirect |
| Submit negative quantity in cart | [ ] | Should reject |
| Submit negative price via API | [ ] | Should use server price |
| SQL injection in search field | [ ] | Should be escaped |
| XSS in product name (admin) | [ ] | Should be sanitized |
| Access API without auth token | [ ] | Should return 401 |
| Use expired auth token | [ ] | Should return 401 |
| IDOR: Access order by guessing ID | [ ] | Should fail (RLS) |
| Rate limit: Spam login attempts | [ ] | Should be throttled |

---

### 7.2 Automated Security Testing

**Recommended Tools**:
- **OWASP ZAP**: Web app vulnerability scanner
- **npm audit**: Dependency vulnerabilities
- **Snyk**: Continuous vulnerability monitoring
- **Burp Suite**: API security testing (optional)

**CI/CD Security Integration**:
```yaml
# .github/workflows/security.yml
name: Security Checks

on: [push, pull_request]

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - run: pnpm audit --audit-level high

  secrets-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: trufflesecurity/trufflehog@main
        with:
          path: ./
          base: main
```

---

## 8. Compliance Considerations

### 8.1 Indonesia-Specific

| Requirement | Status | Notes |
|-------------|--------|-------|
| Local data storage preference | [ ] | Supabase region selection |
| Indonesian language support | [ ] | Privacy policy, terms |
| Consumer protection law compliance | [ ] | Return/refund policy |
| Electronic transaction law (UU ITE) | [ ] | Legal review |

### 8.2 General E-Commerce

| Requirement | Status | Notes |
|-------------|--------|-------|
| Clear pricing displayed | [ ] | No hidden fees |
| Refund policy published | [ ] | Required |
| Contact information visible | [ ] | Required |
| Order confirmation provided | [ ] | Email/in-app |
| Delivery terms clear | [ ] | Required |

---

## 9. Security Review Schedule

| Review Type | Frequency | Responsible |
|-------------|-----------|-------------|
| Dependency audit | Weekly | Automated CI |
| RLS policy review | Monthly | Lead developer |
| Access log review | Monthly | Admin |
| Full security audit | Quarterly | External or senior dev |
| Penetration testing | Annually | External firm |
| Incident review | After each incident | Team |

---

## 10. Quick Reference: Golden Rules

1. **NEVER** put service_role key in mobile or admin client apps
2. **NEVER** weaken RLS to fix permission issues - fix the query instead
3. **NEVER** trust client-provided prices - always compute on server
4. **NEVER** log passwords, tokens, or payment data
5. **NEVER** expose internal error details to users
6. **ALWAYS** validate input on the server, even if validated on client
7. **ALWAYS** use parameterized queries
8. **ALWAYS** use HTTPS in production
9. **ALWAYS** audit admin actions
10. **ALWAYS** test authorization as different user roles

---

## Appendix A: Security Contacts

| Role | Contact | Escalation |
|------|---------|------------|
| Security Lead | [TBD] | Immediate |
| Supabase Support | support@supabase.io | Within 24h |
| Legal/Compliance | [TBD] | Within 48h |

---

## Appendix B: Incident Report Template

```markdown
# Security Incident Report

**Date**: YYYY-MM-DD
**Severity**: P1/P2/P3/P4
**Status**: Open/Investigating/Resolved

## Summary
[Brief description of what happened]

## Timeline
- HH:MM - [Event]
- HH:MM - [Event]

## Impact
- Users affected: X
- Data exposed: [Yes/No - describe]
- Service disruption: [Duration]

## Root Cause
[What caused this to happen]

## Resolution
[How it was fixed]

## Prevention
[Steps to prevent recurrence]

## Lessons Learned
[What we learned]
```

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-10 | Claude | Initial version |

---

## End of Security Checklist
