# SurplusLink API Reference v1.0

This document provides a comprehensive guide to the SurplusLink REST API. It includes details on authentication, global error handling, and all available endpoints with example request/response payloads.

---

## 1. Global Configuration

### **Base URL**
`https://surpluslink-api.render.com/api/v1` (Production)  
`http://localhost:8000/api/v1` (Development)

### **Authentication**
SurplusLink uses **JWT (JSON Web Tokens)** for session management. 
- **Mechanism**: On successful login, a token is issued in a `HttpOnly` cookie named `token`.
- **Security**: The cookie is marked `Secure` and `SameSite=None`, ensuring it works across different origins (e.g., Vercel frontend to Render backend) while preventing XSS attacks.
- **Client Handling**: The client doesn't need to manually read or send the token. As long as `withCredentials: true` is set in Axios/Fetch, the browser will automatically attach the cookie to all outgoing requests to the backend.

### **Error Response Structure**
All error responses follow this standard format:
```json
{
  "success": false,
  "message": "Detailed error message here.",
  "stack": "Stack trace (Only visible in Development mode)"
}
```
**Common HTTP Status Codes:**
- `400 Bad Request`: Validation failure or logic error (e.g., food too close to expiry).
- `401 Unauthorized`: Authentication missing or token invalid.
- `403 Forbidden`: User doesn't have the required role (e.g., Donor trying to access NGO feed).
- `404 Not Found`: Resource (User/Donation) does not exist.
- `429 Too Many Requests`: Rate limit exceeded for status updates.

---

## 2. Authentication Endpoints (`/auth`)

### **Signup User**
`POST /auth/signup`
- **Access**: Public
- **Body**:
```json
{
  "name": "Jane NGO",
  "email": "jane@ngo.org",
  "password": "SecurePassword123",
  "role": "ngo",
  "organization": "Green Food Rescue"
}
```
- **Success (201)**:
```json
{
  "success": true,
  "message": "Registration successfull! Please verify your email.",
  "requiresOtp": true,
  "email": "jane@ngo.org"
}
```

### **Login User**
`POST /auth/login`
- **Access**: Public
- **Body**:
```json
{
  "email": "jane@ngo.org",
  "password": "SecurePassword123"
}
```
- **Success (200)**: Sets `token` cookie and returns user profile.

---

## 3. Donor Operations (`/donations`)

### **Post a Donation**
`POST /donations`
- **Access**: Private (Donor)
- **Format**: `multipart/form-data`
- **Fields**:
  - `title`: (String) Name of food item.
  - `foodType`: (String) e.g., "Vegetarian Meal".
  - `quantity`: (String) e.g., "10kg" or "20 portions".
  - `expiryDate`: (Date ISO String).
  - `perishability`: (Enum) `high`, `medium`, `low`.
  - `pickupAddress`: (String) Full physical address.
  - `photos`: (File Array) Up to 5 image files.
- **Success (201)**: Returns the created Donation object.

### **Get Suitability-Ranked NGOs**
`GET /donations/:id/best-ngos`
- **Access**: Private (Donor/Admin)
- **Success (200)**: AI-ranked list based on distance and capacity.

### **Receipt Scanning (OCR)**
`POST /donations/scan-receipt`
- **Access**: Private (Donor)
- **Format**: `multipart/form-data`
- **Fields**: `receipt` (File)
- **Effect**: Extracts food details and expiry from grocery receipts.

---

## 4. NGO Operations (`/donations`)

### **Get Smart Feed**
`GET /donations/feed`
- **Access**: Private (NGO)
- **Description**: Returns prioritized donations based on proximity and urgency.
- **Success (200)**:
```json
{
  "donations": [
    {
      "id": "donation_id",
      "title": "Fresh Bread",
      "suitabilityScore": 88,
      "urgencyLevel": "critical",
      "matchPercentage": 92
    }
  ],
  "capacityWarning": false,
  "unmetNeed": 80
}
```

### **Safety Audit Rejection**
`PATCH /donations/:id/reject`
- **Body**: `{ "rejectionReason": "..." }`

### **Update NGO Settings**
`PUT /users/profile/ngo`
- **Access**: Private (NGO)
- **Body**: `{ "dailyCapacity": 100, "storageTypes": ["cold", "dry"] }`

