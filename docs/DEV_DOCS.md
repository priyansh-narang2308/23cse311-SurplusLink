# SurplusLink Comprehensive Developer Documentation

SurplusLink is a hyper-local food rescue ecosystem designed to eliminate food waste by bridging the gap between donors, NGOs, and volunteers through real-time logistics and intelligent matching algorithms.

---

## 1. System Architecture & High-Level Design

### **Core Philosophical Principles**
- **Hyper-Locality**: Uses Geospatial indexing (2dsphere) to prioritize matches within a 5-15km radius.
- **Safety First**: Implements strict timing buffers (e.g., no pickups within 30 mins of expiry).
- **Transparency**: Proof-of-delivery via photo uploads and public trust scores for donors.

### **Integrated Tech Stack**
| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend** | React 18 + Vite | SPA architecture for high performance. |
| **Styling** | Tailwind CSS + Shadcn UI | Modern, accessible, and premium design system. |
| **State** | React Context API | Global authentication and notification state. |
| **Backend** | Node.js + Express | RESTful API with modular routing. |
| **Database** | MongoDB Atlas | Document storage with Geospatial capabilities. |
| **Files** | Cloudinary | Secure storage for POD (Proof of Delivery) images. |
| **Auth** | JWT + HttpOnly Cookies | Secure cross-site session management. |
| **Maps** | Google Maps API | Route optimization and geocoding. |
| **Messaging** | RabbitMQ | Asynchronous notifications with sync fallback. |
| **Offline** | IndexedDB (PWA) | Local caching and action queuing for resilience. |
| **DevOps** | GitHub Actions + Docker | CI/CD pipeline and deployment automation. |

---

## 2. Database Schema (Deep Dive)

### **User Entity**
- `role`: (`donor`, `ngo`, `volunteer`, `admin`).
- `status`: (`pending`, `active`, `deactivated`).
- `organization`: Name of the business/NGO.
- `volunteerProfile`: 
    - `vehicleType`: (Cycle, Bike, Car, Van).
    - `capacity`: Max weight in kg.
    - `currentLocation`: GeoJSON Point (updated in real-time).
- `trustScore`: Calculated from user feedback and completion rates.

### **Donation Entity**
- `status`: (`active`, `assigned`, `completed`, `cancelled`, `expired`).
- `deliveryStatus`: (`idle`, `pending_pickup`, `at_pickup`, `in_transit`, `delivered`).
- `storageReq`: (`ambient`, `chilled`, `frozen`).
- `perishability`: (High, Medium, Low).
- `coordinates`: GeoJSON Point (Pickup location).
- `photos`: Array of Cloudinary URLs.
- `feedback`: Rating and comments from the recipient NGO.

---

## 3. API Endpoints (Comprehensive)

> **Note**: For detailed request/response payloads and error codes, please refer to the [**Detailed API Reference**](./docs/API_REFERENCE.md).
> **Note**: For a complete list of advanced features developed during Epics 1 through 9 (Admin Hub, Routing, Offline Support, Reports), please see [**System Epics Documentation**](./docs/EPICS.md).

### **A. Authentication (`/api/v1/auth`)**
| Path | Method | Access | Function |
| :--- | :--- | :--- | :--- |
| `/signup` | POST | Public | User registration + OTP dispatch. |
| `/login` | POST | Public | Credential verification + Cookie set. |
| `/verify-otp` | POST | Public | Email verification / Login security. |
| `/send-otp` | POST | Public | Request a new verification code. |
| `/forgot-password` | POST | Public | Request reset token via email. |
| `/reset-password/:token` | POST | Public | Update password using token. |
| `/logout` | POST | Public | Session termination. |

### **B. Donor Module (`/api/v1/donations`)**
| Path | Method | Access | Function |
| :--- | :--- | :--- | :--- |
| `/` | POST | Donor | Create donation + Multer Photo Upload. |
| `/my-donations` | GET | Donor | List personal donation history. |
| `/stats` | GET | Donor | Volume and Success Rate analytics. |
| `/:id/cancel` | PATCH | Donor | Cancel an unassigned donation. |
| `/:id/best-ngos` | GET | Donor | AI-ranked NGOs based on suitability. |

