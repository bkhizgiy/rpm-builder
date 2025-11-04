#!/usr/bin/env bash

set -euo pipefail

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}RPM Builder - Local Development Setup${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""

# Check if oc is available
if ! command -v oc &> /dev/null; then
    echo -e "${RED}Error: 'oc' command not found. Please install the OpenShift CLI.${NC}"
    exit 1
fi

# Check if connected to cluster
if ! oc whoami &> /dev/null; then
    echo -e "${RED}Error: Not connected to an OpenShift cluster. Please login first with 'oc login'.${NC}"
    exit 1
fi

# Get current namespace
CURRENT_NAMESPACE=$(oc project -q)
echo -e "${YELLOW}Current namespace: ${CURRENT_NAMESPACE}${NC}"
echo ""

# Confirm namespace
read -p "Deploy to namespace '${CURRENT_NAMESPACE}'? [y/N] " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Deployment cancelled.${NC}"
    exit 0
fi

echo ""
echo -e "${GREEN}Step 1: Deploying RBAC resources...${NC}"

# Create a temporary directory for processed manifests
TEMP_DIR=$(mktemp -d)
trap "rm -rf ${TEMP_DIR}" EXIT

# Process RBAC file with current namespace
sed "s/\${NAMESPACE}/${CURRENT_NAMESPACE}/g" k8s/rbac.yaml > "${TEMP_DIR}/rbac.yaml"

# Apply RBAC
if oc apply -f "${TEMP_DIR}/rbac.yaml"; then
    echo -e "${GREEN}✓ RBAC resources deployed${NC}"
else
    echo -e "${RED}✗ Failed to deploy RBAC resources${NC}"
    exit 1
fi

# Add developer labels to RBAC resources for easy identification
echo "Adding developer labels to RBAC resources..."
oc label serviceaccount rpm-builder-sa \
    rpm-builder.io/dev-mode=true \
    rpm-builder.io/developer=${USER} \
    --overwrite -n ${CURRENT_NAMESPACE} 2>/dev/null || true

oc label role rpm-builder-namespace-role \
    rpm-builder.io/dev-mode=true \
    rpm-builder.io/developer=${USER} \
    --overwrite -n ${CURRENT_NAMESPACE} 2>/dev/null || true

oc label rolebinding rpm-builder-namespace-binding \
    rpm-builder.io/dev-mode=true \
    rpm-builder.io/developer=${USER} \
    --overwrite -n ${CURRENT_NAMESPACE} 2>/dev/null || true

oc label clusterrole rpm-builder-role \
    rpm-builder.io/dev-mode=true \
    rpm-builder.io/developer=${USER} \
    --overwrite 2>/dev/null || true

oc label clusterrolebinding rpm-builder-binding \
    rpm-builder.io/dev-mode=true \
    rpm-builder.io/developer=${USER} \
    --overwrite 2>/dev/null || true

echo ""
echo -e "${GREEN}Step 2: Deploying Tekton Pipeline...${NC}"

# Apply Tekton resources directly (they already have proper labels)
if oc apply -f k8s/tekton-pipeline.yaml -n "${CURRENT_NAMESPACE}"; then
    echo -e "${GREEN}✓ Tekton Pipeline deployed${NC}"
else
    echo -e "${RED}✗ Failed to deploy Tekton Pipeline${NC}"
    exit 1
fi

# Add developer labels to deployed resources for easy identification
echo "Adding developer labels to resources..."
oc label pipeline rpm-build-pipeline \
    rpm-builder.io/dev-mode=true \
    rpm-builder.io/developer=${USER} \
    --overwrite 2>/dev/null || true

for task in prepare-build-env fetch-sources install-dependencies generate-spec-file build-rpm-package publish-rpm-artifacts; do
    oc label task ${task} \
        rpm-builder.io/dev-mode=true \
        rpm-builder.io/developer=${USER} \
        --overwrite 2>/dev/null || true
done

echo ""
echo -e "${GREEN}Step 3: Verifying deployment...${NC}"

# Wait for resources to be ready
echo "Checking Pipeline..."
if oc get pipeline rpm-build-pipeline -n "${CURRENT_NAMESPACE}" &> /dev/null; then
    echo -e "${GREEN}✓ Pipeline 'rpm-build-pipeline' is ready${NC}"
else
    echo -e "${RED}✗ Pipeline not found${NC}"
    exit 1
fi

echo "Checking Tasks..."
TASKS=("prepare-build-env" "fetch-sources" "install-dependencies" "generate-spec-file" "build-rpm-package" "publish-rpm-artifacts")
for task in "${TASKS[@]}"; do
    if oc get task "${task}" -n "${CURRENT_NAMESPACE}" &> /dev/null; then
        echo -e "${GREEN}  ✓ Task '${task}' is ready${NC}"
    else
        echo -e "${YELLOW}  ⚠ Task '${task}' not found (may be a warning)${NC}"
    fi
done

echo "Checking ServiceAccount..."
if oc get serviceaccount rpm-builder-sa -n "${CURRENT_NAMESPACE}" &> /dev/null; then
    echo -e "${GREEN}✓ ServiceAccount 'rpm-builder-sa' is ready${NC}"
else
    echo -e "${YELLOW}⚠ ServiceAccount not found (may need manual verification)${NC}"
fi

echo ""
echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}Backend Deployment Complete!${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""
echo -e "${YELLOW}Next Steps for Local UI Development:${NC}"
echo ""
echo "1. Install dependencies (if not done already):"
echo -e "   ${GREEN}npm install${NC} or ${GREEN}yarn install${NC}"
echo ""
echo "2. Start the plugin development server (Terminal 1):"
echo -e "   ${GREEN}npm start${NC}"
echo "   This will start the webpack dev server on http://localhost:9001"
echo ""
echo "3. Start the OpenShift Console bridge (Terminal 2):"
echo -e "   ${GREEN}./start-console.sh${NC}"
echo "   This will start the console on http://localhost:9000"
echo ""
echo "4. Access the console at:"
echo -e "   ${GREEN}http://localhost:9000${NC}"
echo ""
echo -e "${YELLOW}Resource Isolation:${NC}"
echo "  • All resources are labeled with 'rpm-builder.io/dev-mode: true'"
echo "  • All resources are labeled with 'rpm-builder.io/developer: ${USER}'"
echo "  • All builds will run in namespace: ${CURRENT_NAMESPACE}"
echo "  • Resources won't interfere with others in different namespaces"
echo ""
echo -e "${YELLOW}When finished:${NC}"
echo "  Run ${GREEN}./cleanup-local-dev.sh${NC} to remove all deployed resources"
echo ""

