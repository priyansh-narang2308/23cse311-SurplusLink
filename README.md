# SurplusLink: The Food Redistribution Ecosystem

Welcome to the **SurplusLink** GitHub Organization. This repository serves as the central hub for system orchestration, infrastructure, and cross-project documentation.

---

## The link for multirepo organization - [**Organization**](https://github.com/23cse311-Surpluslink) 

## Sprint 1: Review 1 Submission

This repository contains the full source code and documentation for the first sprint of the Software Engineering project.

### **Core Documentation (Mandatory)**
- [**API Reference**](./docs/API_REFERENCE.md): Detailed endpoint specifications with request/response payloads.
- [**DevOps Strategy**](./docs/DEVOPS_STRATEGY.md): Cloud architecture, CI/CD, and deployment details.
- [**Testing Strategy**](./docs/TESTING_STRATEGY.md): Unit, Integration, and E2E testing procedures.

### **Diagrams (High-Level Design)**
*The following diagrams are located in the `docs/diagrams` directory:*
- [**Use Case Diagram**](./docs/diagrams/use-case.png)
- [**Sequence Diagram**](./docs/diagrams/sequence.png)
- [**Architecture Diagram**](./docs/diagrams/architectureDiagram.png)
- [**ER / Schema Diagram**](./docs/diagrams/er.jpeg)

---

## Organization Repositories
- [**Frontend**](https://github.com/23cse311-Surpluslink/Frontend): The React and Vite dashboard and landing page.
- [**Backend**](https://github.com/23cse311-Surpluslink/Backend): The Node.js matching engine and API core.
- [**Mobile**](https://github.com/23cse311-Surpluslink/Mobile): The Flutter application for on-field volunteers.

---

## System Orchestration (Docker)

To run the entire ecosystem locally:

1.  Navigate to this directory (where `docker-compose.yml` is located).
2.  Run:
    ```bash
    docker-compose up --build
    ```

### Container Architecture
| Container | Port | Role |
| :--- | :--- | :--- |
| `surpluslink-backend` | 8000 | API, Database connectivity, Cron jobs |
| `surpluslink-frontend` | 5173 | Web Dashboard, Admin interface |
| `surpluslink-db` | 27017 | Local MongoDB instance |

---

## The Team
- **Priyansh Narang**: Project Lead / Architecture
- **Bala Bharath**: Lead Frontend / UI
- **Arpitha Shri**: Backend Logic / Database
- **Sanjay T**: Quality Assurance / Testing
- **Sri Pragna**: DevOps / Deployment

---

> Created for the Software Engineering 2025-26 Review.
