# API Documentation

This document provides an overview of all the API endpoints available in the application.

All API routes are prefixed by default with `/api` unless otherwise configured in the root Express app. The base path for the following routes is assumed to be `/api`.

---

## General Routes

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | Health check endpoint to verify the server is running. | No |

---

## Authentication (`/auth`)

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/auth/register` | Register a new organization account. | No |
| `POST` | `/auth/login` | Authenticate an organization and receive a JWT token. | No |

---

## Jobs (`/jobs`)

**Note:** All job endpoints require standard Bearer token authentication via the `Authorization` header (`auth.middleware`).

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/jobs` | Retrieve all jobs belonging to the authenticated organization. | Yes |
| `POST` | `/jobs` | Create a new job under the authenticated organization. | Yes |
| `GET` | `/jobs/:id` | Get details of a specific job by its ID. | Yes |
| `PUT` | `/jobs/:id` | Update details of a specific job by its ID. | Yes |
| `DELETE` | `/jobs/:id` | Delete a specific job by its ID. | Yes |
| `POST` | `/jobs/:id/publish` | Change a job's status to published. | Yes |
| `POST` | `/jobs/:id/draft` | Change a job's status to draft. | Yes |
| `POST` | `/jobs/:jobId/agent`| Create/configure an AI conversational agent for the specific job via Retell AI. | Yes |

---

## Candidates (`/candidates`)

Endpoints for interacting with applicants. Partially public.

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/candidates/apply` | Public endpoint for a candidate to apply to a job. | No |
| `GET` | `/candidates/job/:jobId` | Get all candidates that applied for a specific job. | Yes |
| `GET` | `/candidates/:id` | Get the details and evaluation results of a specific candidate. | Yes |
| `PATCH` | `/candidates/:id/status`| Update the status of a specific candidate (e.g., Shortlisted, Rejected). | Yes |

---

## Interviews (`/interview`)

Endpoints for managing interview sessions with Retell AI.

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/interview/start` | Start an interview session for a candidate. Typically public for ease of candidate access. | No |
| `POST` | `/interview/end` | End an interview session. Used by the frontend or as a Retell webhook callback. | No |

---

## Authentication Middleware Details
Endpoints that require `Auth Required: Yes` expect an `Authorization` header in the HTTP request containing a valid JWT.
**Format:** `Authorization: Bearer <your_jwt_token_here>`

The middleware decrypts the token, extracts the `_id` of the organization, fetches the organization from MongoDB, and attaches it to the request (`req.organization`).
