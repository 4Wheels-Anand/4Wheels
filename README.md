# 4Wheels — Website + Separate Mobile Admin App

This project contains:
- `backend/`: Node.js + Express API, SQLite database, public customer website and browser admin dashboard.
- `admin-mobile/`: Expo React Native app for the business owner/admin. It connects to the same backend.

Business defaults: 4Wheels, Kanpur, WhatsApp `6005447802` (stored as `916005447802` for WhatsApp links).

## Part A — Start backend and website locally

Requirements: Node.js 20+ and VS Code.

1. Open `backend/` in VS Code terminal.
2. Run `npm install`.
3. Copy `.env.example` to `.env`.
4. Change `ADMIN_PASSWORD` to a unique strong password and `SESSION_SECRET` to a random secret of 32+ characters.
5. Run `npm start`.
6. Open `http://localhost:3000` for customer website.
7. Open `http://localhost:3000/admin.html` for browser admin panel.

The first run creates `4wheels.sqlite` and adds four SAMPLE vehicles. Replace sample vehicles, prices, descriptions and photos with real verified inventory using the admin panel or database tools.

## Part B — Run the separate admin mobile app

Install Expo Go on your Android phone from Google Play (for testing).

1. Open a second terminal in `admin-mobile/`.
2. Run `npm install`.
3. Copy `.env.example` to `.env`.
4. Set `EXPO_PUBLIC_API_URL`:
   - If backend is deployed: use its HTTPS URL, e.g. `https://your-domain.com`.
   - If using Android emulator: `http://10.0.2.2:3000`.
   - If using a real phone on the same Wi-Fi as laptop: use laptop LAN IP, e.g. `http://192.168.1.20:3000`. Ensure firewall allows port 3000.
5. Run `npx expo start`.
6. Scan the QR code using Expo Go.

Log in with the same `ADMIN_USERNAME` and `ADMIN_PASSWORD` configured in backend `.env`.

The mobile app currently supports:
- Overview counts
- View booking enquiries
- Change booking status
- Enter total and received payment amounts
- View partner enquiries and change partner status
- View fleet and hide/show cars
- Pull down to refresh

## Part C — Publish the website online

You need:
- A domain name (e.g. `4wheels.in`, if available)
- A Node.js hosting provider that supports persistent disk/storage
- HTTPS/SSL
- Persistent storage for `backend/4wheels.sqlite`

Deploy the `backend/` folder as a Node.js app. Set all `.env` values in the host's environment-variable settings. Set `NODE_ENV=production`, `BASE_URL` to your real domain, a strong `ADMIN_PASSWORD`, a random `SESSION_SECRET`, `WHATSAPP_NUMBER=916005447802`, and `BUSINESS_CITY=Kanpur`.

Important: SQLite file must survive restarts and deployments. Set up automated backups. Express MemoryStore is used for the browser session in this starter; replace it with a persistent session store before production. Do not use a free ephemeral filesystem for the SQLite database.

After deployment, set the exact HTTPS URL in `admin-mobile/.env` as `EXPO_PUBLIC_API_URL`. Restart Expo and test login from your phone.

## Part D — Build an installable Android app

For an APK/AAB build, use Expo EAS Build:
1. Install EAS CLI: `npm install -g eas-cli`
2. In `admin-mobile/`, run `eas login`
3. Run `eas build:configure`
4. Confirm the `EXPO_PUBLIC_API_URL` is your deployed HTTPS backend URL.
5. For an installable Android test build run `eas build -p android --profile preview` (you may need to add a preview profile to `eas.json`).
6. For Play Store use an Android production AAB build and follow current Play Console requirements.

Expo/EAS commands and platform requirements can change; follow current Expo documentation.

## Security and legal checklist before real customers

This is an MVP starter, not a security-audited production booking platform.
- Change default admin credentials before any deployment.
- Use HTTPS only in production.
- Add persistent session storage, CSRF protection for browser admin, audit logs, stronger role-based access, and admin token revocation/expiry management.
- Protect customer personal data, publish a privacy policy, define retention/deletion procedures and restrict who can access records.
- Add a real payment gateway only after merchant onboarding and server-side payment verification; do not store card/UPI credentials.
- Booking requests are not confirmed automatically. Staff must verify vehicle availability, final price, driver, documents and terms.
- WhatsApp integration opens a prefilled chat; customer must press Send. It is not automatic outbound WhatsApp messaging.
- Google ranking is not guaranteed. After publishing, verify the domain in Google Search Console, add sitemap/robots.txt and business profile, and create accurate local SEO pages.
- Confirm local RTO, registration, permit, insurance, tax, driver and self-drive eligibility requirements with the relevant authorities/professional before operating. For attached cars, sign a written agreement covering fixed monthly payment, dates, vehicle use/custody, insurance, maintenance, accident/damage responsibility, permits, taxes, termination and dispute handling.

## API endpoints

Public:
- `GET /api/health`
- `GET /api/config`
- `GET /api/cars`
- `POST /api/bookings`
- `POST /api/partners`

Admin:
- `POST /api/admin/login` (browser session)
- `POST /api/admin/mobile-login` (Bearer token for mobile app)
- `POST /api/admin/mobile-logout`
- `GET /api/admin/data`
- `PATCH /api/admin/bookings/:id`
- `PATCH /api/admin/bookings/:id/payment`
- `PATCH /api/admin/partners/:id`
- `POST /api/admin/cars`
- `PATCH /api/admin/cars/:id`

The starter does not yet include automated availability locking, online payments, automated WhatsApp API, customer accounts, partner login portal, downloadable agreements, or an advanced calendar. Those should be added and tested before treating the platform as a full commercial marketplace.
