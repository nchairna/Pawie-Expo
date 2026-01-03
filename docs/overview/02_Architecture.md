# Doc 02 — Architecture Overview

Product: Pawie  
Version: v1.0  
Last Updated: 2026-01-03  
Status: Source of Truth

---

## 1. Architecture Goals

The architecture must satisfy the following goals:

- Production-ready by default
- Secure with strict access control
- Fast product browsing and search
- Extensible for autoship and personalization
- Clear separation between customer, admin, and backend systems

---

## 2. System Components

The system consists of four major components:

- Mobile application (customer-facing)
- Admin web application (internal operations)
- Supabase backend (database, auth, storage)
- Server-side jobs (autoship execution)

---

## 3. Applications

### 3.1 Mobile Application

Platform:
- Expo (React Native)

Responsibilities:
- User authentication using email and password
- Product browsing and search
- One-time purchases
- Autoship creation and management
- Pet profile management
- Viewing orders and upcoming deliveries

Restrictions:
- No access to service-role credentials
- All data access constrained by Row Level Security
- Can only read and write user-owned data

---

### 3.2 Admin Web Application

Platform:
- Next.js

Responsibilities:
- Product and variant management
- Inventory management
- Order management
- Customer and pet visibility
- Autoship monitoring and controls

Security:
- Authenticated via Supabase Auth
- Admin privileges enforced at database level
- Elevated operations may use server-side functions

---

## 4. Backend (Supabase)

Supabase provides the following services:

- Authentication using email and password
- Postgres database as the single source of truth
- Row Level Security on all application tables
- Storage for product images
- Server-side execution via Edge Functions

Supabase is responsible for enforcing all access control rules.

---

## 5. Source of Truth

Supabase Postgres is the source of truth for:

- Users and profiles
- Pets and pet attributes
- Products and product variants
- Inventory and inventory movements
- Orders and order items
- Autoships and autoship execution records
- Recommendation metadata

The admin application is the source of truth for operational decisions.

---

## 6. Security Model

### 6.1 Authentication

- Email and password authentication via Supabase
- Sessions handled by Supabase SDKs

---

### 6.2 Authorization

- Row Level Security enabled on all tables
- Users can only access their own records
- Admin access gated by a role field on the profile table
- No implicit trust between clients

---

### 6.3 Service Role Usage

- Service role key is never exposed to client applications
- Used only in server-side environments
- Required for autoship execution and privileged operations

---

### 6.4 Storage Security

- Product images stored in Supabase Storage
- Read access allowed for published products
- Write access restricted to admin users

---

## 7. Core Data Flows

### 7.1 Product Browsing and Search

- Mobile app requests published products
- Database returns indexed search results
- Only published products are visible to customers

---

### 7.2 Order Creation

- Customer submits an order
- Order and order items are created
- Inventory is validated before confirmation
- Order status starts as pending

Rules:
- Inventory must never go negative
- Orders are immutable after creation

---

### 7.3 Autoship Management

- Customers create autoships linked to products
- Autoship schedule is stored in the database
- Customers can pause, skip, or cancel autoships

---

### 7.4 Autoship Execution

- Server-side job scans for due autoships
- Inventory availability is checked
- Orders are created automatically
- Inventory is decremented
- Autoship execution is logged
- Next run date is updated

Autoship execution must be idempotent and retry-safe.

---

### 7.5 Admin Operations

- Admin updates product catalog
- Admin adjusts inventory
- Admin updates order status
- Changes are immediately reflected in customer apps

---

## 8. Search Architecture

### 8.1 MVP Search

- Postgres-based search
- Indexed product name and category fields
- Server-side filtering

---

### 8.2 Future Search

- External search engine integration
- Event-driven indexing
- Personalization-aware ranking

---

## 9. Personalization Architecture

### 9.1 MVP Personalization

Inputs:
- Pet species
- Pet age
- Pet weight
- Activity level
- Order history

Logic:
- Rule-based logic executed server-side
- Transparent and explainable outputs

Outputs:
- Recommended products
- Reorder suggestions

---

## 10. Environment Strategy

Environments:
- Local development
- Staging
- Production

Rules:
- Schema changes via migrations only
- No manual database edits in production
- Environment-specific secrets

---

## 11. Observability and Reliability

Production requirements:
- Inventory movement logs
- Autoship execution logs
- Order status history
- Error tracking for all applications

---

## 12. Deployment Overview

- Mobile app built and submitted via Expo EAS
- Admin web deployed via Vercel
- Supabase used as managed backend

---

## 13. Architecture Principles

- Single seller model
- Postgres-first approach
- Server-side autoship execution
- Strict security boundaries
- No shortcuts around RLS

---

## Next Document

Doc 03 — Data Model and Row Level Security Plan
