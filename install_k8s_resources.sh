#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
NAMESPACE=${RPM_BUILDER_NAMESPACE:-$(oc project -q 2>/dev/null || echo "rpm-builder")}
CLEANUP=${CLEANUP:-false}

print_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo "Options:"
    echo "  -n, --namespace NAMESPACE    Target namespace (default: current project or 'rpm-builder')"
    echo "  -c, --cleanup               Clean up all RPM Builder resources"
    echo "  -h, --help                  Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  RPM_BUILDER_NAMESPACE       Default namespace to use"
    echo ""
    echo "Examples:"
    echo "  $0                          # Install in current/default namespace"
    echo "  $0 -n my-builds            # Install in 'my-builds' namespace"
    echo "  $0 --cleanup               # Remove all RPM Builder resources"
}

cleanup_resources() {
    echo -e "${YELLOW}🧹 Cleaning up RPM Builder resources...${NC}"
    
    # Delete by labels (works across all namespaces)
    echo "Removing Tekton resources..."
    kubectl delete pipelineruns,taskruns -l app=rpm-builder --all-namespaces --ignore-not-found=true
    kubectl delete pipelines,tasks -l app=rpm-builder --all-namespaces --ignore-not-found=true
    
    echo "Removing ConfigMaps and secrets..."
    kubectl delete configmaps,secrets -l app=rpm-builder --all-namespaces --ignore-not-found=true
    
    echo "Removing RBAC resources..."
    kubectl delete clusterrolebinding,clusterrole -l app=rpm-builder --ignore-not-found=true
    kubectl delete rolebinding,role -l app=rpm-builder --all-namespaces --ignore-not-found=true
    kubectl delete serviceaccount -l app=rpm-builder --all-namespaces --ignore-not-found=true
    
    # Clean up by app.kubernetes.io labels as well
    kubectl delete all,configmaps,secrets,rolebindings,roles,serviceaccounts \
        -l app.kubernetes.io/part-of=rpm-builder-plugin --all-namespaces --ignore-not-found=true
    
    echo -e "${GREEN}✅ Cleanup completed!${NC}"
    exit 0
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -n|--namespace)
            NAMESPACE="$2"
            shift 2
            ;;
        -c|--cleanup)
            CLEANUP=true
            shift
            ;;
        -h|--help)
            print_usage
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            print_usage
            exit 1
            ;;
    esac
done

if [ "$CLEANUP" = true ]; then
    cleanup_resources
fi

echo -e "${BLUE}🚀 Installing RPM Builder Kubernetes resources...${NC}"
echo -e "Target namespace: ${GREEN}$NAMESPACE${NC}"

# Check if we're in an OpenShift cluster
if oc version --client > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} OpenShift CLI detected"
else
    echo -e "${YELLOW}⚠️${NC} OpenShift CLI not detected, using kubectl"
fi

# Check if OpenShift Pipelines is installed
if ! kubectl get crd pipelines.tekton.dev > /dev/null 2>&1; then
    echo -e "${RED}❌ Error: OpenShift Pipelines (Tekton) is not installed.${NC}"
    echo "Please install OpenShift Pipelines first:"
    echo "  oc apply -f https://storage.googleapis.com/tekton-releases/pipeline/latest/release.yaml"
    echo "Or install via OperatorHub in the OpenShift Console."
    exit 1
fi

echo -e "${GREEN}✓${NC} OpenShift Pipelines detected"

# Create namespace if it doesn't exist
if ! kubectl get namespace "$NAMESPACE" > /dev/null 2>&1; then
    echo "Creating namespace: $NAMESPACE"
    kubectl create namespace "$NAMESPACE"
    kubectl label namespace "$NAMESPACE" app=rpm-builder app.kubernetes.io/part-of=rpm-builder-plugin
else
    echo -e "${GREEN}✓${NC} Namespace '$NAMESPACE' already exists"
    # Add labels to existing namespace
    kubectl label namespace "$NAMESPACE" app=rpm-builder app.kubernetes.io/part-of=rpm-builder-plugin --overwrite
fi

# Process RBAC template with namespace substitution
echo "Creating RBAC resources..."
export NAMESPACE
envsubst < k8s/rbac.yaml | kubectl apply -f -

echo -e "${GREEN}✓${NC} RBAC configured"

# Deploy Tekton pipeline and tasks in the target namespace
echo "Deploying Tekton pipeline and tasks..."
kubectl apply -f k8s/tekton-pipeline.yaml -n "$NAMESPACE"

echo -e "${GREEN}✓${NC} Tekton pipeline deployed"

# Wait for ServiceAccount to be ready
echo "Waiting for ServiceAccount to be ready..."
kubectl wait --for=jsonpath='{.metadata.name}'=rpm-builder-sa serviceaccount/rpm-builder-sa -n "$NAMESPACE" --timeout=30s

echo ""
echo -e "${GREEN}✅ RPM Builder Kubernetes resources installed successfully!${NC}"
echo -e "📍 Namespace: ${BLUE}$NAMESPACE${NC}"
echo ""
echo -e "${YELLOW}📋 Next steps:${NC}"
echo "1. Build and deploy the console plugin:"
echo "   npm run build"
echo "   docker build -t your-registry/rpm-builder-plugin:latest ."
echo "   docker push your-registry/rpm-builder-plugin:latest"
echo ""
echo "2. Deploy using Helm:"
echo "   helm install rpm-builder-plugin ./charts/openshift-console-plugin \\"
echo "     --set plugin.image=your-registry/rpm-builder-plugin:latest \\"
echo "     --namespace $NAMESPACE"
echo ""
echo "3. Enable the plugin in OpenShift Console:"
echo "   oc patch consoles.operator.openshift.io cluster \\"
echo "     --patch '{\"spec\":{\"plugins\":[\"rpm-builder-plugin\"]}}' \\"
echo "     --type=merge"
echo ""
echo "4. Access the RPM Builder at: Builds → RPM Builder in the OpenShift Console"
echo ""
echo -e "${BLUE}💡 Useful commands:${NC}"
echo "# Check pipeline status:"
echo "  kubectl get pipelines,tasks -n $NAMESPACE"
echo ""
echo "# View builds:"
echo "  kubectl get pipelineruns -n $NAMESPACE"
echo ""
echo "# Clean up everything:"
echo "  ./install_k8s_resources.sh --cleanup"
echo ""
echo "# Install in different namespace:"
echo "  ./install_k8s_resources.sh -n my-custom-namespace"
