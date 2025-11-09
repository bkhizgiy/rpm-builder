#!/bin/bash

# Script to download RPM artifacts from a completed build
# Usage: ./download-artifacts.sh <pipelinerun-name> [output-directory]

set -e

PIPELINERUN=$1
OUTPUT_DIR=${2:-./artifacts}

if [ -z "$PIPELINERUN" ]; then
  echo "Usage: $0 <pipelinerun-name> [output-directory]"
  echo ""
  echo "Example:"
  echo "  $0 rpm-build-test-abc123 ./my-rpms"
  echo ""
  echo "To list available pipeline runs:"
  echo "  oc get pipelinerun -l app=rpm-builder"
  exit 1
fi

echo "========================================="
echo "RPM Artifact Downloader"
echo "========================================="
echo ""
echo "PipelineRun: $PIPELINERUN"
echo "Output Directory: $OUTPUT_DIR"
echo ""

# Check if PipelineRun exists
if ! oc get pipelinerun "$PIPELINERUN" >/dev/null 2>&1; then
  echo "ERROR: PipelineRun '$PIPELINERUN' not found"
  exit 1
fi

# Get PipelineRun status
STATUS=$(oc get pipelinerun "$PIPELINERUN" -o jsonpath='{.status.conditions[0].reason}')
echo "Build Status: $STATUS"

if [ "$STATUS" != "Succeeded" ]; then
  echo "WARNING: Build has not succeeded yet (status: $STATUS)"
  read -p "Continue anyway? [y/N] " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

# Find the pod that ran the build-rpm task
echo ""
echo "Finding build artifacts..."

TASKRUN=$(oc get taskrun -l tekton.dev/pipelineRun="$PIPELINERUN",tekton.dev/pipelineTask=build-rpm -o jsonpath='{.items[0].metadata.name}')

if [ -z "$TASKRUN" ]; then
  echo "ERROR: Could not find build-rpm TaskRun for PipelineRun '$PIPELINERUN'"
  exit 1
fi

echo "TaskRun: $TASKRUN"

POD=$(oc get taskrun "$TASKRUN" -o jsonpath='{.status.podName}')

if [ -z "$POD" ]; then
  echo "ERROR: Could not find pod for TaskRun '$TASKRUN'"
  exit 1
fi

echo "Pod: $POD"

# Get the workspace PVC name
PVC=$(oc get pipelinerun "$PIPELINERUN" -o jsonpath='{.status.pipelineSpec.workspaces[0].name}')
echo "Workspace PVC: $PVC"

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Create a temporary pod to access the PVC and copy artifacts
echo ""
echo "Creating temporary pod to extract artifacts..."

TEMP_POD="artifact-extractor-$$"

cat <<EOF | oc apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: $TEMP_POD
  labels:
    app: rpm-builder
    component: artifact-extractor
spec:
  restartPolicy: Never
  containers:
    - name: extractor
      image: registry.access.redhat.com/ubi8/ubi-minimal:latest
      command: ['sh', '-c', 'sleep 3600']
      volumeMounts:
        - name: workspace
          mountPath: /workspace
  volumes:
    - name: workspace
      persistentVolumeClaim:
        claimName: $PVC
EOF

# Wait for pod to be ready
echo "Waiting for extraction pod to be ready..."
oc wait --for=condition=Ready pod/$TEMP_POD --timeout=60s

# List available RPMs
echo ""
echo "Available RPM files:"
oc exec $TEMP_POD -- find /workspace -name "*.rpm" -type f 2>/dev/null || echo "No RPM files found"

# Copy RPMs to local directory
echo ""
echo "Downloading RPM artifacts to $OUTPUT_DIR..."
oc exec $TEMP_POD -- tar czf - -C /workspace rpms 2>/dev/null | tar xzf - -C "$OUTPUT_DIR" 2>/dev/null || {
  echo "WARNING: Could not extract rpms directory, trying alternative paths..."
  oc exec $TEMP_POD -- find /workspace -name "*.rpm" -type f -exec basename {} \; 2>/dev/null | while read rpm; do
    echo "  Downloading: $rpm"
    oc exec $TEMP_POD -- cat /workspace/rpms/"$rpm" > "$OUTPUT_DIR/$rpm" 2>/dev/null || true
  done
}

# Copy build reports
echo ""
echo "Downloading build reports..."
oc exec $TEMP_POD -- cat /workspace/build-report.txt > "$OUTPUT_DIR/build-report.txt" 2>/dev/null || echo "No build report found"
oc exec $TEMP_POD -- cat /workspace/toolchain-info.txt > "$OUTPUT_DIR/toolchain-info.txt" 2>/dev/null || echo "No toolchain info found"
oc exec $TEMP_POD -- cat /workspace/partition-verification-report.txt > "$OUTPUT_DIR/partition-verification-report.txt" 2>/dev/null || echo "No partition verification report found"

# Cleanup temporary pod
echo ""
echo "Cleaning up..."
oc delete pod $TEMP_POD --wait=false

echo ""
echo "========================================="
echo "✓ Artifacts downloaded successfully!"
echo "========================================="
echo ""
echo "Location: $OUTPUT_DIR"
echo ""
ls -lh "$OUTPUT_DIR"
echo ""
echo "RPM files:"
find "$OUTPUT_DIR" -name "*.rpm" -exec basename {} \;

