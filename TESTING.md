# Testing the ASIL RPM Builder Pipeline

## Quick Start

### 1. Deploy the Pipeline
```bash
./deploy-local-dev.sh
```

### 2. Run Test Build
```bash
./test-pipeline.sh
```

This will:
- Create a simple "hello-asil" test package
- Upload source files (hello.c, Makefile)
- Trigger the complete ASIL pipeline
- Show you how to monitor the build

### 3. Verify Results
```bash
./verify-compliance.sh <pipelinerun-name>
```

---

## Detailed Testing Steps

### Step 1: Verify Pipeline Deployment

```bash
# Check pipeline exists
oc get pipeline rpm-build-pipeline

# Check all tasks exist
oc get tasks | grep rpm-builder

# Should see:
#   prepare-build-env
#   fetch-sources
#   static-analysis ← NEW
#   unit-tests ← NEW
#   install-dependencies
#   generate-spec-file
#   build-rpm-package
#   verify-safety-partition ← NEW
#   sign-rpm ← NEW
#   publish-rpm-artifacts
```

### Step 2: Run the Test Pipeline

```bash
cd /home/bkhizgiy/dev/rpm-builder
./test-pipeline.sh
```

**What the test does:**
1. Creates a simple C program (`hello.c`)
2. Creates a Makefile with test target
3. Uploads files to ConfigMap
4. Creates a PipelineRun with ASIL parameters:
   - `asil-level`: uncertified
   - `safety-partition`: non-safety
   - `enable-static-analysis`: true
   - `enable-unit-tests`: true

### Step 3: Monitor Execution

#### Option A: Watch in Terminal
```bash
# Get PipelineRun name from test-pipeline.sh output
PIPELINERUN="rpm-build-test-xxxxx"

# Watch status
oc get pipelinerun $PIPELINERUN -w

# Stream all logs
tkn pipelinerun logs $PIPELINERUN -f
```

#### Option B: OpenShift Console
1. Start the console: `./start-console.sh`
2. Open: http://localhost:9000
3. Navigate to: **Pipelines → PipelineRuns**
4. Click on your test run
5. View the pipeline graph and logs

### Step 4: Check Individual Tasks

```bash
# Static Analysis logs
tkn pipelinerun logs $PIPELINERUN -t static-analysis

# Unit Tests logs
tkn pipelinerun logs $PIPELINERUN -t unit-tests

# Safety Partition Verification logs
tkn pipelinerun logs $PIPELINERUN -t verify-safety-partition

# RPM Signing logs
tkn pipelinerun logs $PIPELINERUN -t sign-rpm
```

### Step 5: Verify ASIL Features

Run the verification script:
```bash
./verify-compliance.sh $PIPELINERUN
```

This checks:
- ✅ All tasks completed successfully
- ✅ ASIL reports were generated
- ✅ Safety metadata is present
- ✅ Partition restrictions are enforced

---

## What to Look For

### 1. Static Analysis Task

**Expected Output:**
```
Running static analysis for hello-asil
ASIL Level: uncertified

Running cppcheck...
Checking for common safety violations...
Static analysis completed
```

**What it checks:**
- Dangerous functions (gets, strcpy, sprintf, vsprintf)
- Dynamic memory allocation (for ASIL-C/D)
- Code quality with cppcheck
- MISRA compliance placeholder

### 2. Unit Tests Task

**Expected Output:**
```
Running unit tests for hello-asil
ASIL Level: uncertified
Required code coverage for uncertified: 70%

Running make test...
Tests passed!
```

**What it checks:**
- Runs Makefile test target
- Measures code coverage
- Validates against ASIL threshold

### 3. Spec File Generation

**Look for in logs:**
```
Generating default spec file with automotive safety metadata

# Automotive Safety Metadata
X-Safety-Level: uncertified
X-Safety-Partition: non-safety
X-Prohibited-Domains: safety-critical,iso26262,asil

# Pre-install safety check
if [ -f /etc/automotive/safety-mode ]; then
  ...prevent installation in safety partition...
fi
```

### 4. Build with ASIL Flags

**Look for:**
```
Building ASIL RPM package: hello-asil
ASIL Level: uncertified
Applying ASIL safety compiler flags:
  -fstack-protector-strong
  -D_FORTIFY_SOURCE=2
  -Werror -Wall -Wextra
```

**Toolchain Traceability:**
```
ASIL Build Toolchain Information
GCC Version: gcc (GCC) 8.5.0
Build Date: 2025-11-09T10:30:00Z
ASIL Level: uncertified
```

### 5. Safety Partition Verification

**Look for:**
```
Verifying safety partition compliance
Package: hello-asil
ASIL Level: uncertified
Safety Partition: non-safety

✓ Safety Level: uncertified
✓ Safety Partition: non-safety
✓ Prohibited Domains: safety-critical,iso26262,asil
✓ Package correctly prohibited from safety-critical partitions
```

### 6. Package Signing

