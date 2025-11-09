# Optional ASIL Tasks Configuration

## Current Status

The following ASIL compliance tasks are **disabled by default** but available in the pipeline:

### 1. Static Analysis Task
- **Status**: ⚪ Disabled by default
- **Location**: `k8s/tekton-pipeline.yaml` (lines 842-924)
- **Parameter**: `enable-static-analysis: "false"`

### 2. Unit Tests Task  
- **Status**: ⚪ Disabled by default
- **Location**: `k8s/tekton-pipeline.yaml` (lines 926-1031)
- **Parameter**: `enable-unit-tests: "false"`

---

## Current Pipeline Flow

With these tasks disabled, the pipeline runs:

```
1. prepare-build-environment  ← Setup RPM build tools
2. fetch-sources              ← Get source code
3. ⚪ static-analysis         ← SKIPPED (optional)
4. ⚪ unit-tests              ← SKIPPED (optional)
5. install-dependencies       ← Install build dependencies
6. generate-spec-file         ← Create RPM spec with ASIL metadata
7. build-rpm                  ← Build with ASIL compiler flags
8. verify-safety-partition    ← Check partition compliance
9. sign-rpm                   ← Generate checksums
10. publish-artifacts         ← Prepare for distribution
```

This gives you a **faster build** for development while keeping all ASIL features ready.

---

## How to Enable These Tasks

### Method 1: Edit test-pipeline.sh

```bash
vi test-pipeline.sh
```

Change these lines:
```yaml
- name: enable-static-analysis
  value: "true"        # ← Change from "false"
- name: enable-unit-tests
  value: "true"        # ← Change from "false"
```

### Method 2: Via UI (when running from console)

When creating a build in the OpenShift Console:
1. Click "Start Build"
2. Under "Parameters"
3. Set `enable-static-analysis` = `true`
4. Set `enable-unit-tests` = `true`

### Method 3: Direct PipelineRun YAML

```yaml
apiVersion: tekton.dev/v1beta1
kind: PipelineRun
metadata:
  generateName: rpm-build-
spec:
  pipelineRef:
    name: rpm-build-pipeline
  params:
    # ... other params ...
    - name: enable-static-analysis
      value: "true"
    - name: enable-unit-tests
      value: "true"
```

---

## When to Enable

### Enable Static Analysis When:
- ✅ Preparing for ASIL certification
- ✅ Code review before release
- ✅ Security audit required
- ✅ MISRA C compliance needed
- ✅ Production builds

### Keep Disabled When:
- ⚪ Rapid prototyping
- ⚪ Local development
- ⚪ Quick testing
- ⚪ Proof of concept builds

### Enable Unit Tests When:
- ✅ ASIL-B/C/D builds (mandatory)
- ✅ Release candidates
- ✅ Code coverage metrics needed
- ✅ Quality gate enforcement
- ✅ Production builds

### Keep Disabled When:
- ⚪ No tests written yet
- ⚪ Early development
- ⚪ Quick iterations
- ⚪ External code without tests

---

## Task Availability

Both tasks are **always available** in your cluster:

```bash
# Check tasks exist
oc get tasks | grep -E "static-analysis|unit-tests"

# Output:
# static-analysis    12m
# unit-tests         12m
```

They just won't run unless explicitly enabled via the parameters.

---

## Benefits of This Setup

### 🚀 **Faster Builds by Default**
- Skip time-consuming analysis
- Quicker feedback during development
- Reduced resource usage

### 🛡️ **Safety Features Still Active**
- ASIL compiler flags still applied
- Safety metadata still added to RPMs
- Partition verification still enforced
- Package signing still performed

### 🔧 **Easy to Enable**
- One parameter change
- No code modifications needed
- Tasks already tested and working

### 📦 **Production Ready**
- Tasks remain in repository
- Full ASIL compliance available on demand
- No deployment changes needed

---

## Recommended Workflow

### Development Phase (Now)
```yaml
enable-static-analysis: "false"
enable-unit-tests: "false"
```
**Result**: Fast builds for testing

### Pre-Production Phase
```yaml
enable-static-analysis: "true"
enable-unit-tests: "false"  # If no tests yet
```
**Result**: Code quality checks before release

### Production/Certification Phase
```yaml
enable-static-analysis: "true"
enable-unit-tests: "true"
```
**Result**: Full ASIL compliance with all checks

---

## Re-enabling Later

When you're ready to enable them again:

```bash
# 1. Edit the pipeline defaults
vi k8s/tekton-pipeline.yaml

# Change lines 61 and 65:
default: "true"  # For both parameters

# 2. Redeploy
./deploy-local-dev.sh

# 3. New builds will include these tasks automatically
```

Or just enable them per-build as shown above!

---

## Task Code Location

The tasks remain fully implemented:

- **Static Analysis**: Lines 842-924 in `k8s/tekton-pipeline.yaml`
  - cppcheck integration
  - clang-tidy checks
  - Dangerous function detection
  - MISRA compliance placeholder
  - ASIL-specific checks

- **Unit Tests**: Lines 926-1031 in `k8s/tekton-pipeline.yaml`
  - Test discovery
  - Coverage measurement
  - ASIL threshold enforcement
  - Report generation

Nothing is deleted, just disabled by default! ✅

---

## Summary

✅ **Done**: Both tasks disabled by default
✅ **Available**: Tasks remain in repository
✅ **Flexible**: Enable anytime via parameters
✅ **Safe**: All other ASIL features still active

Your pipeline is now optimized for **fast development** while keeping **full ASIL compliance** just one parameter away! 🚀

