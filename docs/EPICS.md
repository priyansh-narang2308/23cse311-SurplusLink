# SurplusLink: Comprehensive System Epics (1-9) - Feature Documentation

This document provides a detailed breakdown of all system features, architecture updates, and functional modules implemented across the SurplusLink platform.

---

## Epic 1: Identity, Authentication & Profile Management
**Focus**: *Secure multi-role onboarding and unified access control.*

### Core Features Implemented:
1.  **Unified Multi-Role Registration** (`frontend/src/pages/login-page.tsx`):
    *   Dynamic onboarding flow that collects role-specific details for Donors, NGOs, and Volunteers.
    *   Secure document upload integration for verification (Permits, IDs).
2.  **Secure Passwordless & Social Login**:
    *   Integrated OTP-based authentication and Google Social Login support.
    *   Handled via `auth.controller.js` with secure JWT session tokens.
3.  **Role-Based Access Control (RBAC)**:
    *   Robust middleware to restrict access to sensitive routes and API endpoints.
    *   Automated dashboard redirection based on authenticated user role.

---

## Epic 2: Donor Surplus Food Management
**Focus**: *Streamlined donation lifecycle with safety-first validation.*

### Core Features Implemented:
1.  **Safety-Aware Donation Workflow** (`frontend/src/pages/donor/`):
    *   Mandatory safety window validation to ensure food is consumed before spoiling.
    *   Logic: `((expiry_time − current_time) ≥ required_safety_window)`.
2.  **Dynamic Pickup Scheduling**:
    *   Donors can schedule pickups in advance, allowing NGOs and Volunteers to plan logistics efficiently.
3.  **Dietary & Allergen Cataloging**:
    *   Support for dietary tags (Veg, Non-Veg, Halal) and allergen metadata to prevent unsafe distribution.
4.  **Donor Impact Analytics**:
    *   Dashboard view showing donation history, acceptance rates, and personal community impact.

---

## Epic 3: NGO Food Request & Acceptance Management
**Focus**: *Intake optimization, capacity management, and safety compliance.*

### Core Features Implemented:
1.  **Intelligent Capacity Modeling** (`frontend/src/pages/ngo/ngo-dashboard.tsx`):
    *   Configurable daily intake limits and storage types (Cold, Frozen, Dry).
2.  **Geo-Location Based Discovery**:
    *   Real-time map and list views for NGOs to find nearby unassigned donations.
    *   Filters for food type, expiry time, and proximity.
3.  **Urgency-Driven Priority Signaling**:
    *   NGOs can flag "Urgent Demand" to shift system matching priorities toward critical needs.
4.  **Verified Safety Rejections**:
    *   Standardized flow for NGOs to reject unsafe donations with mandatory reasoning for audit trails.

---

## Epic 4: Volunteer Availability & Delivery Execution
**Focus**: *Real-time logistics, task management, and handover accountability.*

### Core Features Implemented:
1.  **Real-Time Availability Toggle** (`frontend/src/pages/volunteer/volunteer-dashboard.tsx`):
    *   Online/Offline status management to prevent unwanted task assignments.
2.  **Context-Aware Task Cards**:
    *   Provides full route preview, ETA, and cargo details (Quantity, Perishability) before task acceptance.
3.  **Proof of Delivery (PoD) Module**:
    *   Mandatory digital documentation (photos or digital signatures) to confirm successful handover.
4.  **Auto-Recovery & Delay Handling**:
    *   System-wide monitoring to detect stalled tasks and trigger automatic reassignment timeouts.

---

## Epic 5: Intelligent Matching & Supply Chain Optimization
**Focus**: *Algorithmic optimization of the donor-to-beneficiary pipeline.*

### Core Features Implemented:
1.  **Proximity & Need-Based Matching** (`backend/services/matching.service.js`):
    *   Ranking algorithm that pairs donors with the most suitable/nearest NGOs.
2.  **Automated Volunteer Dispatch**:
    *   Intelligent assignment logic considering vehicle capacity and volunteer distance from pickup.
3.  **Sustainability Metrics Engine**:
    *   Calculates CO₂ savings and "Meals Saved" count for every successful delivery mission.
4.  **Load Balancing Logic**:
    *   Prevents specific NGOs or Volunteers from being overloaded with consecutive tasks.

---

## Epic 6: Admin Logistics & Governance Hub
**Focus**: *System oversight, policy enforcement, user accountability, and real-time monitoring.*

### Core Features Implemented:
1.  **Centralized Admin Dashboard** (`frontend/src/pages/admin/admin-dashboard.tsx`):
    *   Provides high-level system metrics (Total Donations, Active Missions, Pending Verifications).
    *   Acts as the central navigation hub for all governance operations.
