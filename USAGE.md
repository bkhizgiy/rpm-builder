# RPM Builder - Quick Usage Guide

## 🚀 Installation

### Option 1: Use Current Namespace
If you've already set your namespace with `oc project <your-namespace>`:
```bash
./install_k8s_resources.sh
```
The script will automatically detect and use your current project namespace.

### Option 2: Specify Namespace
```bash
./install_k8s_resources.sh -n my-builds-namespace
```

### Option 3: Set Environment Variable
```bash
export RPM_BUILDER_NAMESPACE=my-custom-namespace
./install_k8s_resources.sh
```

## 📋 Labels for Organization

All resources are labeled with consistent labels for easy management:

```yaml
labels:
  app: rpm-builder
  component: <type>  # pipeline, task, rbac, etc.
  app.kubernetes.io/name: rpm-builder
  app.kubernetes.io/component: <specific-type>
  app.kubernetes.io/part-of: rpm-builder-plugin
```

## 🧹 Cleanup Commands

### Complete Cleanup (All Namespaces)
```bash
# Using the installer script
./install_k8s_resources.sh --cleanup

# Or manually:
kubectl delete all,configmaps,secrets,rolebindings,roles,serviceaccounts \
  -l app=rpm-builder --all-namespaces

kubectl delete clusterroles,clusterrolebindings \
  -l app=rpm-builder
```

### Namespace-Specific Cleanup
```bash
# Clean up specific namespace
kubectl delete all,configmaps,secrets,rolebindings,roles,serviceaccounts \
  -l app=rpm-builder -n <your-namespace>

# Clean up build artifacts only
kubectl delete pipelineruns,taskruns,configmaps \
  -l app=rpm-builder -n <your-namespace>

# Clean up just build configs (keep pipeline definitions)
kubectl delete configmaps -l component=build-config -n <your-namespace>
```

## 🔍 Monitoring Commands

### Check Installation
```bash
# Verify all components are installed
kubectl get pipelines,tasks,serviceaccounts -l app=rpm-builder -n <namespace>

# Check RBAC
kubectl get clusterroles,clusterrolebindings -l app=rpm-builder
kubectl get roles,rolebindings -l app=rpm-builder -n <namespace>
```

### Monitor Builds
```bash
# List all build jobs
kubectl get pipelineruns -l app=rpm-builder -n <namespace>

# Watch build progress
kubectl get pipelineruns -l app=rpm-builder -w -n <namespace>

# Get build logs
kubectl logs -f <pipelinerun-name> -n <namespace>

# Check specific build by package name
kubectl get pipelineruns -l rpm-builder.io/package-name=my-package -n <namespace>
```

### Troubleshooting
```bash
# Check pipeline tasks
kubectl get tasks -l app=rpm-builder -n <namespace>

# Verify ConfigMaps for a build
kubectl get configmaps -l rpm-builder.io/build-id=<build-id> -n <namespace>

# Check ServiceAccount permissions
kubectl auth can-i create pipelineruns --as=system:serviceaccount:<namespace>:rpm-builder-sa -n <namespace>
```

## 🏷️ Label-Based Queries

### Find All RPM Builder Resources
```bash
kubectl get all -l app=rpm-builder --all-namespaces
```

### Find by Component Type
```bash
# Pipeline components
kubectl get all -l component=pipeline --all-namespaces

# Build artifacts
kubectl get configmaps -l component=build-config --all-namespaces

# Source files
kubectl get configmaps -l component=source-files --all-namespaces
```

### Find by Build ID
```bash
kubectl get all,configmaps -l rpm-builder.io/build-id=<build-id> -n <namespace>
```

### Find by Package Name
```bash
kubectl get pipelineruns -l rpm-builder.io/package-name=<package> --all-namespaces
```

## 🔧 Configuration

### Environment Variables
- `RPM_BUILDER_NAMESPACE`: Default namespace for operations
- `LOG_LEVEL`: Set to `debug` for verbose logging

### Service Configuration
The `rpmBuildService` automatically detects the namespace from:
1. OpenShift Console URL (if available)
2. `RPM_BUILDER_NAMESPACE` environment variable
3. Falls back to `rpm-builder` default

### Custom Base Images
Modify the pipeline to use different base images:
```bash
# Edit the pipeline
kubectl edit pipeline rpm-build-pipeline -n <namespace>

# Update image references in tasks
# From: image: $(params.target-os):latest
# To: image: your-registry.com/$(params.target-os):custom-tag
```

## 🎯 Quick Commands Reference

| Task | Command |
|------|---------|
| **Install in current namespace** | `./install_k8s_resources.sh` |
| **Install in specific namespace** | `./install_k8s_resources.sh -n my-namespace` |
| **Complete cleanup** | `./install_k8s_resources.sh --cleanup` |
| **List all builds** | `kubectl get pipelineruns -l app=rpm-builder -n <ns>` |
| **Check build status** | `kubectl get pipelinerun <name> -o yaml -n <ns>` |
| **Get build logs** | `kubectl logs <pipelinerun-pod> -n <ns>` |
| **Clean build artifacts** | `kubectl delete configmaps -l component=build-config -n <ns>` |
| **Find by package** | `kubectl get pipelineruns -l rpm-builder.io/package-name=<pkg> -n <ns>` |

Replace `<ns>` with your target namespace and `<name>`, `<pkg>`, etc. with actual values.
