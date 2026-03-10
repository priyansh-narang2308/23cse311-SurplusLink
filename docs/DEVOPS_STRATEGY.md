# SurplusLink DevOps Strategy

This document outlines the infrastructure, deployment pipeline, and operational procedures for the SurplusLink ecosystem, fulfilling the requirements for official architectural review.

---

## 1. System Infrastructure Diagram

The following Mermaid diagram visualizes the flow from development to high-availability production environments.

[**Devops Diagram**](./diagrams/devopsdiag.png)

---

## 2. Component Deployment Matrix

The following table identifies each component, its source code repository, deployment environment, and mandatory safety checks.

| Component | Source Code Repository | Deployment Location | Pre-Deployment Checks | Tools & Libraries |
| :--- | :--- | :--- | :--- | :--- |
| **Frontend Dashboard** | [SurplusLink-Frontend](https://github.com/23cse311-Surpluslink/Frontend) | **Vercel** (`https://surpluslink.vercel.app`) | ESLint, TS Compiler, Vitest Unit Tests | React, Vite, Framer Motion, Axios, IndexedDB (PWA) |
| **API Backend** | [SurplusLink-Backend](https://github.com/23cse311-Surpluslink/Backend) | **Render** (`https://surpluslink-9fq6.onrender.com`) | Supertest Integration, Vitest, npm audit | Node.js, Express, Mongoose, JWT, Nodemailer |
| **Message Broker** | Managed via Backend | **CloudAMQP (RabbitMQ)** | Connection Resilience, Fallback Testing | amqplib, Async Queues |
| **Volunteer Mobile App** | [SurplusLink-Mobile](https://github.com/23cse311-Surpluslink/Mobile) | **App Store / Play Store** | Flutter Analyze, Flutter Test, Widget Testing | Flutter, Dart, Riverpod, Google Maps API |
| **Database Cluster** | Managed via Backend | **MongoDB Atlas (AWS)** | Schema Validation, IP Whitelisting | Mongoose, GeoJSON, 2dsphere indexing |

---

## 3. Infrastructure as Code (Docker)

To ensure a "Works on my machine" experience, we provide a unified Docker orchestration for local development and staging simulation.

- **`backend/Dockerfile`**: Multi-stage Node.js build (Alpine base) for minimal footprint.
- **`frontend/Dockerfile`**: Static asset generation using Vite, served via Nginx.
- **`docker-compose.yml`**: Links the Backend, Frontend, and a local MongoDB instance to simulate the full multi-cloud production environment locally.

---

## 4. Detailed CI/CD Workflow

Our automated architecture ensures that every push to the **Monorepo** or the **Standalone Repositories** is verified before production.

### **Phase 1: Validation (Continuous Integration)**
1.  **Monorepo CI**: Global checks and cross-service integration tests.
2.  **Service CI**: Individual workflows (e.g., `backend/.github/workflows/ci.yml`) that run within the standalone organization repos to gate the deployment.
3.  **Core Checks**:
    - **Linting**: Static analysis of JavaScript and TypeScript files.
    - **Unit Testing**: Isolated tests for matching logic using **Vitest**.
    - **Security Audit**: Automated `npm audit` scans to identify vulnerable dependencies.

### **Phase 2: Build & Deployment (Continuous Deployment)**
1.  **Build Verification**: Components are built into production bundles. Any build warning on the frontend cancels the deployment.
2.  **Auto-Sync**: On a successful test pass, GitHub Actions triggers direct deployment hooks for Vercel and Render.
3.  **Zero-Downtime Migration**: Render and Vercel manage green-blue deployments, keeping the old version active until the new version passes health checks.

---

## 5. Security & Operational Policy

- **SSL/TLS**: Mandatory HTTPS (TLS 1.3) for all communication.
- **CORS Policy**: Restrictive origin-locking allowing only the production frontend to communicate with the API.
- **Secret Management**: API Keys, Database Connection URIs, and Cloudinary secrets are injected at runtime via encrypted environment variables (Github Secrets -> Render/Vercel Env).
- **Watchdog Services (Cron)**: Backend task workers run every 15 minutes to scan for stalled rescue missions and stale donation data.

--- 
*Last Updated: February 10, 2026*
