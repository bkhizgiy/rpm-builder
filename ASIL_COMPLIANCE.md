# ASIL Compliance and Automotive Safety Features

## Overview

This RPM Builder pipeline has been enhanced with comprehensive ASIL (Automotive Safety Integrity Level) compliance features specifically designed for automotive operating systems like RHIVOS and AutoSD.

## Enhanced Pipeline Architecture

### Pipeline Flow

```
1. prepare-build-environment
2. fetch-sources
3. ⭐ static-analysis (NEW) - MISRA/safety checks
4. ⭐ unit-tests (NEW) - Code coverage verification
5. install-dependencies
6. ⭐ generate-spec-file (ENHANCED) - Automotive metadata
7. ⭐ build-rpm (ENHANCED) - ASIL compiler flags
8. ⭐ verify-safety-partition (NEW) - RHIVOS/AutoSD compliance
9. ⭐ sign-rpm (NEW) - Package integrity
10. publish-artifacts
```

## New Safety Features

### 1. Static Analysis Task (`static-analysis`)

**Purpose**: Detect code quality issues and potential safety violations

**Features**:
- **cppcheck** for general static analysis
- **clang-tidy** for advanced code checking
- MISRA C compliance placeholder (integration point for commercial tools)
- Detection of dangerous functions (`gets`, `strcpy`, `sprintf`, `vsprintf`)
- Dynamic memory allocation warnings for ASIL-C/D code
- Generates XML reports for integration with CI/CD

**ASIL Impact**:
- Catches common automotive safety violations
- Prepares codebase for MISRA compliance certification

---

### 2. Unit Testing Task (`unit-tests`)

**Purpose**: Verify code coverage meets ASIL requirements

**Coverage Thresholds by ASIL Level**:
- **ASIL-D**: 100% coverage required
- **ASIL-C**: 95% coverage required
- **ASIL-B**: 90% coverage required
- **ASIL-A**: 80% coverage required
- **Uncertified**: 70% coverage required

**Features**:
- Automatic test discovery (Makefile targets, test directories)
- gcov/lcov integration for coverage analysis
- Coverage report generation (XML format)
- Pass/fail based on ASIL level requirements

---

### 3. Enhanced Spec File Generation

**Automotive Safety Metadata Added to RPM**:

```rpm
# Safety Identifiers
X-Safety-Level: uncertified|ASIL-A|ASIL-B|ASIL-C|ASIL-D
X-Safety-Partition: safety|non-safety
X-Target-OS: rhivos|autosd|...

# Domain Restrictions (for uncertified packages)
X-Allowed-Domains: application,user,development
X-Prohibited-Domains: safety-critical,iso26262,asil

# RHIVOS-specific
X-RHIVOS-Partition: partition-non-safety
X-RHIVOS-Zone: zone-user

# AutoSD-specific
X-AutoSD-Zone: zone-non-safety
X-AutoSD-Container: podman-non-safety
```

**Pre-install Safety Guard**:
```bash
%pre
# Prevents installation in wrong partition
if [ -f /etc/automotive/safety-mode ]; then
  CURRENT_MODE=$(cat /etc/automotive/safety-mode)
  if [ "$SAFETY_PARTITION" = "non-safety" ] && [ "$CURRENT_MODE" = "safety-critical" ]; then
    echo "ERROR: Cannot install non-safety package in safety-critical partition"
    exit 1
  fi
fi
```

**Post-install SELinux Labeling** (RHIVOS/AutoSD):
```bash
%post
# Apply SELinux context for non-safety partition
semanage fcontext -a -t automotive_non_safety_t "/usr/bin/my-package"
restorecon -v /usr/bin/my-package
```

---

### 4. ASIL Compiler Flags

**Safety Compilation Flags Applied**:

**Base Safety Flags** (all levels):
```bash
-fstack-protector-strong    # Stack overflow protection
-D_FORTIFY_SOURCE=2         # Buffer overflow protection
-Werror                     # Treat warnings as errors
-Wall -Wextra -Wpedantic    # All warnings enabled
-fno-strict-aliasing        # Prevent unsafe pointer optimization
-fwrapv                     # Defined integer overflow behavior
```

