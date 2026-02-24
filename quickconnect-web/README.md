# QuickConnect — Web Application

> Location-Based Service Marketplace for Botswana

QuickConnect connects local service providers (plumbers, electricians, tutors, cleaners, etc.) with customers across Botswana. Its core innovation is the **"Looking For" feature** — customers post what they need and providers respond with competitive quotes.

## Tech Stack

- **Frontend**: React 19 + TypeScript + Tailwind CSS v4
- **Build Tool**: Vite 7
- **Backend**: Supabase (PostgreSQL, Auth, Realtime, Storage, Edge Functions)
- **Routing**: React Router v7
- **Icons**: Lucide React
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+
- A Supabase project ([supabase.com](https://supabase.com))

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/quickconnect-web.git
   cd quickconnect-web
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   ```
   Fill in your Supabase project URL and anon key.

4. Set up the database:
   - Go to your Supabase project's SQL Editor
   - Run the contents of `supabase/schema.sql`
   - This creates all tables, RLS policies, indexes, triggers, and seed data

5. Enable PostGIS:
   - In Supabase Dashboard → Database → Extensions
   - Search for "postgis" and enable it

6. Start the dev server:
   ```bash
   npm run dev
   ```

7. Open [http://localhost:5173](http://localhost:5173)

## Project Structure

```
src/
├── components/
│   ├── ui/           # Reusable UI (Button, Card, Modal, Input, etc.)
│   └── layout/       # Header, Footer, Layout
├── pages/
│   ├── Home.tsx          # Landing page
│   ├── Login.tsx         # Sign in
│   ├── Register.tsx      # Sign up (customer or provider)
│   ├── Dashboard.tsx     # Role-based dashboard
│   ├── LookingFor.tsx    # Browse "Looking For" posts
│   ├── CreatePost.tsx    # Create a new post
│   ├── PostDetail.tsx    # View post + quotes
│   ├── ProviderSearch.tsx # Browse providers
│   ├── ProviderProfile.tsx # Provider detail page
│   ├── MyBookings.tsx    # Manage bookings
│   ├── Chat.tsx          # Real-time messaging
│   ├── Profile.tsx       # Edit profile + services
│   └── admin/            # Admin dashboard, users, reports
├── context/
│   ├── AuthContext.tsx        # Authentication state
│   └── NotificationContext.tsx # Real-time notifications
├── lib/
│   ├── supabase.ts       # Supabase client
│   ├── database.types.ts # TypeScript types for DB
│   ├── types.ts          # App-level type aliases
│   ├── utils.ts          # Utility functions
│   └── constants.ts      # Routes and app constants
└── App.tsx               # Router configuration
```

## Features

- **"Looking For" Posts**: Customers post needs, providers respond with quotes
- **Provider Discovery**: Browse, search, and filter providers by category/city/rating
- **Real-Time Chat**: Instant messaging powered by Supabase Realtime
- **Booking Management**: Full lifecycle (pending → confirmed → in progress → completed)
- **Payments**: Mobile money recording (Orange Money, BTC MyZaka, Mascom MyZaka)
- **Ratings & Reviews**: 1–5 star reviews for completed bookings
- **Admin Panel**: User management, reports, and analytics
- **Responsive Design**: Mobile-first, works on all screen sizes

## Scripts

| Command | Description |
|---------|------------|
| `npm run dev` | Start development server |
| `npm run build` | TypeScript check + production build |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint |

## Database

The full database schema is in `supabase/schema.sql`. It includes:

- 13 tables with UUID primary keys
- PostGIS geography columns for location data
- Row Level Security (RLS) on all tables
- Auto-updating `updated_at` triggers
- Provider rating calculation trigger
- Seed data for 20 service categories

## Deployment

### Vercel

1. Push to GitHub
2. Import project on [vercel.com](https://vercel.com)
3. Add environment variables (from `.env.example`)
4. Deploy

## Author

**Webster Maunge** (202103578)
University of Botswana — BSc Computer Science
