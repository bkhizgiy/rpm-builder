#!/usr/bin/env bash

set -euo pipefail

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}RPM Builder - Cleanup Development Resources${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""

# Check if oc is available
if ! command -v oc &> /dev/null; then
    echo -e "${RED}Error: 'oc' command not found.${NC}"
    exit 1
fi

# Check if connected to cluster
if ! oc whoami &> /dev/null; then
    echo -e "${RED}Error: Not connected to an OpenShift cluster.${NC}"
    exit 1
fi

# Get current namespace
CURRENT_NAMESPACE=$(oc project -q)
echo -e "${YELLOW}Current namespace: ${CURRENT_NAMESPACE}${NC}"
echo ""

# Ask for confirmation
echo -e "${YELLOW}This will remove the following resources from '${CURRENT_NAMESPACE}':${NC}"
echo "  • Tekton Pipeline: rpm-build-pipeline"
echo "  • Tekton Tasks (6 tasks)"
echo "  • ServiceAccount: rpm-builder-sa"
echo "  • ClusterRole: rpm-builder-role"
echo "  • ClusterRoleBinding: rpm-builder-binding"
echo "  • Role: rpm-builder-namespace-role"
echo "  • RoleBinding: rpm-builder-namespace-binding"
echo ""
echo -e "${RED}WARNING: This will also delete any running PipelineRuns!${NC}"
echo ""

read -p "Are you sure you want to continue? [y/N] " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Cleanup cancelled.${NC}"
    exit 0
fi

echo ""
echo -e "${GREEN}Cleaning up resources...${NC}"

# Delete PipelineRuns first (to avoid orphaned resources)
echo "Deleting PipelineRuns..."
if oc delete pipelineruns -l rpm-builder.io/dev-mode=true -n "${CURRENT_NAMESPACE}" --ignore-not-found=true; then
    echo -e "${GREEN}✓ PipelineRuns deleted${NC}"
else
    echo -e "${YELLOW}⚠ No PipelineRuns found or failed to delete${NC}"
fi

# Delete ConfigMaps created by builds
echo "Deleting build ConfigMaps..."
if oc delete configmaps -l app=rpm-builder -n "${CURRENT_NAMESPACE}" --ignore-not-found=true; then
    echo -e "${GREEN}✓ Build ConfigMaps deleted${NC}"
else
    echo -e "${YELLOW}⚠ No ConfigMaps found or failed to delete${NC}"
fi

# Delete PVCs created by builds
echo "Deleting build PVCs..."
if oc delete pvc -l app=rpm-builder -n "${CURRENT_NAMESPACE}" --ignore-not-found=true; then
    echo -e "${GREEN}✓ Build PVCs deleted${NC}"
else
    echo -e "${YELLOW}⚠ No PVCs found or failed to delete${NC}"
fi

# Delete Tekton Pipeline
echo "Deleting Tekton Pipeline..."
if oc delete pipeline rpm-build-pipeline -n "${CURRENT_NAMESPACE}" --ignore-not-found=true; then
    echo -e "${GREEN}✓ Pipeline deleted${NC}"
else
    echo -e "${YELLOW}⚠ Pipeline not found or failed to delete${NC}"
fi

# Delete Tekton Tasks
echo "Deleting Tekton Tasks..."
TASKS=("prepare-build-env" "fetch-sources" "install-dependencies" "generate-spec-file" "build-rpm-package" "publish-rpm-artifacts")
for task in "${TASKS[@]}"; do
    if oc delete task "${task}" -n "${CURRENT_NAMESPACE}" --ignore-not-found=true 2>/dev/null; then
        echo -e "${GREEN}  ✓ Task '${task}' deleted${NC}"
    else
        echo -e "${YELLOW}  ⚠ Task '${task}' not found${NC}"
    fi
done

# Delete RBAC resources in namespace
echo "Deleting namespace RBAC resources..."
if oc delete rolebinding rpm-builder-namespace-binding -n "${CURRENT_NAMESPACE}" --ignore-not-found=true; then
    echo -e "${GREEN}✓ RoleBinding deleted${NC}"
fi
if oc delete role rpm-builder-namespace-role -n "${CURRENT_NAMESPACE}" --ignore-not-found=true; then
    echo -e "${GREEN}✓ Role deleted${NC}"
fi

# Delete ServiceAccount
if oc delete serviceaccount rpm-builder-sa -n "${CURRENT_NAMESPACE}" --ignore-not-found=true; then
    echo -e "${GREEN}✓ ServiceAccount deleted${NC}"
fi

# Delete ClusterRole and ClusterRoleBinding (these are cluster-wide)
echo ""
echo -e "${YELLOW}Cluster-wide resources (ClusterRole and ClusterRoleBinding):${NC}"
echo "These are shared across the cluster. Only delete if you're sure no one else is using them."
read -p "Delete ClusterRole and ClusterRoleBinding? [y/N] " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if oc delete clusterrolebinding rpm-builder-binding --ignore-not-found=true; then
        echo -e "${GREEN}✓ ClusterRoleBinding deleted${NC}"
    fi
    if oc delete clusterrole rpm-builder-role --ignore-not-found=true; then
        echo -e "${GREEN}✓ ClusterRole deleted${NC}"
    fi
else
    echo -e "${YELLOW}⚠ Skipping ClusterRole and ClusterRoleBinding deletion${NC}"
fi

echo ""
echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}Cleanup Complete!${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""
echo "All development resources have been removed from namespace: ${CURRENT_NAMESPACE}"
echo ""