**ASIL-A/B Additional Flags**:
```bash
-O2                         # Optimize for safety
-g                          # Debug symbols
-fno-omit-frame-pointer     # Stack trace support
```

**ASIL-C/D Additional Flags**:
```bash
-O2 -g3                     # Extended debug info
-fno-omit-frame-pointer
-fno-delete-null-pointer-checks
-fno-strict-overflow
-Wformat -Wformat-security
```

**Toolchain Traceability**:
- GCC version logged
- Compiler flags recorded
- Build timestamp (ISO 8601 UTC)
- ASIL level documented

---

### 5. Safety Partition Verification (`verify-safety-partition`)

**Purpose**: Ensure uncertified RPMs cannot contaminate safety-critical partitions

**Checks Performed**:
1. ✅ Verify `X-Safety-Level` metadata present
2. ✅ Verify `X-Safety-Partition` metadata present
3. ✅ Check RHIVOS-specific partition labels
4. ✅ Check AutoSD-specific zone labels
5. ✅ Verify prohibited domains include `safety-critical`
6. ✅ Verify pre-install guard scripts present
7. ✅ Extract and validate RPM metadata

**Reports Generated**:
- `partition-verification-report.txt`
- Detailed metadata extraction
- Installation guard script validation

**Critical Safety Check**:
```bash
if [[ "$PROHIBITED_DOMAINS" =~ "safety-critical" ]]; then
  echo "✓ Package correctly prohibited from safety-critical partitions"
else
  echo "⚠ WARNING: Package may not be properly restricted from safety partitions"
fi
```

---

### 6. RPM Signing (`sign-rpm`)

**Purpose**: Ensure package authenticity and integrity

**Current Implementation**:
- SHA256 checksum generation
- Signing manifest creation
- Placeholder for GPG signing

**Production Requirements** (documented in task):
1. Load GPG private key from Hardware Security Module (HSM)
2. Sign all RPMs: `rpm --addsign *.rpm`
3. Verify signatures: `rpm --checksig *.rpm`
4. Record signing events in audit log
5. Integrate with Certificate Authority

**Outputs**:
- `SHA256SUMS` - Package checksums
- `signing-manifest.txt` - Signing audit trail

---

## Safety Partition Architecture

### RHIVOS Partitioning

```
┌─────────────────────────────────────────┐
│          RHIVOS System                  │
├─────────────────────────────────────────┤
│  Safety-Critical Partition              │
│  - Certified RPMs only                  │
│  - ISO 26262 compliance                 │
│  - SELinux: automotive_safety_t         │
├─────────────────────────────────────────┤
│  Non-Safety Partition ← BUILDER OUTPUT  │
│  - Uncertified RPMs allowed             │
│  - User applications                    │
│  - SELinux: automotive_non_safety_t     │
└─────────────────────────────────────────┘
```

### AutoSD Zoning

```
┌─────────────────────────────────────────┐
│          AutoSD System                  │
├─────────────────────────────────────────┤
│  Zone-Safety (ostree deployment 1)      │
│  - Safety workloads only                │
├─────────────────────────────────────────┤
│  Zone-User ← BUILDER OUTPUT             │
│  - User workloads                       │
│  - Podman containers (non-safety)       │
└─────────────────────────────────────────┘
```

---

## Pipeline Parameters

### New Safety Parameters

```yaml
- asil-level:
    default: "uncertified"
    values: ["uncertified", "ASIL-A", "ASIL-B", "ASIL-C", "ASIL-D"]
    
- safety-partition:
    default: "non-safety"
    values: ["safety", "non-safety"]
    
- enable-static-analysis:
    default: "true"
    description: "Enable MISRA/static analysis checks"
    
- enable-unit-tests:
    default: "true"
    description: "Enable unit testing and coverage"
```

---

## Usage Examples

### Build Uncertified Package for RHIVOS

