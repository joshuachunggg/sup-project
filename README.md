# Sup - Dinner Table Booking App

A web application for booking dinner tables and meeting new people. Built with vanilla JavaScript, HTML/CSS, and Supabase backend.

## Features

- **Phone-only authentication** - No passwords required, just enter your phone number
- **Local browser storage** - User sessions stored in browser cookies
- **Table booking system** - Join tables or join waitlists
- **Age range filtering** - Tables organized by age groups
- **Neighborhood-based** - Tables organized by location
- **Theme support** - Special themed dinners (Tech Talk, Foodies, Book Club, etc.)

## Tech Stack

- **Frontend**: Vanilla JavaScript, HTML5, CSS3, Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Edge Functions)
- **Authentication**: Phone number verification
- **Database**: PostgreSQL with Row Level Security (RLS)

## Project Structure

```
supdinner/
├── frontend/           # Frontend application
│   ├── index.html     # Main HTML file
│   ├── script.js      # JavaScript application logic
│   └── styles.css     # Custom CSS styles
├── backend/           # Backend configuration and functions
│   ├── dump.sql      # Database schema and functions
│   └── supabase/     # Supabase Edge Functions
└── README.md         # This file
```

## Getting Started

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd supdinner
   ```

2. **Set up Supabase**
   - Create a new Supabase project
   - Run the SQL commands from `backend/dump.sql` in your Supabase SQL editor
   - Deploy the Edge Functions from `backend/supabase/functions/`

3. **Configure the frontend**
   - Update `frontend/script.js` with your Supabase URL and anon key
   - Replace the placeholder values in the SUPABASE_URL and SUPABASE_ANON_KEY constants

4. **Deploy**
   - Deploy the frontend to GitHub Pages or your preferred hosting service
   - Ensure your Supabase Edge Functions are deployed and accessible

## Database Schema

The app uses several key tables:
- `users` - User profiles and phone numbers
- `tables` - Available dinner tables with capacity and details
- `signups` - User table bookings
- `waitlists` - Waitlist entries for full tables
- `collateral_holds` - Payment holds for table reservations

## Edge Functions

The backend includes several Supabase Edge Functions:
- User authentication and profile management
- Table booking and waitlist management
- Notification systems
- Payment processing with Stripe

## Development

To run locally:
1. Set up a local Supabase instance or use the hosted version
2. Serve the frontend files with a local server
3. Update the Supabase configuration to point to your instance

## Deployment

The app is designed to be deployed to GitHub Pages or similar static hosting services. The backend runs entirely on Supabase, so no additional server setup is required.

## License

[Add your license information here]
