# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev      # dev server on localhost:3000
npm run build    # production build
npm run lint     # eslint
```

## Architecture

**Purpose:** E-commerce storefront for an electronics shop in Libya ("ترند للإلكترونيات") — product browsing, cart, checkout, and order tracking for users; product/order management for admins.

**Stack:** Next.js 16 · TypeScript · Tailwind CSS v4 · Supabase · `@supabase/ssr`

**Design language:** Dark theme `bg-[#0b0f1a]`, purple/blue gradients, RTL Arabic (`dir="rtl"`), `rounded-2xl` cards, `border-purple-500/20` borders. All pages share this visual language.

---

## Critical Next.js 16 Rule — Always await params

`params` in route handlers is a `Promise` in Next.js 15+. Accessing `params.id` without awaiting returns `undefined`, silently breaking queries:

```typescript
type Params = Promise<{ id: string }>;
export async function GET(_req: NextRequest, { params }: { params: Params }) {
  const { id } = await params; // required
}
```

---

## Supabase Setup

Two clients — never mix them:

| Client | File | Key | Use |
|--------|------|-----|-----|
| Browser | `src/lib/supabaseClient.ts` | `ANON_KEY` | Read-only queries in components |
| Admin | instantiated in each API route | `SERVICE_ROLE_KEY` | All DB writes, bypasses RLS |

**Middleware** (`src/middleware.ts`) — guards `/admin/*` routes. Checks JWT via `createServerClient`. Admin access is email-allowlisted (`mo3iemohamed@gmail.com`).

---

## Database Schema

| Table | Key columns |
|-------|-------------|
| `products` | id, name, description, price, **quantity** *(DB column — app uses `stock`)*, category, image_url, images[], created_at |
| `store_orders` | id, user_id, items[], total, address, phone, note, status, created_at |
| `orders` | id, user_id, name, phone, price, cart_link, status, created_at *(Shein orders)* |
| `profiles` | id, full_name, phone, email, address |

**stock/quantity mapping:** The DB column is `quantity` but the app uses `stock` everywhere. API routes map on read (`stock: data.stock ?? data.quantity`) and write (`quantity: stock`). Never send `stock` directly to the DB.

---

## API Routes

All use `SERVICE_ROLE_KEY`. All dynamic routes must `await params`.

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/products` | GET, POST | List products (`?category=` `?search=`) / create |
| `/api/products/[id]` | GET, PATCH, DELETE | Fetch / update / delete product |
| `/api/upload` | POST | Upload image to Supabase Storage bucket `products` → returns `{ url }` |
| `/api/orders` | GET, POST | User's store orders (JWT verified via cookies) / place order |

---

## Key Hooks

- **`useAuth`** (`src/hooks/useAuth.ts`) — wraps Supabase auth, exposes `{ user, loading, signOut }`
- **`useCart`** (`src/hooks/useCart.ts`) — localStorage-backed cart, exposes `{ items, addItem, removeItem, updateQuantity, clearCart, total, count }`

---

## Page Map

**Frontend (users)**
- `/` — homepage: sidebar nav, hero slider, category cards, latest products section
- `/products` — listing with search, category filter, sort
- `/products/[id]` — product detail with image gallery, add-to-cart, WhatsApp CTA
- `/cart` — cart with quantity controls, order summary, checkout
- `/orders` — order history with status timeline
- `/account` — profile edit, order tabs, favorites
- `/login`, `/register`

**Admin** (protected by middleware, layout in `src/app/admin/layout.tsx`)
- `/admin/products` — CRUD list
- `/admin/products/new` — create with image upload
- `/admin/products/[id]` — view
- `/admin/products/[id]/edit` — edit
- `/admin/orders` — manage orders with status updates

---

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```
