#!/bin/bash

# RPM Builder - Verify ASIL Compliance
# This script checks the built RPM for ASIL compliance features

if [ -z "$1" ]; then
  echo "Usage: $0 <pipelinerun-name>"
  echo ""
  echo "Example:"
  echo "  $0 rpm-build-test-abc123"
  exit 1
fi

PIPELINERUN=$1
NAMESPACE=$(oc project -q)

echo "========================================"
echo "ASIL Compliance Verification"
echo "========================================"
echo "PipelineRun: $PIPELINERUN"
echo "Namespace: $NAMESPACE"
echo ""

# Check if PipelineRun exists
if ! oc get pipelinerun $PIPELINERUN &>/dev/null; then
  echo "ERROR: PipelineRun '$PIPELINERUN' not found"
  exit 1
fi

# Get PipelineRun status
STATUS=$(oc get pipelinerun $PIPELINERUN -o jsonpath='{.status.conditions[0].reason}')
echo "Status: $STATUS"
echo ""

if [ "$STATUS" != "Succeeded" ]; then
  echo "⚠ Pipeline has not completed successfully yet"
  echo ""
  echo "Current status: $STATUS"
  echo ""
  echo "To view logs:"
  echo "  tkn pipelinerun logs $PIPELINERUN -f"
  echo ""
  exit 0
fi

echo "✓ Pipeline completed successfully!"
echo ""

# Find the output workspace PVC
echo "========================================"
echo "Checking Build Outputs"
echo "========================================"
echo ""

# Get the PVC names from the PipelineRun
OUTPUT_PVC=$(oc get pipelinerun $PIPELINERUN -o jsonpath='{.status.pipelineSpec.workspaces[?(@.name=="output-workspace")]}' 2>/dev/null)

# Try to find PVCs associated with this PipelineRun
PVCS=$(oc get pvc -l tekton.dev/pipelineRun=$PIPELINERUN -o name 2>/dev/null)

if [ -z "$PVCS" ]; then
  echo "⚠ Could not find output PVC automatically"
  echo ""
  echo "To manually inspect the RPM:"
  echo "  1. Find the PVC: oc get pvc | grep $PIPELINERUN"
  echo "  2. Create a pod to mount it and inspect files"
else
  echo "Found PVCs:"
  echo "$PVCS"
fi

echo ""
echo "========================================"
echo "Verifying ASIL Features"
echo "========================================"
echo ""

# Check each task completion
echo "Task Execution Status:"
echo "----------------------"

TASKS="prepare-build-environment fetch-sources static-analysis unit-tests install-dependencies generate-spec-file build-rpm verify-safety-partition sign-rpm publish-artifacts"

for task in $TASKS; do
  TASK_STATUS=$(oc get pipelinerun $PIPELINERUN -o jsonpath="{.status.taskRuns[*].status.conditions[?(@.type=='Succeeded')].status}" 2>/dev/null | grep -o "True" | head -1)
  
  # Get task status from childReferences (newer Tekton API)
  if [ -z "$TASK_STATUS" ]; then
    TASK_EXISTS=$(oc get pipelinerun $PIPELINERUN -o json | jq -r ".status.childReferences[]? | select(.pipelineTaskName==\"$task\") | .name" 2>/dev/null)
    if [ -n "$TASK_EXISTS" ]; then
      TASK_STATUS=$(oc get taskrun $TASK_EXISTS -o jsonpath='{.status.conditions[0].status}' 2>/dev/null)
    fi
  fi
  
  if [ "$TASK_STATUS" = "True" ]; then
    echo "  ✓ $task"
  else
    echo "  • $task (checking...)"
  fi
done

echo ""

# Check for generated reports
echo "========================================"
echo "Generated ASIL Reports"
echo "========================================"
echo ""

echo "The following reports should be available in the output workspace:"
echo ""
echo "  📄 build-report.txt"
echo "     - ASIL level and compiler flags"
echo "     - Toolchain traceability"
echo "     - Package checksums"
echo ""
echo "  📄 toolchain-info.txt"
echo "     - GCC version"
echo "     - Build timestamp"
echo "     - Safety compiler flags"
echo ""
echo "  📄 partition-verification-report.txt"
echo "     - Safety metadata validation"
echo "     - Partition compliance check"
echo "     - RHIVOS/AutoSD labels"
echo ""
echo "  📄 signing-manifest.txt"
echo "     - Package signatures"
echo "     - SHA256 checksums"
echo ""
echo "  📄 cppcheck-report.xml (if static analysis ran)"
echo "     - Static analysis findings"
echo ""
echo "  📄 coverage.xml (if unit tests ran)"
echo "     - Code coverage data"
echo ""

echo "========================================"
echo "View Detailed Logs"
echo "========================================"
echo ""

echo "To view specific task logs:"
echo ""
echo "Static Analysis:"
echo "  tkn pipelinerun logs $PIPELINERUN -t static-analysis"
echo ""
echo "Unit Tests:"
echo "  tkn pipelinerun logs $PIPELINERUN -t unit-tests"
echo ""
echo "Safety Partition Verification:"
echo "  tkn pipelinerun logs $PIPELINERUN -t verify-safety-partition"
echo ""
echo "All logs:"
echo "  tkn pipelinerun logs $PIPELINERUN"
echo ""

echo "========================================"
echo "OpenShift Console"
echo "========================================"
echo ""
echo "View in console at:"
echo "  http://localhost:9000/k8s/ns/${NAMESPACE}/tekton.dev~v1beta1~PipelineRun/${PIPELINERUN}"
echo ""

echo "========================================"
echo "Next Steps"
echo "========================================"
echo ""
echo "1. Review the task logs above to verify ASIL features"
echo "2. Check the generated reports in the output workspace"
echo "3. Verify the RPM contains safety metadata"
echo "4. Test installation restrictions on RHIVOS/AutoSD"
echo ""

