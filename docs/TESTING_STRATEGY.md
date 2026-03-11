# SurplusLink Testing Strategy

This document defines the comprehensive quality assurance framework for the SurplusLink ecosystem, ensuring that every layer of the multi-role platform (Donor, NGO, Volunteer, Admin) is verified for correctness, security, and reliability.

---

## 1. Component-Specific Testing Matrix

This matrix identifies how each architectural tier is tested and the specific properties verified.

| Component | Test Level | Properties Tested | Tools & Libraries |
| :--- | :--- | :--- | :--- |
| **Backend API** | Unit & Integration | Matching Logic Correctness, Transaction Integrity (Atomicity), Security (RBAC), API Contract Compliance. | Vitest, Supertest, Mongoose, npm audit |
| **Frontend Web** | Unit & Functional | UI Consistency, Form Validation, Role-Based Access Control, State Management. | Vitest, React Testing Library, MSW |
| **Mobile App** | Widget & Unit | State Management (Riverpod), Location Permission Handling, Smooth Navigation, Camera Integration. | Flutter Test, Widget Testing, Mockito |
| **Database** | Integration | Geospatial Indexing (`2dsphere`), Schema Constraints, Query Performance. | MongoDB, Mongoose, Vitest |

---

## 2. Testing Levels & Methodologies

### **A. Unit Testing (Isolated Logic)**
*   **Backend**: Focuses on core algorithms such as the **Intelligent Matching Engine** (Priority scoring based on 40% distance/60% urgency), **Trust Score Calculators**, and **Routing Fallback Logic**.
*   **Frontend**: Verifies components render correctly and utility pipelines format data accurately (e.g., date formats, distance conversions).
*   **Mobile/PWA**: Validates utility functions for distance calculation, offline data cueing (`indexedDB`), and timestamp formatting.

### **B. Integration Testing (Service Interoperability)**
*   **REST API Level**: Using **Supertest/Vitest** to verify end-to-end flows (e.g., Donation Lifecycle, Admin User Verification, and Safety Rule CRUD operations).
*   **Auth Flow**: Verifies that JWT cookies are correctly issued, stored as `HttpOnly`, and rejected when expired.
*   **Pathfinding & Routing**: Mocks Google Maps APIs to verify Dijkstra routing responses, waypoint injection for diversions, and fallback approximations.
*   **System Degradation**: Simulates RabbitMQ failures to verify synchronous `notification.js` failovers and IndexedDB synchronization consistency.

### **C. System & E2E Testing (User Workflows)**
*   **The Happy Path**: Manual and automated walkthroughs verifying the sequence:  
    `Donor Posts` -> `Matching Engine Prioritizes` -> `NGO Claims` -> `Volunteer Accepts` -> `Delivery Verified`.
*   **Concurrency Handling**: Testing the system under simulated race conditions (multi-click scenarios) to ensure a mission is never double-assigned.
*   **Admin Reporting**: Validates PDF/CSV generation and data aggregation logic accuracy for Global Reports.

---

## 3. Properties Verified per Component

### **1. Security & Access Control**
*   **Frontend/Mobile**: Verification that users cannot navigate to unauthorized screens (e.g., Volunteer accessing Admin Analytics).
*   **Backend**: Ensuring all restricted endpoints require a valid, non-expired JWT.

### **2. Reliability (Geospatial & Timing)**
*   **Backend**: Accuracy of the matching algorithm within a 15km precision.
*   **System**: Verification that the **Cron Supervisor** correctly unassigns "stalled" missions every 15 minutes.

### **3. Transactional Integrity (Correctness)**
*   **Backend**: Atomic mission claiming using MongoDB's unique indexing and conditional updates to prevent data corruption.
*   **Mobile**: Verification that location updates are correctly transmitted to the backend at specified intervals.

---

## 4. Test Infrastructure & Automations

| Platform | Role |
| :--- | :--- |
| **GitHub Actions** | Automated CI runner that executes all JS/TS and Flutter tests on every PR. |
| **Vitest** | Primary test runner for the monorepo; used for its native ESM support and performance. |
| **React Testing Library** | Used to simulate user interactions (clicks, typing) in the web dashboard. |
| **Flutter Test** | Validates cross-platform UI behavior for the volunteer experience. |

--- 
*Last Updated: March 11, 2026*