### **C. NGO Module (`/api/v1/donations`)**
| Path | Method | Access | Function |
| :--- | :--- | :--- | :--- |
| `/feed` | GET | NGO | Smart Feed (Sorted by Proximity & Urgency). |
| `/claimed` | GET | NGO | List of currently claimed missions. |
| `/ngo/stats` | GET | NGO | Efficiency and Impact metrics. |
| `/:id/claim` | PATCH | NGO | Claim a donation for organization. |
| `/:id/reject` | PATCH | NGO | Reject donation (Safety Audit logging). |
| `/ngo/volunteers` | GET | NGO | View associated/nearby volunteers. |

### **D. Volunteer Module**
| Path | Method | Access | Function |
| :--- | :--- | :--- | :--- |
| `/api/v1/donations/available-missions`| GET | Volunteer | Real-time map/list of pickup tasks. |
| `/api/v1/donations/active-mission` | GET | Volunteer | Details of the current task. |
| `/api/v1/donations/:id/accept-mission`| PATCH | Volunteer | Lock mission to self (Atomic lock). |
| `/api/v1/donations/:id/pickup` | PATCH | Volunteer | Confirm pickup + Photo verification. |
| `/api/v1/donations/:id/deliver` | PATCH | Volunteer | Confirm delivery + NGO signature. |
| `/api/v1/users/volunteer/location` | PATCH | Volunteer | Real-time background GPS heartbeat. |
| `/api/v1/donations/:id/optimized-route` | GET | Volunteer | Dijkstra-based pathing optimization. |

### **E. Admin & Governance**
| Path | Method | Access | Function |
| :--- | :--- | :--- | :--- |
| `/api/v1/users/admin/users` | GET | Admin | Full User Management Dashboard. |
| `/api/v1/users/verify` | PATCH | Admin | Approve pending NGOs/Volunteers KYC. |
| `/api/v1/users/admin/pending` | GET | Admin | Queue of verification documents. |
| `/api/v1/donations/admin/active-missions`| GET | Admin | System-wide real-time logistics monitoring. |
| `/api/v1/reports/donations` | GET | Admin | Master Impact Aggregation (CSV/JSON). |

---

## 4. Intelligent Features (The "Engine")

### **1. Suitability Scoring Algorithm**
Uses a weighted matrix to rank NGOs for a donation:
- **Proximity (40%)**: Distance via Haversine formula.
- **Capacity (30%)**: Matches donation volume to NGO daily limits.
- **Urgency (20%)**: Distance to expiry date.
- **Match Rate (10%)**: NGO's historical acceptance of similar food types.

### **2. Dijkstra-based Routing & Diversion**
- **Path Optimization**: Integrates Google Maps Matrix API with a cost-basis punishing traffic delays.
- **Dynamic Diversion**: Auto-scans for critical donations (expiring < 1hr) within 5km of a volunteer's route and auto-injects waypoints.
- **Fallback Mode**: Gracefully degrades to Haversine approximation if external map APIs fail.

### **3. Offline-First Resilience (State Sync)**
- **IndexedDB Caching**: Persists mission details and contact info on the client for offline viewing.
- **Action Queuing**: Strategic actions (Pickup/Deliver) are queued during network drops and synced upon restoration.
- **RabbitMQ Fallback**: If the async message broker is unreachable, notifications failover to synchronous processing.

### **4. Safety Supervisor & Anomaly Detection**
- **Cron Watchdog**: Monitors mission latency; unassigns stagnant volunteers after 15 mins of inactivity.
- **Threshold Alerts**: Triggers load-balancing if an NGO's daily capacity exceeds 80%.
- **Truth Scores**: Dynamically adjusts 1.0-5.0 scores based on audit rejections and delivery success.

---

## 5. Team & Roles

| Contributor | Focus Area |
| :--- | :--- |
| **Priyansh Narang** | Full Stack Architecture & Project Lead |
| **Bala Bharath** | Lead Frontend / UI Engineer |
| **Arpitha Shri** | Backend Logic & Database Performance |
| **Sanjay T** | Quality Assurance & Unit Testing |
| **Sri Pragna** | DevOps, CI/CD & Deployment |

---

## 6. Setup & Deployment

1.  **Clone Repo**: `git clone <repo_url>`
2.  **Install Dependencies**: `npm install` (Root, /frontend, /backend).
3.  **Environment Setup**: Configure `.env` with MongoDB URI, JWT Secret, and Gmail App Password.
4.  **Run Dev**: `npm run dev`
5.  **Run Production**: `npm start` (Backend), `npm run build` (Frontend).

---
