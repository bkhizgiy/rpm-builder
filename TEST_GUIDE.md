# RPM Builder Plugin - Testing Guide

## 🚀 Quick Start Testing

### Phase 1: Local Development Testing

#### 1. Install Dependencies
```bash
cd /home/bkhizgiy/dev/rpm-builder
npm install
```

#### 2. Start Development Server
```bash
# Terminal 1: Start the plugin development server
npm run start

# Terminal 2: Start the OpenShift Console bridge
./start-console.sh
```

#### 3. Access Local Console
- Open browser: `http://localhost:9000`
- Navigate to: **Builds → RPM Builder**
- You should see the RPM Builder interface

### Phase 2: Install Backend Pipeline

#### 1. Install Kubernetes Resources
```bash
# Make sure you're in the right namespace
oc project my-test-namespace  # or your preferred namespace

# Install the pipeline and RBAC
./install_k8s_resources.sh
```

#### 2. Verify Installation
```bash
# Check if pipeline is installed
kubectl get pipelines -n $(oc project -q)
kubectl get tasks -n $(oc project -q) 

# Verify RBAC
kubectl get serviceaccount rpm-builder-sa -n $(oc project -q)
kubectl get clusterrole rpm-builder-role
```

### Phase 3: Production Deployment

#### 1. Build the Plugin
```bash
npm run build
```

#### 2. Create Container Image
```bash
# Build Docker image
docker build -t your-registry.com/rpm-builder-plugin:latest .

# Push to registry
docker push your-registry.com/rpm-builder-plugin:latest
```

#### 3. Deploy via Helm
```bash
helm install rpm-builder-plugin ./charts/openshift-console-plugin \
  --set plugin.image=your-registry.com/rpm-builder-plugin:latest \
  --namespace $(oc project -q)
```

#### 4. Enable Plugin in Console
```bash
oc patch consoles.operator.openshift.io cluster \
  --patch '{"spec":{"plugins":["rpm-builder-plugin"]}}' \
  --type=merge
```

## 🧪 Testing Scenarios

### Test 1: File Upload Build

1. **Navigate to RPM Builder**:
   - Builds → RPM Builder → Build Configuration

2. **Configure Package**:
   - Name: `test-package`
   - Version: `1.0.0`
   - Description: `Test RPM package`

3. **Upload Files**:
   - Create a simple test file:
     ```bash
     echo '#!/bin/bash\necho "Hello from test package"' > test-script.sh
     ```
   - Upload via the file upload interface

4. **Set Target**:
   - OS: `fedora-39`
   - Architecture: `x86_64`

5. **Start Build** and monitor progress

### Test 2: Git Repository Build

1. **Use Public Repository**:
   - Repository: `https://github.com/rpm-software-management/rpm.git`
   - Branch: `master`

2. **Add Dependencies**:
   - `gcc`
   - `make`
   - `autoconf`

3. **Custom Spec File** (optional):
   ```spec
   Name: test-rpm
   Version: 1.0.0
   Release: 1%{?dist}
   Summary: Test RPM from Git
   
   %description
   Test RPM package built from Git repository
   
   %prep
   %setup -q
   
   %build
   make
   
   %install
   make install DESTDIR=%{buildroot}
   
   %files
   %{_bindir}/*
   
   %changelog
   * Wed Nov 06 2024 Test User <test@example.com> - 1.0.0-1
   - Initial package
   ```

### Test 3: Multi-OS Testing

Test the same package on different operating systems:
- Fedora 39
- RHEL 8
- CentOS Stream 9
- Ubuntu 22.04

## 🔍 Monitoring and Debugging

### View Build Status
```bash
# List all builds
kubectl get pipelineruns -l app=rpm-builder -n $(oc project -q)

# Watch build progress
kubectl get pipelineruns -l app=rpm-builder -w -n $(oc project -q)

# Get detailed status
kubectl describe pipelinerun <build-name> -n $(oc project -q)
```

### Check Build Logs
```bash
# Get logs from specific pipeline run
kubectl logs -f <pipelinerun-pod-name> -n $(oc project -q)

# Or use tkn CLI if available
tkn pipelinerun logs <pipelinerun-name> -f -n $(oc project -q)
```

