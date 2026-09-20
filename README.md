# EasyCart — Restaurant Pre-Order & Quick Pickup Platform

> **Order before you arrive. Pick up without waiting.**

Traditional takeaway: Arrive → Order → Wait → Pickup  
**EasyCart:** Order remotely → Pay → Restaurant prepares → READY notification → Arrive → Instant Pickup

No delivery. No waiting.

---

## Architecture

```
Customer App (React Native + Expo) ──HTTPS/REST──┐
                                                 ▼
                                          Node.js API (Express + TS + Socket.IO) ──► MongoDB Atlas
                                                 ▲                                              │
Restaurant Portal (React + Vite) ──REST/Socket───┘                                              │
                                                 ◄── Socket.IO realtime ───────────────────────┘
```

## Monorepo

```
EasyCart/
├── apps/
│   ├── server/       # Node + Express + TS + Socket.IO
│   ├── restaurant/   # React + Vite + MUI + Tailwind
│   └── customer/     # React Native + Expo + TS
├── packages/
│   ├── shared-types/
│   └── shared-utils/
├── .env.example
└── package.json
```

## Quick Start

### 1. Backend
```bash
cd apps/server
npm install
cp ../../.env.example .env  # fill MONGODB_URI & JWT_SECRET
npm run dev  # http://localhost:5000
```

### 2. Restaurant Portal
```bash
cd apps/restaurant
npm install
npm run dev  # http://localhost:5173
```

### 3. Customer App
```bash
cd apps/customer
npm install
npx expo start
```

## Core Workflow

```
Customer: Search → Add to Cart → Pay (Razorpay Test) → PAID → Wait → READY notification → Show QR → PICKED_UP
Restaurant: New Order → ACCEPT → PREPARING → READY → Verify QR → PICKED_UP
```

Order States: `PENDING_PAYMENT → PAID → ACCEPTED → PREPARING → READY → PICKED_UP` (+ `CANCELLED`)

## Test Scenario

See `scripts/test-workflow.js` or follow phase 10 in spec.

## Tech

- Backend: Express, Mongoose, JWT, bcrypt, Socket.IO, Razorpay (Test Mode isolated service), express-validator, helmet, cors
- Frontend: MUI v6 + Tailwind, React Router, Axios, Socket.IO-Client, QRCode
- Mobile: Expo, React Navigation, Axios, Socket.IO-Client, expo-barcode-scanner (QR)

## Environment

Copy `.env.example` → `.env` . Never commit `.env`.

## License

MIT
