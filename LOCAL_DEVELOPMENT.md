# Local Development Guide

This guide explains how to develop and test the RPM Builder plugin locally while deploying only the necessary backend components to your OpenShift cluster.

## Overview

**Architecture for Local Development:**
- **UI (Frontend)**: Runs locally on your machine via webpack dev server (port 9001)
- **OpenShift Console**: Runs locally in a container (port 9000)
- **Backend (Tekton Pipelines)**: Deployed to your OpenShift cluster namespace
- **Kubernetes API**: Your cluster's API server (accessed via oc/kubectl)

## Prerequisites

- OpenShift CLI (`oc`) installed and configured
- Access to an OpenShift cluster with Tekton Pipelines installed
- Node.js and npm/yarn installed
- Podman or Docker installed (for running the console bridge)
- Appropriate RBAC permissions in your namespace

## Quick Start

### 1. Connect to Your Cluster

```bash
# Login to your OpenShift cluster
oc login <your-cluster-url>

# Switch to your development namespace
oc project <your-namespace>
```

### 2. Deploy Backend Resources

Run the deployment script to deploy Tekton pipelines and RBAC to your namespace:

```bash
./deploy-local-dev.sh
```

This script will:
- Deploy the RPM build pipeline and tasks to your current namespace
- Create necessary ServiceAccounts and RBAC roles
- Add labels to all resources for easy identification and cleanup
- Label resources with your username to avoid conflicts

**Resource Isolation:**
- All resources are labeled with `rpm-builder.io/dev-mode: true`
- All resources are labeled with `rpm-builder.io/developer: <your-username>`
- Resources are deployed in your specific namespace
- This ensures you won't interfere with other developers

### 3. Start Local Development Environment

You'll need **two terminal windows**:

**Terminal 1 - Start the Plugin Dev Server:**
```bash
# Install dependencies (first time only)
npm install
# or
yarn install

# Start the webpack dev server
npm start
```

This starts the plugin development server on `http://localhost:9001`

**Terminal 2 - Start the OpenShift Console:**
```bash
./start-console.sh
```

This starts a containerized OpenShift Console on `http://localhost:9000`

### 4. Access the Console

Open your browser and navigate to:
```
http://localhost:9000
```

You should see the OpenShift Console with your RPM Builder plugin loaded. Navigate to the RPM Builder page to test your changes.

## Development Workflow

1. **Make Code Changes**: Edit files in the `src/` directory
2. **Hot Reload**: The webpack dev server will automatically reload your changes
3. **Test in Console**: Refresh your browser to see the changes
4. **Create Test Builds**: Use the UI to create RPM builds (they'll run in your cluster namespace)
5. **Monitor Builds**: Check build status in the UI or via CLI:
   ```bash
   # View pipeline runs
   oc get pipelineruns -n <your-namespace>
   
   # View logs for a specific run
   oc logs -f <pipelinerun-name> -n <your-namespace>
   ```

## Debugging

### Check Backend Resources

```bash
# Check if pipeline is deployed
oc get pipeline rpm-build-pipeline

# Check if tasks are deployed
oc get tasks

# Check service account
oc get serviceaccount rpm-builder-sa

# Check RBAC
oc get role rpm-builder-namespace-role
oc get rolebinding rpm-builder-namespace-binding
```

### View Build Logs

```bash
# List all pipeline runs
oc get pipelineruns

# Get details of a specific run
oc describe pipelinerun <pipelinerun-name>

# Get logs from a specific task
oc logs <pod-name> -c step-<task-step-name>
```

### Common Issues

**Issue: "Pipeline not found" error in UI**
- Solution: Verify pipeline is deployed: `oc get pipeline rpm-build-pipeline`

**Issue: "Insufficient permissions" error**
- Solution: Check your RBAC permissions: `oc auth can-i create pipelineruns`

**Issue: Console can't connect to plugin**
- Solution: Ensure webpack dev server is running on port 9001
- Check if you can access: `http://localhost:9001`

**Issue: Build fails immediately**
- Solution: Check Tekton operator is installed: `oc get operators | grep tekton`
- Verify your namespace has resource quotas that allow PVC creation

## Resource Management

### Monitor Resource Usage

```bash
# Check PVCs created by builds
oc get pvc -l app=rpm-builder

# Check ConfigMaps created by builds
oc get configmaps -l app=rpm-builder

# Check running pods
oc get pods -l app=rpm-builder
```

### Cleanup Old Builds

```bash
# Delete completed pipeline runs older than 1 day
oc delete pipelineruns -l rpm-builder.io/build-id --field-selector status.completionTime>1d

# Delete all PipelineRuns manually
oc delete pipelineruns -l app=rpm-builder
```

## Testing Changes

### Frontend Changes
1. Edit React components in `src/components/`
2. Changes auto-reload in the browser
3. Test UI interactions

### Backend Changes (Pipeline)
1. Edit `k8s/tekton-pipeline.yaml`
2. Re-run `./deploy-local-dev.sh` to update
3. Create a new build to test changes

### Service Changes
1. Edit `src/services/rpmBuildService.ts`
2. Restart webpack dev server (`npm start`)
3. Test API interactions

## Cleanup

When you're done with development:

```bash
./cleanup-local-dev.sh
```

This will:
- Delete all PipelineRuns in your namespace
- Remove the Tekton pipeline and tasks
- Clean up ConfigMaps and PVCs created by builds
- Remove ServiceAccount and namespace-scoped RBAC
- Optionally remove cluster-scoped RBAC (if no one else is using it)

**Note:** The script will prompt for confirmation before deleting resources.

## Environment Variables

You can customize the behavior with environment variables:

```bash
# Change the console image
export CONSOLE_IMAGE=quay.io/openshift/origin-console:latest

# Change the console port
export CONSOLE_PORT=9000

# Set custom namespace (overrides current oc project)
export RPM_BUILDER_NAMESPACE=my-dev-namespace
```

## Tips for Safe Development

1. **Use Your Own Namespace**: Always work in your personal namespace to avoid conflicts
2. **Label Your Resources**: The deployment script automatically labels resources with your username
3. **Clean Up Regularly**: Delete old PipelineRuns and PVCs to avoid consuming quota
4. **Monitor Resource Usage**: Keep an eye on your namespace's resource consumption
5. **Test Incrementally**: Test small changes before making large modifications
6. **Use Git Branches**: Create feature branches for experimental changes

## Next Steps

- Read [USAGE.md](USAGE.md) for information on using the RPM Builder UI
- Read [TEST_GUIDE.md](TEST_GUIDE.md) for information on running tests
- Check the [README.md](README.md) for overall project documentation

## Troubleshooting

If you encounter issues:

1. Check the console logs in your browser's developer tools
2. Check the webpack dev server logs in Terminal 1
3. Check the console bridge logs in Terminal 2
4. Check Kubernetes resources: `oc get all -l app=rpm-builder`
5. View PipelineRun logs: `oc logs -f <pipelinerun-pod>`

For more help, check the project's issue tracker or contact the maintainers.