### Debug ConfigMaps
```bash
# List build configurations
kubectl get configmaps -l component=build-config -n $(oc project -q)

# View specific build config
kubectl get configmap <config-name> -o yaml -n $(oc project -q)

# Check uploaded files
kubectl get configmaps -l component=source-files -n $(oc project -q)
```

## 🚨 Troubleshooting

### Common Issues

#### 1. Plugin Not Visible in Console
```bash
# Check if plugin is enabled
oc get consoles.operator.openshift.io cluster -o yaml | grep -A 10 plugins

# Check plugin pod status
kubectl get pods -l app.kubernetes.io/name=rpm-builder-plugin -n $(oc project -q)

# Check plugin logs
kubectl logs -l app.kubernetes.io/name=rpm-builder-plugin -n $(oc project -q)
```

#### 2. Build Fails to Start
```bash
# Check RBAC permissions
kubectl auth can-i create pipelineruns \
  --as=system:serviceaccount:$(oc project -q):rpm-builder-sa -n $(oc project -q)

# Verify ServiceAccount exists
kubectl get serviceaccount rpm-builder-sa -n $(oc project -q)

# Check if Tekton is installed
kubectl get crd pipelines.tekton.dev
```

#### 3. File Upload Issues
```bash
# Check ConfigMap creation
kubectl get configmaps -l rpm-builder.io/build-id=<build-id> -n $(oc project -q)

# Verify file content
kubectl get configmap <file-configmap> -o yaml -n $(oc project -q)
```

#### 4. Pipeline Task Failures
```bash
# Get TaskRun status
kubectl get taskruns -l app=rpm-builder -n $(oc project -q)

# Check specific task logs
kubectl logs <taskrun-pod> -n $(oc project -q)

# Debug task step by step
kubectl describe taskrun <taskrun-name> -n $(oc project -q)
```

## 📊 Performance Testing

### Load Testing
```bash
# Create multiple builds simultaneously
for i in {1..5}; do
  # Use the UI or API to start builds
  echo "Starting build $i"
done

# Monitor resource usage
kubectl top pods -n $(oc project -q)
kubectl get pipelineruns -n $(oc project -q)
```

### Resource Monitoring
```bash
# Check PVC usage
kubectl get pvc -n $(oc project -q)

# Monitor build workspace sizes
kubectl describe pvc -l app=rpm-builder -n $(oc project -q)
```

## ✅ Validation Checklist

### Before Each Test:
- [ ] OpenShift Pipelines (Tekton) is installed
- [ ] RPM Builder pipeline and tasks are deployed
- [ ] ServiceAccount has proper permissions
- [ ] Plugin is visible in Console navigation

### After Each Build:
- [ ] Build status updates correctly in UI
- [ ] Build logs are accessible  
- [ ] ConfigMaps are created and cleaned up
- [ ] RPM artifacts are generated (when successful)
- [ ] Build history shows accurate information

### Edge Cases to Test:
- [ ] Very large file uploads (>50MB)
- [ ] Builds with many dependencies (>20)
- [ ] Long-running builds (>30 minutes)
- [ ] Simultaneous builds from different users
- [ ] Network failures during Git clone
- [ ] Invalid spec files
- [ ] Missing dependencies

## 🎯 Success Criteria

A successful test should demonstrate:
1. **UI Functionality**: All form fields work, file uploads succeed
2. **Backend Integration**: Builds start and pipeline executes
3. **Status Updates**: Real-time progress tracking works
4. **Error Handling**: Failures are reported clearly
5. **Resource Cleanup**: Temporary resources are cleaned up
6. **Multi-OS Support**: Different target OS options work
7. **Build Artifacts**: Successful builds produce RPM files

## 📝 Test Results Template

```markdown
## Test Results - [Date]

### Environment:
- OpenShift Version: 
- Tekton Version:
- Plugin Version:
- Namespace: 

### Test Cases:
| Test Case | Status | Notes |
|-----------|--------|-------|
| File Upload Build | ✅/❌ | |
| Git Repository Build | ✅/❌ | |
| Multi-OS Build | ✅/❌ | |
| Error Handling | ✅/❌ | |
| UI Responsiveness | ✅/❌ | |

### Issues Found:
- Issue 1: Description and steps to reproduce
- Issue 2: Description and steps to reproduce

### Performance Metrics:
- Average build time: X minutes
- Resource usage: Y CPU, Z memory
- Concurrent builds supported: N
```