**Look for:**
```
Signing RPM packages for hello-asil-1.0.0

Generating integrity checksums...
Package checksums:
  <sha256sum> hello-asil-1.0.0-1.x86_64.rpm

✓ Package integrity verification completed
```

---

## Testing Different ASIL Levels

### Test ASIL-B Package

```bash
# Modify test-pipeline.sh or create custom PipelineRun:
asil-level: "ASIL-B"
```

**Expected differences:**
- More strict compiler flags: `-O2 -g -fno-omit-frame-pointer`
- Code coverage requirement: 90%
- Enhanced static analysis warnings

### Test ASIL-D Package

```bash
asil-level: "ASIL-D"
```

**Expected differences:**
- Strictest compiler flags: `-g3 -fno-delete-null-pointer-checks`
- Code coverage requirement: 100%
- Warnings about dynamic memory allocation
- All warnings treated as errors

---

## Testing Git Source

Modify the PipelineRun to use Git instead of upload:

```yaml
params:
  - name: source-type
    value: "git"
  - name: git-repository
    value: "https://github.com/your-org/your-rpm-source.git"
  - name: git-branch
    value: "main"
```

---

## Troubleshooting

### Pipeline Fails at Static Analysis

**Possible causes:**
- Source code has dangerous functions
- Code doesn't compile
- Missing static analysis tools in container

**Check logs:**
```bash
tkn pipelinerun logs $PIPELINERUN -t static-analysis
```

### Pipeline Fails at Unit Tests

**Possible causes:**
- No test target in Makefile
- Tests fail
- Code coverage below threshold

**Check logs:**
```bash
tkn pipelinerun logs $PIPELINERUN -t unit-tests
```

### Pipeline Fails at Build

**Possible causes:**
- ASIL compiler flags too strict (-Werror)
- Source code has warnings
- Missing dependencies

**Check logs:**
```bash
tkn pipelinerun logs $PIPELINERUN -t build-rpm
```

### Skip Optional Tasks

To skip static analysis or tests during development:

```yaml
params:
  - name: enable-static-analysis
    value: "false"
  - name: enable-unit-tests
    value: "false"
```

---

## Accessing Build Artifacts

### Method 1: Via OpenShift Console

1. Go to: **Storage → PersistentVolumeClaims**
2. Find PVC for your PipelineRun
3. Create a debug pod to access files

### Method 2: Via CLI

```bash
# Find the output PVC
oc get pvc -l tekton.dev/pipelineRun=$PIPELINERUN

# Create a pod to mount it
cat <<EOF | oc apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: rpm-inspector
spec:
  containers:
  - name: inspector
    image: registry.access.redhat.com/ubi8/ubi
    command: ["sleep", "3600"]
    volumeMounts:
    - name: output
      mountPath: /output
  volumes:
  - name: output
    persistentVolumeClaim:
      claimName: <pvc-name>
EOF

# Access files
oc exec -it rpm-inspector -- ls -la /output/rpms/
oc exec -it rpm-inspector -- cat /output/build-report.txt
oc exec -it rpm-inspector -- cat /output/partition-verification-report.txt
```

### Method 3: Download RPM

```bash
# Copy RPM from pod
oc cp rpm-inspector:/output/rpms/hello-asil-1.0.0-1.x86_64.rpm ./hello-asil.rpm

# Inspect locally
rpm -qip hello-asil.rpm
rpm -qp --scripts hello-asil.rpm
```

---

## Verifying Safety Metadata

### Check RPM Metadata

```bash
# Inside the inspector pod
rpm -qp --info /output/rpms/hello-asil-1.0.0-1.x86_64.rpm

# Look for:
#   Group: Applications/Automotive
#   X-Safety-Level: uncertified
#   X-Safety-Partition: non-safety
```

### Check Pre-install Scripts

```bash
rpm -qp --scripts /output/rpms/hello-asil-1.0.0-1.x86_64.rpm

# Should see safety partition verification
```

### Check Post-install Scripts

```bash
# Should see SELinux labeling for automotive OS
```

---

## Clean Up

### Remove Test Resources

```bash
# Delete specific PipelineRun
oc delete pipelinerun $PIPELINERUN

# Delete test ConfigMaps
oc delete configmap -l rpm-builder.io/test=true

# Remove all RPM Builder resources
./cleanup-local-dev.sh
```

---

## Next Steps

1. ✅ Test with your actual source code
2. ✅ Integrate MISRA checker (commercial tool)
3. ✅ Setup GPG signing with proper keys
4. ✅ Configure artifact storage
5. ✅ Test on RHIVOS/AutoSD systems
6. ✅ Validate partition restrictions

---

## Need Help?

- Pipeline not starting: Check RBAC with `oc get sa,role,rolebinding`
- Tasks failing: Check logs with `tkn pipelinerun logs`
- PVC issues: Check storage class and PVC status
- Toolchain errors: Verify base image has required tools

For detailed documentation, see:
- `ASIL_COMPLIANCE.md` - ASIL features
- `LOCAL_DEVELOPMENT.md` - Local dev guide
- `README.md` - Project overview