```bash
oc create -f - <<EOF
apiVersion: tekton.dev/v1beta1
kind: PipelineRun
metadata:
  generateName: rpm-build-
spec:
  pipelineRef:
    name: rpm-build-pipeline
  params:
    - name: package-name
      value: "my-app"
    - name: package-version
      value: "1.0.0"
    - name: target-os
      value: "rhivos"
    - name: architecture
      value: "aarch64"
    - name: asil-level
      value: "uncertified"
    - name: safety-partition
      value: "non-safety"
  workspaces:
    - name: source-workspace
      volumeClaimTemplate:
        spec:
          accessModes: [ReadWriteOnce]
          resources:
            requests:
              storage: 1Gi
    - name: output-workspace
      volumeClaimTemplate:
        spec:
          accessModes: [ReadWriteOnce]
          resources:
            requests:
              storage: 1Gi
EOF
```

### Build ASIL-B Package

```yaml
params:
  - name: asil-level
    value: "ASIL-B"
  - name: safety-partition
    value: "non-safety"  # Still non-safety until certified
  - name: enable-static-analysis
    value: "true"
  - name: enable-unit-tests
    value: "true"
```

---

## Compliance Verification

### Generated Reports

1. **`build-report.txt`**
   - ASIL level
   - Compiler flags used
   - Toolchain versions
   - Package checksums

2. **`toolchain-info.txt`**
   - GCC version
   - Build timestamps
   - Traceability data

3. **`partition-verification-report.txt`**
   - Safety metadata validation
   - Partition compliance check
   - Installation guard verification

4. **`signing-manifest.txt`**
   - Package signatures
   - Integrity checksums
   - Signing audit trail

5. **`cppcheck-report.xml`** (if static analysis enabled)
   - Static analysis findings
   - Code quality metrics

6. **`coverage.xml`** (if unit tests enabled)
   - Code coverage data
   - Test results

---

## Safety Guarantees

### ✅ What This Pipeline Provides

1. **Partition Isolation**
   - Uncertified RPMs marked for non-safety partitions only
   - Pre-install guards prevent installation in safety zones
   - SELinux contexts enforce runtime isolation

2. **Build Integrity**
   - ASIL-appropriate compiler flags
   - Deterministic builds with traceability
   - Toolchain version recording

3. **Code Quality**
   - Static analysis for common safety violations
   - Unit test coverage requirements
   - Dangerous function detection

4. **Package Authenticity**
   - SHA256 checksums
   - Signing framework (placeholder for GPG)
   - Audit trail generation

### ⚠️ What Still Needs Manual Integration

1. **MISRA Compliance**
   - Requires commercial tools (LDRA, Polyspace, PC-lint)
   - Integration point provided in `static-analysis` task

2. **GPG Signing**
   - Requires HSM/key management setup
   - Framework in place, needs key provisioning

3. **Functional Safety Certification**
   - ISO 26262 certification process
   - Tool qualification documentation
   - Safety case development

4. **Certified Toolchain**
   - Use certified compiler (safety-patched GCC, IAR, GreenHills)
   - Replace standard GCC in container images

---

## Next Steps for Production

1. **Integrate MISRA Checker**
   - License commercial tool
   - Add to `static-analysis` task
   - Configure for automotive rules

2. **Setup Key Management**
   - Provision HSM or Vault
   - Generate GPG signing keys
   - Configure `sign-rpm` task

3. **Implement Artifact Storage**
   - Deploy RPM repository (Pulp, Artifactory)
   - Configure `publish-artifacts` task
   - Setup access controls

4. **Certified Toolchain**
   - Obtain safety-certified compiler
   - Create certified builder images
   - Update container references

5. **Continuous Compliance**
   - Integrate with quality gates
   - Dashboard for compliance metrics
   - Automated reporting

---

## References

- **ISO 26262**: Functional Safety for Road Vehicles
- **MISRA C:2012**: C Coding Standard for Automotive
- **ASIL Levels**: A (lowest) to D (highest)
- **RHIVOS Documentation**: Red Hat In-Vehicle Operating System
- **AutoSD Documentation**: Automotive SIG Distribution

---

## Contact

For questions about ASIL compliance or safety features:
- Review the Tekton pipeline: `k8s/tekton-pipeline.yaml`
- Check task definitions for detailed implementation
- Consult your organization's functional safety team