---

## 5. Volunteer Logistics (`/donations`)

### **Accept Mission (Atomic)**
`PATCH /donations/:id/accept-mission`
- **Access**: Private (Volunteer)
- **Effect**: Locks the mission and sets state to `pending_pickup`.

### **Real-time Status Updates**
`PATCH /donations/:id/delivery-status`
- **Body**: `{ "deliveryStatus": "in_transit" }`
- **Rate Limited**: US 9.1 limits update frequency per mission.

### **Confirm Pickup/Delivery**
`PATCH /donations/:id/pickup` | `PATCH /donations/:id/deliver`
- **Format**: `multipart/form-data`
- **Fields**: `photo` (File)
- **Effect**: Changes mission state; requires photo proof.

### **Get Optimized Route**
`GET /donations/:id/optimized-route`
- **Success (200)**:
```json
{
  "missionId": "...",
  "currentLocation": { "lng": 77.123, "lat": 12.987 },
  "path": [
    { "type": "pickup", "address": "Donor St", "eta": 12 },
    { "type": "dropoff", "address": "NGO Rd", "eta": 25 }
  ],
  "estimatedTotalTime": 37,
  "diversionSuggested": false
}
```

## 7. Admin & Governance (`/users/admin` & `/admin`)

### **Get Full Directory / Pending KYC**
`GET /users/admin/users` | `GET /users/admin/pending`
- **Access**: Private (Admin)
- **Description**: Retrieves user directory. Used for flagging violations and reviewing KYC documents.
- **Success (200)**: Returns arrays of fully populated User models.

### **Verify / Deactivate User**
`PATCH /users/admin/verify` | `PATCH /users/admin/:id/deactivate`
- **Access**: Private (Admin)
- **Body**: `{ "id": "...", "remarks": "..." }`
- **Effect**: Activates or disables platform access for the specified user.

### **Safety Rules Management**
`GET /admin/safety-rules` | `POST /admin/safety-rules`
- **Access**: Private (Admin)
- **Description**: CRUD operations for enforcing storage requirements (`frozen`, `cold`, `dry`) and max durations based on food types.

### **Audit Trails**
`GET /admin/audit-logs`
- **Access**: Private (Admin)
- **Description**: Fetch immutable logs of all critical actions performed across the system (claims, rejections, verifications).

---

## 8. Analytics & Reporting (`/reports`)

### **Global Donation Matrix**
`GET /reports/donations`
- **Access**: Private (Admin/Donor)
- **Description**: Aggregates all donations within a specified `startDate` and `endDate`. Used by Donors for CSR tracking and by Admins for Global PDF/CSV exports.
- **Returns**: Formatted metrics including `Status Breakdown`, `Perishability Counts`, and `Total Impact`.

### **Volunteer Performance Stats**
`GET /reports/volunteer-performance`
- **Access**: Private (Admin)
- **Description**: Advanced metric engine calculating response times, mission success rates, and active/idle patterns for the fleet.

---

### **Data Models (Core Schemas)**

#### **User Model**
| Field | Type | Description |
| :--- | :--- | :--- |
| `name` | String | Legal name of the user. |
| `role` | Enum | `donor`, `ngo`, `volunteer`, `admin`. |
| `status` | Enum | `pending`, `active`, `deactivated`. |
| `isOnline` | Boolean | Volunteer availability toggle. |
| `stats.trustScore` | Number | 1.0 - 5.0 rating dynamically calculated. |
| `violationCount` | Number | Tracked by admins for suspension logic (US 9.1). |

#### **Donation Model**
| Field | Type | Description |
| :--- | :--- | :--- |
| `status` | Enum | `active`, `assigned`, `picked_up`, `completed`, `cancelled`, `expired`. |
| `deliveryStatus`| Enum | `idle`, `pending_pickup`, `heading_to_pickup`, `at_pickup`, `picked_up`, `in_transit`, `arrived_at_delivery`, `delivered`. |
| `perishability` | Enum | `high`, `medium`, `low`. |
| `coordinates` | Point | GeoJSON 2dsphere index for Dijkstra optimizations. |

---
*Last Updated: March 11, 2026 (Epic 9 Final Implementation)*
