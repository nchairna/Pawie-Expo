# Best Practices for AI-Assisted Development

**Version**: 1.0
**Last Updated**: 2026-01-07
**For**: Claude Code, Cursor, GitHub Copilot

---

## Overview

This guide provides best practices for developing Pawie using AI coding assistants like Claude Code and Cursor. Following these practices ensures high code quality, maintainability, and successful collaboration between human developers and AI.

---

## Table of Contents

1. [General Principles](#general-principles)
2. [Effective Prompting](#effective-prompting)
3. [Code Review with AI](#code-review-with-ai)
4. [Database Migrations](#database-migrations)
5. [Testing with AI](#testing-with-ai)
6. [Documentation](#documentation)
7. [Common Pitfalls](#common-pitfalls)
8. [Advanced Techniques](#advanced-techniques)

---

## General Principles

### 1. Context is King

**Provide Rich Context**:
```
❌ BAD: "Add a button to the product page"

✅ GOOD: "Add a 'Add to Autoship' button to the product detail page (apps/mobile/app/(tabs)/shop/[id].tsx). The button should:
- Be styled like the existing 'Add to Cart' button
- Show autoship savings (10% off)
- Navigate to autoship enrollment flow
- Only show if product.autoship_eligible is true"
```

**Reference Existing Code**:
```
✅ "Implement the autoship enrollment API following the same pattern as /api/products in apps/admin/app/api/products/route.ts"
```

### 2. Start with Planning

**For Complex Tasks**:
1. Ask AI to create a plan first
2. Review the plan
3. Approve or adjust
4. Then implement

**Example**:
```
"I want to implement the discount system. First, create a detailed implementation plan covering:
1. Database schema changes needed
2. API endpoints to create
3. Admin UI updates
4. Mobile UI updates
5. Testing strategy

Don't implement yet, just plan."
```

### 3. Incremental Development

**Break Large Tasks into Steps**:
```
❌ BAD: "Implement the entire autoship feature"

✅ GOOD:
1. "First, let's update the database schema for autoship"
2. "Now create the autoship enrollment API"
3. "Add the autoship management screen"
4. "Implement the scheduler"
```

### 4. Verify AI Output

**Always Review Generated Code**:
- Run type checks: `pnpm type-check`
- Test locally
- Check RLS policies
- Verify no secrets committed
- Ensure follows project patterns

### 5. Documentation First

**For New Features**:
1. Write/update documentation
2. Review with team
3. Implement based on docs
4. Keep docs in sync

**Docs are source of truth** - code must match docs!

---

## Effective Prompting

### Anatomy of a Good Prompt

**1. Context**
```
"I'm working on the Pawie e-commerce platform. We use Supabase for backend, Next.js for admin, and Expo for mobile."
```

**2. Current State**
```
"The product catalog is complete with families and variants. We're now implementing the discount system."
```

**3. Goal**
```
"I need to create an API endpoint that computes the final price for a product with all applicable discounts."
```

**4. Constraints**
```
"Requirements:
- Use Supabase Edge Function (Deno)
- Apply discount stacking policy
- Handle autoship discounts
- Return price breakdown
- Follow existing API patterns in supabase/functions/"
```

**5. References**
```
"See docs/guides/Discount_System.md for discount rules."
```

### Task-Specific Prompts

#### Database Migration

```
"Create a migration file to add autoship enhancement fields:
- File: supabase/migrations/0013_enhance_autoship.sql
- Add columns: enrolled_price_idr, skip_next_delivery, paused_at
- Add indexes for scheduler query
- Follow migration pattern from 0012_add_price_sku_to_products.sql
- Include rollback comments"
```

#### API Endpoint

```
"Create a Supabase Edge Function for autoship enrollment:
- Path: supabase/functions/autoship-enroll/index.ts
- Method: POST
- Input: { product_id, quantity, frequency_weeks }
- Validation: Check product.autoship_eligible
- Compute autoship price (apply 10% discount)
- Create autoship record
- Return autoship details
- Follow pattern from supabase/functions/*/index.ts examples"
```

#### React Component

```
"Create an AutoshipEnrollmentModal component:
- Location: apps/mobile/components/AutoshipEnrollmentModal.tsx
- Props: { product, visible, onClose, onSuccess }
- UI: Show product, frequency selector, price comparison
- Validation: Require auth, validate frequency
- API call: POST /api/autoship/enroll
- Toast on success/error
- Follow shadcn/ui patterns from other modals"
```

#### Testing

```
"Write unit tests for the compute_product_price SQL function:
- Test percentage discounts
- Test BOGO discounts
- Test stacking policies
- Test edge cases (negative price, no discounts)
- Use Vitest
- Mock Supabase client
- Follow test patterns from existing tests"
```

### Prompt Templates

**Bug Fix**:
```
"There's a bug in [file path] at [line number]:
- Error: [error message]
- Expected: [expected behavior]
- Actual: [actual behavior]
- Steps to reproduce: [steps]
- Related code: [paste code snippet]

Please diagnose and fix, explaining what was wrong."
```

**Refactor**:
```
"The code in [file path] is [problem: repetitive/hard to read/not type-safe].
Please refactor it to:
- [improvement 1]
- [improvement 2]
- Maintain existing functionality
- Add tests to verify no regression"
```

**Feature Addition**:
```
"Add a new feature to [component/function]:
- What: [feature description]
- Why: [business reason]
- Where: [file path]
- How: [implementation approach]
- Tests: [what to test]
- Docs: [what to document]"
```

---

## Code Review with AI

### Using AI as a Reviewer

**Before Committing**:
```
"Review this code for:
1. TypeScript errors
2. Security issues (SQL injection, XSS, etc.)
3. Performance problems
4. Missing error handling
5. Inconsistent patterns with the rest of the codebase

[Paste code]"
```

**PR Description Generation**:
```
"Generate a PR description for these changes:
- Files changed: [list files]
- Purpose: [what was changed and why]
- Testing: [how it was tested]

Use our PR template format."
```

### AI-Assisted Code Review Checklist

Ask AI to check:
- [ ] No `any` types (use proper TypeScript)
- [ ] Error handling present
- [ ] No hardcoded values (use constants/env vars)
- [ ] Follows project naming conventions
- [ ] No console.log in production code
- [ ] RLS policies not weakened
- [ ] No secrets committed
- [ ] Tests added/updated
- [ ] Documentation updated

---

## Database Migrations

### Migration Best Practices with AI

**1. Generate Migration Template**:
```
"Create a new migration file:
- Purpose: Add discount stacking support
- Tables affected: discounts
- Changes: Add stack_policy column, update constraint
- Generate file name following the pattern: NNNN_description.sql"
```

**2. Review Before Applying**:
```
"Review this migration for:
- Breaking changes
- Data loss risks
- Missing rollback comments
- Index impacts
- RLS policy updates needed

[Paste migration SQL]"
```

**3. Test Migrations**:
```
"Create a test script to verify this migration:
- Insert sample data before migration
- Apply migration
- Verify data integrity
- Test queries that use new fields
- Check RLS still works"
```

**4. Generate Rollback Plan**:
```
"Generate a rollback migration for 0013_enhance_autoship.sql:
- Reverse all changes
- Preserve data where possible
- Include warnings about data loss"
```

### Migration Anti-Patterns to Avoid

❌ **Don't**:
```sql
-- Editing existing migration files
-- This breaks reproducibility

ALTER TABLE products ADD COLUMN new_field text; -- in 0001_schema.sql
```

✅ **Do**:
```sql
-- Create new migration file
-- 0014_add_new_field.sql

ALTER TABLE products ADD COLUMN new_field text;
```

❌ **Don't**:
```sql
-- Dropping columns without data migration
ALTER TABLE products DROP COLUMN important_data;
```

✅ **Do**:
```sql
-- Migrate data first, then deprecate
UPDATE products SET new_field = important_data;
-- In next migration (after verifying):
-- ALTER TABLE products DROP COLUMN important_data;
```

---

## Testing with AI

### Test Generation

**Unit Tests**:
```
"Generate unit tests for the function `computeAutoshipPrice` in apps/admin/lib/pricing.ts:
- Test with valid input
- Test with invalid product_id
- Test with 0 quantity
- Test discount application
- Test edge cases (null discount, expired discount)
- Use Vitest
- Mock Supabase calls"
```

**Integration Tests**:
```
"Create an integration test for the autoship enrollment flow:
- Create test user
- Create test product (autoship_eligible = true)
- Call POST /api/autoship/enroll
- Verify autoship record created
- Verify order created
- Cleanup test data
- Use Vitest + Supabase test client"
```

**E2E Tests**:
```
"Write a Playwright test for the product browsing flow:
- Navigate to shop tab
- Search for 'dog food'
- Click first product
- Verify product details shown
- Click 'Add to Cart'
- Verify cart updated
- Screenshot at each step"
```

### Test-Driven Development with AI

**1. Write Test First**:
```
"I'm implementing autoship skip functionality. Write the test first:
- Test: User can skip next delivery
- Setup: Create active autoship
- Action: Call skipNextDelivery(autoshipId)
- Assert: skip_next_delivery = true, next_run_at unchanged
- Use Vitest"
```

**2. Implement to Pass Test**:
```
"Here's the test [paste test]. Now implement the skipNextDelivery function to make it pass."
```

**3. Refactor**:
```
"The test passes but the code is messy. Refactor skipNextDelivery while keeping tests green."
```

---

## Documentation

### Auto-Generated Documentation

**Function Documentation**:
```
"Add JSDoc comments to this function:
- Describe what it does
- Document parameters
- Document return value
- Include example usage
- Note any side effects

[Paste function]"
```

**API Documentation**:
```
"Generate OpenAPI/Swagger spec for the autoship endpoints:
- POST /api/autoship/enroll
- GET /api/autoship/list
- PATCH /api/autoship/:id/skip
- Include request/response schemas
- Include error codes
- Include examples"
```

**README Updates**:
```
"Update the README.md to include:
- New autoship feature
- How to enroll
- How to manage autoships
- API endpoints available
- Screenshots (placeholder paths)
- Follow existing README style"
```

### Documentation Review

**Ask AI to Review Docs**:
```
"Review this documentation for:
- Clarity (can a new developer understand it?)
- Completeness (are all steps included?)
- Accuracy (does it match the code?)
- Examples (are they correct and helpful?)
- Typos and grammar

[Paste documentation]"
```

---

## Common Pitfalls

### 1. Over-Reliance on AI

❌ **Don't**: Blindly accept all AI suggestions

✅ **Do**: Review, test, and verify all generated code

**Example**:
```
AI generates SQL query with performance issue:
SELECT * FROM products WHERE name LIKE '%dog%'

You catch it:
- Missing index on name
- Should use full-text search
- '%dog%' prevents index usage
```

### 2. Insufficient Context

❌ **Don't**: "Add a discount field"

✅ **Do**: "Add a discount_value numeric field to the discounts table. It should store percentage (e.g., 10 for 10%) or fixed amount in IDR depending on discount_type. Add CHECK constraint: discount_value > 0. Update migration 0014_enhance_discounts.sql."

### 3. Ignoring Project Patterns

❌ **Don't**: Let AI create completely different code style

✅ **Do**: "Follow the existing pattern in apps/admin/lib/products.ts for the new autoship.ts file"

### 4. Security Oversights

**Always Ask AI to Check Security**:
```
"Review this code for security issues:
- SQL injection
- XSS
- CSRF
- Authentication bypass
- RLS policy violations
- Secret exposure

[Paste code]"
```

### 5. Missing Error Handling

❌ **AI Often Generates**:
```typescript
const { data } = await supabase.from('products').select('*')
return data // What if data is null?
```

✅ **You Should Add**:
```typescript
const { data, error } = await supabase.from('products').select('*')
if (error) throw new Error(`Failed to fetch products: ${error.message}`)
if (!data) throw new Error('No products found')
return data
```

**Prompt**:
```
"Add comprehensive error handling to this function. Handle:
- Network errors
- Database errors
- Not found cases
- Permission errors
- Invalid input
- Provide user-friendly error messages"
```

---

## Advanced Techniques

### 1. Multi-Step Planning

**For Complex Features**:

```
Step 1: "Create a detailed plan for implementing tiered pricing discounts"
[AI generates plan]

Step 2: "Review this plan for gaps or issues"
[AI reviews, you adjust]

Step 3: "Implement Step 1 of the plan: Database schema changes"
[AI implements]

Step 4: "Implement Step 2: SQL pricing functions"
[Continue step by step]
```

### 2. Iterative Refinement

```
Iteration 1: "Create a basic product search function"
[AI generates basic version]

Iteration 2: "Add filters for category and price range"
[AI enhances]

Iteration 3: "Add full-text search with ranking"
[AI improves further]

Iteration 4: "Optimize query performance with indexes"
[AI optimizes]
```

### 3. Comparative Analysis

```
"Compare these two approaches for inventory management:

Approach A: Immediate decrement on order creation
Approach B: Reserve on cart, decrement on payment

Analyze:
- Performance implications
- Data consistency guarantees
- User experience impact
- Implementation complexity
- Scaling considerations

Recommend which to use for Pawie."
```

### 4. Code Archaeology

```
"Explain what this legacy code does and why it was written this way:
[Paste complex code]

Then suggest:
- Modern equivalent
- Improvements possible
- Breaking changes needed
- Migration strategy"
```

### 5. Pattern Extraction

```
"I've written similar CRUD operations in products.ts, families.ts, and tags.ts.
Extract a reusable pattern:
- Identify commonalities
- Create generic helper function
- Show how to refactor each file to use it
- Maintain type safety"
```

### 6. Performance Optimization

```
"This query is slow in production:
[Paste query + EXPLAIN ANALYZE output]

Optimize it by:
- Adding indexes
- Rewriting query
- Breaking into smaller queries
- Caching strategy
- Show before/after performance comparison"
```

---

## AI-Specific Workflows

### With Claude Code

**1. Project Context**:
- Claude Code reads CLAUDE.md automatically
- Keep it updated with latest architecture decisions
- Reference specific docs: "See docs/guides/Autoship_Implementation.md"

**2. Multi-File Changes**:
```
"Update the autoship schema:
1. Migration: supabase/migrations/0013_enhance_autoship.sql
2. Types: apps/admin/lib/types.ts
3. Data layer: apps/admin/lib/autoship.ts
4. RLS policies: Update policies in migration

Make these changes consistently across all files."
```

**3. Exploration Mode**:
```
"Explore the codebase:
- How are products currently fetched?
- Where is pricing computed?
- What's the pattern for RLS policies?
- Summarize the findings"
```

### With Cursor

**1. Inline Generation**:
- Use `Cmd+K` to generate code inline
- Provide context in comment above cursor:
```typescript
// Create a function to skip next autoship delivery
// Should update skip_next_delivery = true
// Log the action
// Return updated autoship
```

**2. Chat Mode**:
- Use `Cmd+L` to chat with full file context
- Ask questions about current file
- Request refactoring
- Generate tests

**3. Terminal Commands**:
```
@terminal "Create a migration for adding skip_next_delivery to autoships table"
```

### With GitHub Copilot

**1. Autocomplete**:
- Write descriptive function names
- Add comments describing logic
- Let Copilot suggest implementation

**2. Test Generation**:
```typescript
// Test: computeAutoshipPrice with valid product
// Test: computeAutoshipPrice with invalid product
// Test: computeAutoshipPrice with expired discount
// [Copilot generates test suite]
```

---

## Measuring AI Effectiveness

### Track These Metrics

**Productivity**:
- Lines of code generated vs manually written
- Time saved on boilerplate
- Features completed per week

**Quality**:
- Bugs introduced by AI-generated code
- Test coverage of AI-generated code
- Code review findings

**Learning**:
- New patterns learned from AI suggestions
- Documentation quality improvements
- Architectural insights gained

### Continuous Improvement

**Weekly Review**:
1. What worked well with AI this week?
2. What didn't work?
3. How can prompts be improved?
4. What context was missing?
5. Update this guide with learnings

---

## Conclusion

AI coding assistants are powerful tools, but they work best when:
1. Given rich, specific context
2. Used iteratively (plan → implement → review)
3. Their output is thoroughly reviewed
4. They follow established project patterns
5. Security and quality are manually verified

**Remember**: AI is a collaborator, not a replacement for human judgment.

---

**Document Status**: ✅ Complete
**Maintained By**: Pawie Development Team
**Next Review**: Monthly
**Feedback**: Open GitHub issue with `docs` + `ai-development` labels
