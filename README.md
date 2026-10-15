# Trackly — Internship application tracker

Trackly is a responsive full-stack web application for organizing internship applications. Create an account, track each company and role, record application dates and notes, and update an application through Wishlist, Applied, Interview, Offer, or Rejected.

## Run locally

Requirements: Node.js 18 or newer. No npm packages or database server are required.

1. Open a terminal in this folder.
2. Run `npm start` (or `node server.js`).
3. Visit **http://localhost:3000**.

The server creates `data/db.json` on first run. Keep that file private: it contains account password hashes and application data. The app uses in-memory login sessions, so after a server restart, sign in again. Set `PORT` to use another port.

## Features

- Register and sign in with email and password (passwords are salted and hashed with Node's built-in scrypt).
- Each user sees only their own applications.
- REST API supports create, list, update, and delete operations.
- Search by company, role, and location; filter by application status.
- Dashboard counts for total applications, applications in progress, interviews, and offers.
- Responsive layout, form validation, and clear empty/error states.
- Node.js built-in HTTP server and JSON file persistence; no external packages.

## API overview

All protected routes require `Authorization: Bearer <token>` from the login or registration response.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Health check |
| POST | `/api/auth/register` | Create an account |
| POST | `/api/auth/login` | Sign in |
| POST | `/api/auth/logout` | Sign out of this server process |
| GET | `/api/auth/me` | Get the signed-in user |
| GET | `/api/applications` | List the user's applications |
| POST | `/api/applications` | Create an application |
| PUT | `/api/applications/:id` | Update an application |
| DELETE | `/api/applications/:id` | Delete an application |

Application fields: `company` and `role` (required), `status`, `location`, `link`, `appliedDate`, and `notes`.

## Short project report

**Problem:** Internship applicants often track opportunities across notes, browser tabs, and spreadsheets, making follow-ups and progress hard to see.

**Solution:** Trackly brings applications into one personal dashboard, with clear status stages, search, and quick progress summaries.

**Implementation:** The frontend is plain HTML, CSS, and JavaScript. A Node.js REST API handles authentication and CRUD. A JSON file acts as a small persistent database, and every application is scoped to its owner. This keeps the project easy to run without external services.

**Local verification:** Start the server using the instructions above and open the health check at `http://localhost:3000/api/health`; then register and add an application from the UI.

**Deployment and source hosting:** This workspace contains the source code, ready to push to a GitHub repository and deploy to a Node.js host. A public live URL and GitHub repository require the owner's hosting/GitHub account and are not created by running this local project.
