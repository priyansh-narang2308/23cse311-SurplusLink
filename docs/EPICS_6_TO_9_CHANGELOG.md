# SurplusLink: Epics 6 through 9 - Feature Documentation & Architecture Changelog

This document provides a comprehensive breakdown of the advanced features, system architecture upgrades, and robust testing implementations delivered during **Epics 6, 7, 8, and 9**.

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
*End of Document. All corresponding APIs and Testing Strategies have been updated in `API_REFERENCE.md` and `TESTING_STRATEGY.md`.*
