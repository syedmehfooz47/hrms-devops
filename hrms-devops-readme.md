# HRMS DevOps

![HRMS DevOps CI/CD Pipeline](https://img.shields.io/badge/CI%2FCD-Jenkins%20%7C%20ArgoCD-blue?style=for-the-badge&logo=jenkins) ![Kubernetes](https://img.shields.io/badge/kubernetes-%23326ce5.svg?style=for-the-badge&logo=kubernetes&logoColor=white) ![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=for-the-badge&logo=docker&logoColor=white)

Welcome to the **Pulse HRMS (Human Resource Management System)** DevOps repository. This project contains the complete infrastructure, Kubernetes manifests, and CI/CD pipelines required to deploy and manage the HRMS application.

## 🔗 Live Application
You can view the live application here: **[https://hrms.syedmehfooz.com/](https://hrms.syedmehfooz.com/)**

---

## 🏗️ Architecture Overview

The HRMS application follows a standard 3-tier architecture deployed on a local **Kind (Kubernetes in Docker)** cluster hosted on a VPS.

### Components:
1. **Frontend**: Vite + React application served by Nginx.
2. **Backend**: Node.js REST API.
3. **Database**: PostgreSQL 16 with a persistent local-path volume, featuring automatic schema initialization on boot.

### Network Flow:
Internet -> cPanel Reverse Proxy (`hrms.syedmehfooz.com`) -> VPS `systemd` `socat` proxy (`127.0.0.1:8276`) -> Kind Worker Node IP (`172.23.0.2:31010`) -> Kubernetes Frontend `NodePort` Service -> Frontend Pod.

---

## 🚀 CI/CD Pipeline Workflow

The project utilizes two distinct Jenkins pipelines to implement a fully automated GitOps workflow.

### 1. Continuous Integration (CI) - `Jenkinsfile`
Triggered on every commit to the main branch:
* **Checkout & Skip Check**: Fetches the code and skips execution if `[skip ci]` is in the commit message.
* **Testing & Security**: 
  * Runs Trivy File System Scan to detect vulnerabilities.
  * SonarQube Analysis and Quality Gate checks for code quality and maintainability.
* **Build & Push**: Builds the Docker images (`syedmehfooz/hrms-frontend` and `syedmehfooz/hrms-backend`) with a dynamic tag based on the Jenkins build number (`v1.$BUILD_NUMBER`) and pushes them to DockerHub.
* **Cleanup & Notify**: Cleans up local Docker images, triggers the Continuous Deployment (CD) pipeline, and sends an email report with the build status.

### 2. Continuous Deployment (CD) - `GitOps/Jenkinsfile`
Triggered automatically upon a successful CI build:
* **Manifest Update**: Uses `sed` to update the Docker image tags in the Kubernetes manifest files (`kubernetes/frontend.yml` and `kubernetes/backend.yml`) to match the newly built images.
* **Git Commit & Push**: Commits the updated manifests back to the GitHub repository using the `[skip ci]` tag to prevent triggering an infinite CI loop.
* **Deployment**: Once pushed, ArgoCD (or a similar GitOps controller) detects the changes and syncs the Kubernetes cluster state automatically.

---

## 📁 Kubernetes Resources

All deployment manifests are located in the `kubernetes/` directory:

* `namespace.yml`: Defines the `hrms` namespace.
* `postgres.yml`: Stateful deployment of PostgreSQL with a pinned `nodeSelector` and a config map for automatic `/docker-entrypoint-initdb.d/` schema initialization.
* `persistentVolumeClaim.yaml` & `persistentVolume.yaml`: Manages the 5Gi local storage for the database on a specific Kind worker node.
* `backend.yml`: Deployment and `NodePort` service for the Node.js backend API.
* `frontend.yml`: Deployment and `NodePort` service for the Vite/Nginx frontend.

---

## 🔧 Managing the Frontend Proxy

Since the cluster uses Kind (Kubernetes in Docker), internal `NodePort` services are not exposed natively to the VPS host. We use `socat` wrapped in a `systemd` service to bridge the gap for the frontend.

**Service Location:** `/etc/systemd/system/hrms-frontend-proxy.service`

**Common Commands:**
```bash
# Check the status of the proxy
sudo systemctl status hrms-frontend-proxy

# Restart the proxy (needed if the Kind node IP changes)
sudo systemctl restart hrms-frontend-proxy
```

## 🧑‍💻 Author
**Syed Mehfooz**
