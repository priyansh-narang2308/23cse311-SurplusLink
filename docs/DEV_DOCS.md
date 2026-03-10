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

> **Note**: For detailed request/response payloads and error codes, please refer to the [**Detailed API Reference**](./backend/docs/API_REFERENCE.md).
> **Note**: For a complete list of advanced features developed during Epics 6 through 9 (Admin Hub, Routing, Offline Support, Reports), please see [**Epics 6-9 Changelog**](./docs/EPICS_6_TO_9_CHANGELOG.md).

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

### **D. Volunteer Module (`/api/v1/donations`)**
| Path | Method | Access | Function |
| :--- | :--- | :--- | :--- |
| `/available-missions`| GET | Volunteer | Real-time map/list of pickup tasks. |
| `/active-mission` | GET | Volunteer | Details of the current task. |
| `/:id/accept-mission`| PATCH | Volunteer | Lock mission to self (Equity logic). |
| `/:id/pickup` | PATCH | Volunteer | Confirm pickup + Photo verification. |
| `/:id/deliver` | PATCH | Volunteer | Confirm delivery + NGO signature. |
| `/volunteer/location` | PATCH | Volunteer | Real-time background GPS heartbeat. |
| `/:id/optimized-route` | GET | Volunteer | Google Maps Directions API pathing. |

### **E. Admin Module (`/api/v1/users` & `/api/v1/reports`)**
| Path | Method | Access | Function |
| :--- | :--- | :--- | :--- |
| `/admin/users` | GET | Admin | Full User Management Dashboard. |
| `/verify` | PATCH | Admin | Approve pending NGOs/Volunteers. |
| `/admin/pending` | GET | Admin | Queue of verification documents. |
| `/admin/active-missions`| GET | Admin | System-wide real-time logistics monitoring. |
| `/reports/donations` | GET | Admin | Master Aggregation (CSV/JSON). |

---

## 4. Intelligent Features (The "Engine")

### **1. Suitability Scoring Algorithm**
Uses a weighted matrix to rank NGOs for a donation:
- **Proximity (40%)**: Distance via Haversine formula.
- **Capacity (30%)**: Matches donation volume to NGO daily limits.
- **Urgency (20%)**: Distance to expiry date.
- **Match Rate (10%)**: NGO's historical acceptance of similar food types.

### **2. Logistics Auto-Dispatch (Tiered Notification)**
When an NGO claims a donation:
- **Minute 0**: Notify top 3 closest volunteers.
- **Minute 2**: Open mission to all volunteers in 10km.
- **Minute 5**: Radius expansion to 20km automatically.

### **3. Safety Supervisor (Cron Jobs)**
- **Mission Reassignment**: If a volunteer is inactive (no GPS update) for 15 mins while on a mission, the system automatically unassigns them and re-dispatches to others to prevent food spoilage.

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
