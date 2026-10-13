# Hafiz G Mobile

An inventory and sales management application organised as a React frontend and an Express API.

## Application areas

The source includes pages and API routes for products, brands, categories, purchases, sales, customers, suppliers, returns, claims, and settings, alongside dashboard, reports, and invoice-printing pages.

## Technology

| Layer | Tools |
| --- | --- |
| Frontend | React, Vite, Redux Toolkit, React Router, Tailwind CSS |
| API | Node.js, Express, Zod |
| Database | MongoDB, Mongoose |
| Authentication | JWT, bcryptjs |
| Reports and exports | Chart.js, ExcelJS, jsPDF |

## Local setup

Use a Node.js release compatible with the versions of Vite and Mongoose in the package files, npm, and an accessible MongoDB instance.

```bash
git clone https://github.com/mtalhacdx/Hafiz-G-Mobile.git
cd Hafiz-G-Mobile
npm install
npm install --prefix backend
npm install --prefix frontend
```

Copy `backend/.env.example` to `backend/.env`. Set the MongoDB connection and a strong, unique JWT secret for your local environment.

Then run both services:

```bash
npm run dev
```

The API defaults to http://localhost:5000. Use the frontend address printed by Vite in the terminal.

## Commands

Run these from the repository root:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start frontend and backend together |
| `npm run dev:frontend` | Start only the frontend |
| `npm run dev:backend` | Start only the backend |
| `npm run build:frontend` | Build the frontend |
| `npm run start:backend` | Start the backend without the development watcher |

## Structure

- `frontend/` — React application, components, and pages.
- `backend/` — Express application, configuration, and API routes.
- `package.json` — commands for running the two services together.
- `vercel.json` — deployment configuration.

See the [backend notes](backend/README.md) and [frontend notes](frontend/README.md) for additional context.

## Project status

The frontend and backend README files describe earlier implementation stages. The module list above reflects the current source layout, rather than a claim that every workflow has passed end-to-end testing. The package test commands currently report that no tests are configured.