2.  **KYC & User Verification System** (`frontend/src/pages/admin/verification.tsx`):
    *   A dedicated queue for reviewing NGO and Volunteer documents (Permits, Tax IDs, Vehicle Specs).
    *   Allows Admins to selectively completely approve or reject pending profiles via `PATCH /api/v1/users/admin/verify`.
3.  **Dynamic Safety Rules Enforcement** (`frontend/src/pages/admin/safety-rules.tsx`):
    *   CRUD interface for food safety compliance.
    *   Admins define maximum transit times and storage requirements (`cold`, `frozen`, `dry`) based on food categories.
4.  **Active Mission Monitoring** (`frontend/src/pages/admin/active-tasks.tsx`):
    *   Real-time system-wide logistics overview showing all currently active deliveries.
    *   **Admin Intervention**: Admins can forcibly pause, cancel, or reassign missions if a volunteer is stalled or reports an emergency.
5.  **Immutable Audit Trails** (`frontend/src/pages/admin/audit-logs.tsx`):
    *   Every critical system action (KYC approval, mission cancellation, safety rejection) is permanently logged with IP, Category, and Metadata using the `AuditLog` Model.

---

## Epic 7: Intelligent Routing & Multi-Stop Pathfinding
**Focus**: *Volunteer efficiency, fuel cost reduction, and emergency diversion logic.*

### Core Features Implemented:
1.  **Dijkstra-based Path Optimization** (`backend/services/routing.service.js`):
    *   Integrates with Google Maps Distance Matrix API.
    *   Calculates the most efficient sequence from the Volunteer's current GPS -> Pickup -> Dropoff.
    *   Custom cost matrix heavily punishing traffic delays (Traffic Duration x 1.5).
2.  **Dynamic High-Priority Diversions**:
    *   During routing, the engine scans a 5km radius for *unassigned, critical-urgency* donations (expiring within 1 hour).
    *   If found, it auto-injects a "Diversion Waypoint" into the Volunteer's path without requiring a manual claim, saving hyper-perishable food.
3.  **Resilient Fallback Mode**:
    *   If the Google Maps API rate limits, times out, or the API key is invalid/testing (`test_key`), the engine gracefully degrades to calculate a straight-line Haversine approximation without outright failing the request.

---

## Epic 8: Offline Capabilities & Graceful Degradation
**Focus**: *Platform resilience, developing-nation network realities, and queue fallbacks.*

### Core Features Implemented:
1.  **PWA IndexedDB Storage** (`frontend/src/lib/offline-storage.ts`):
    *   Caches the Smart Feed, Active Missions, and user profile data locally.
    *   When the network drops, volunteers can still view their current mission addresses and contact details from the local DB.
    *   **Action Queuing**: If a Volunteer clicks "Confirm Pickup" while offline, the action is queued in IndexedDB and automatically synchronized to the server the moment connectivity returns.
2.  **RabbitMQ Fallback Mechanisms** (`backend/utils/notification.js`):
    *   The platform utilizes RabbitMQ for asynchronous notifications (Push/Email).
    *   **Graceful Degradation**: If the RabbitMQ broker goes offline, the system detects the failed channel connection and automatically falls back to *synchronous* processing, ensuring critical delivery alerts are never dropped.

---

## Epic 9: Advanced Analytics, Trust Scores & Anomaly Detection
**Focus**: *Platform health, user behavior tracking, and organizational reporting.*

### Core Features Implemented:
1.  **Global Reporting Engine** (`backend/controllers/report.controller.js`):
    *   Generates comprehensive analytical reports for the entire system (Admins) or personal impact tracking (Donors).
    *   Aggregates data across date ranges (Status Breakdown, Perishability Counts, Total Impact).
2.  **Volunteer Performance Metrics** (`tests/report_vol.test.js`):
    *   Tracks average response times, mission success rates, and active vs idle ratios.
3.  **Dynamic Trust Score Calculation**:
    *   Donors and Volunteers begin with a 5.0 Trust Score.
    *   Impacted positively by verified deliveries and timely pickups.
    *   Penalized by consecutive cancellations, reported violations, or safety audit rejections from NGOs.
4.  **System Anomaly Detection** (`tests/supervision.test.js`):
    *   Tracks latency, error rates, and unresolved missions.
    *   **Cron Supervisor**: If a mission remains unassigned for too long, or an NGO's daily capacity exceeds 80%, the system triggers load-balancing multipliers to shift volume to other NGOs or boost volunteer incentives.

---
*End of Document.*
