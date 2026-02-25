# QuickConnect

A local services marketplace for Botswana that connects customers with trusted service providers. Customers post what they need, receive quotes from verified providers, and book the best fit — all in one place.

## Features

- **"Looking For" Posts** — Customers describe what they need, set a budget, and receive competitive quotes from providers in their area
- **Provider Search & Profiles** — Browse and filter verified service providers across 20+ categories with ratings, reviews, and service areas
- **Booking Management** — Book services, track status (pending → confirmed → in progress → completed), and manage appointments
- **Real-time Chat** — Direct messaging between customers and providers tied to bookings or posts
- **Reviews & Ratings** — Rate and review providers after completed bookings, with auto-calculated average ratings
- **Payments** — Support for Orange Money, BTC MyZaka, and Mascom MyZaka
- **Admin Dashboard** — User management, reports, and platform oversight
- **Location-aware** — PostGIS-powered geospatial queries for finding nearby providers and services
- **Notifications** — In-app notification system for booking updates, new quotes, and messages

## Service Categories

Plumbing · Electrical · Cleaning · Painting · Carpentry · Gardening & Landscaping · Moving & Transport · Tutoring & Education · Photography · Catering · Beauty & Salon · Auto Repair & Mechanic · IT & Computer Repair · Construction · Welding · Tiling · Air Conditioning & HVAC · Security Services · Event Planning · Tailoring & Fashion

## Tech Stack

| Layer        | Technology                          |
| ------------ | ----------------------------------- |
| Framework    | React 19 + TypeScript               |
| Build Tool   | Vite 7                              |
| Styling      | Tailwind CSS 4                      |
| Routing      | React Router 7                      |
| Backend      | Supabase (Auth, Database, Realtime) |
| Database     | PostgreSQL + PostGIS                |
| Icons        | Lucide React                        |
| Dates        | date-fns                            |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- A [Supabase](https://supabase.com/) project

### Setup

1. **Clone the repository**

   ```bash
   git clone https://github.com/your-username/QuickConnect.git
   cd QuickConnect/quickconnect-web
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure environment variables**

   Copy the example env file and fill in your Supabase credentials:

   ```bash
   cp .env.example .env
   ```

   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   VITE_GOOGLE_MAPS_API_KEY=your-google-maps-key
   VITE_APP_NAME=QuickConnect
   VITE_APP_URL=http://localhost:5173
   ```

4. **Set up the database**

   Run the schema migration in your Supabase SQL editor:

   ```bash
   supabase/schema.sql
   ```

   This creates all tables, indexes, RLS policies, triggers, and seeds the service categories.

5. **Start the dev server**

   ```bash
   npm run dev
   ```

   The app will be available at [http://localhost:5173](http://localhost:5173).

## Scripts

| Command           | Description                |
| ----------------- | -------------------------- |
| `npm run dev`     | Start development server   |
| `npm run build`   | Type-check and build       |
| `npm run preview` | Preview production build   |
| `npm run lint`    | Run ESLint                 |

## Project Structure

```
quickconnect-web/
├── src/
│   ├── components/
│   │   ├── layout/          # Header, Footer, Layout shell
│   │   └── ui/              # Reusable UI components (Button, Card, Modal, etc.)
│   ├── context/             # Auth and Notification providers
│   ├── lib/                 # Supabase client, types, constants, utilities
│   ├── pages/
│   │   ├── admin/           # Admin dashboard, user management, reports
│   │   ├── Home.tsx         # Landing page
│   │   ├── Login.tsx        # Authentication
│   │   ├── Register.tsx     # User registration
│   │   ├── LookingFor.tsx   # Browse "Looking For" posts
│   │   ├── CreatePost.tsx   # Create a new service request
│   │   ├── PostDetail.tsx   # View post details and provider quotes
│   │   ├── ProviderSearch.tsx  # Search and filter providers
│   │   ├── ProviderProfile.tsx # Provider profile with services and reviews
│   │   ├── MyBookings.tsx   # User's bookings
│   │   ├── Chat.tsx         # Messaging
│   │   ├── Profile.tsx      # User profile management
│   │   └── Dashboard.tsx    # Provider dashboard
│   ├── App.tsx              # Router and app shell
│   └── main.tsx             # Entry point
├── supabase/
│   └── schema.sql           # Full database schema with RLS policies
└── package.json
```

## Database

The database uses PostgreSQL with PostGIS for geospatial features and Supabase Auth for user management. Row Level Security (RLS) is enabled on all tables to ensure data access is properly scoped to the authenticated user.

Key tables: `profiles`, `service_providers`, `services`, `service_categories`, `service_areas`, `looking_for_posts`, `looking_for_responses`, `bookings`, `conversations`, `messages`, `payments`, `reviews`, `notifications`.

## License

This project is proprietary. All rights reserved.
