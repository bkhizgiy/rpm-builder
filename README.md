# RPM Builder - OpenShift Console Plugin

An OpenShift Console plugin that provides a user-friendly interface for building custom RPM packages directly within your OpenShift cluster. Users can upload source files or specify Git repositories, configure dependencies, select target operating systems, and monitor build progress - all through the OpenShift Console.

## Features

- **Source Flexibility**: Build RPMs from uploaded files or Git repositories
- **Multi-OS Support**: Target multiple operating systems (Fedora, RHEL, CentOS, openSUSE, Ubuntu)
- **Architecture Support**: Build for different architectures (x86_64, aarch64, i386, armv7hl)
- **Dependency Management**: Specify custom package dependencies
- **Custom Spec Files**: Use your own RPM spec files or auto-generate them
- **Build Monitoring**: Real-time build status and progress tracking
- **Build History**: View and manage previous builds

## Architecture

This plugin integrates with OpenShift Pipelines (Tekton) to execute RPM builds using a dedicated pipeline that:

1. **Prepares Build Environment**: Sets up the appropriate base container image with RPM build tools
2. **Fetches Sources**: Downloads from Git repositories or extracts uploaded files
3. **Installs Dependencies**: Installs specified package dependencies
4. **Generates Spec File**: Creates RPM spec files or uses provided custom ones
5. **Builds RPM**: Executes the RPM build process
6. **Publishes Artifacts**: Makes built RPMs available for download

The architecture is inspired by the [konflux-ci/rpmbuild-pipeline](https://github.com/konflux-ci/rpmbuild-pipeline) project and implements similar concepts adapted for OpenShift Console integration.

## Prerequisites

- OpenShift 4.12+ with Console dynamic plugins enabled
- OpenShift Pipelines (Tekton) installed
- Appropriate RBAC permissions for creating pipelines and managing resources

## Installation

### 1. Deploy Tekton Resources

First, deploy the RPM build pipeline and required RBAC:

```bash
# Create namespace and RBAC
kubectl apply -f k8s/rbac.yaml

# Deploy Tekton pipeline
kubectl apply -f k8s/tekton-pipeline.yaml
```

### 2. Build and Deploy the Plugin

Build the plugin:

```bash
npm install
npm run build
```

Create a container image:

```bash
docker build -t your-registry/rpm-builder-plugin:latest .
docker push your-registry/rpm-builder-plugin:latest
```

Deploy using the Helm chart:

```bash
helm install rpm-builder-plugin ./charts/openshift-console-plugin \
  --set plugin.image=your-registry/rpm-builder-plugin:latest \
  --set plugin.imagePullPolicy=Always
```

### 3. Enable the Plugin

Enable the plugin in the OpenShift Console:

```bash
oc patch consoles.operator.openshift.io cluster \
  --patch '{"spec":{"plugins":["rpm-builder-plugin"]}}' \
  --type=merge
```

Or through the Console:
1. Navigate to Administration → Cluster Settings → Configuration
2. Click on Console (console.operator.openshift.io)
3. Go to the Console plugins tab
4. Enable "RPM Builder"

## Usage

### Building an RPM Package

1. **Navigate to RPM Builder**: In the OpenShift Console, go to the "Builds" section and click "RPM Builder"

2. **Configure Package Information**:
   - Enter package name and version
   - Provide a description (optional)

3. **Set Up Sources**:
   - **File Upload**: Drag and drop source files or browse to upload
   - **Git Repository**: Provide repository URL and branch

4. **Select Target System**:
   - Choose target operating system
   - Select architecture

5. **Configure Dependencies** (optional):
   - Add required package dependencies
   - Specify additional build flags

6. **Custom Spec File** (optional):
   - Provide your own RPM spec file
   - Use placeholders like `%{name}`, `%{version}` for automatic substitution

7. **Start Build**: Click "Start Build" to initiate the RPM build process

8. **Monitor Progress**: Track build status in real-time and view build history

### Supported Operating Systems

- **Fedora**: 39, 40
- **Red Hat Enterprise Linux**: 8, 9
- **CentOS Stream**: 8, 9
- **openSUSE Leap**
- **Ubuntu LTS**: 20.04, 22.04

### Supported Architectures

- x86_64 (64-bit Intel/AMD)
- aarch64 (ARM 64-bit)
- i386 (32-bit Intel/AMD)
- armv7hl (ARM 32-bit)

## Configuration

### Environment Variables

The plugin can be configured using the following environment variables:

- `RPM_BUILDER_NAMESPACE`: Namespace for RPM build resources (default: `rpm-builder`)
- `RPM_PIPELINE_NAME`: Name of the Tekton pipeline (default: `rpm-build-pipeline`)
- `MAX_FILE_SIZE`: Maximum file upload size in bytes (default: `100MB`)

### Custom Base Images

You can customize the base images used for different operating systems by modifying the Tekton pipeline parameters:

```yaml
# In tekton-pipeline.yaml, modify the image references:
image: registry.fedoraproject.org/fedora:39  # For Fedora 39
image: registry.access.redhat.com/ubi8/ubi:latest  # For RHEL 8
```

## Development

### Local Development

1. **Prerequisites**:
   ```bash
   npm install
   ```

2. **Start Development Server**:
   ```bash
   npm run start
   ```

3. **Start Console Bridge** (in another terminal):
   ```bash
   ./start-console.sh
   ```

### Testing

Run the test suite:

```bash
npm run test
npm run test-cypress
```

### Building

```bash
npm run build
```

## API Reference

### RPM Build Service

The plugin includes a service layer (`rpmBuildService`) that provides:

- `createBuildJob(config: RPMBuildConfig)`: Start a new build
- `getBuildJobStatus(buildId: string)`: Get build status
- `listBuildJobs()`: List all builds
- `cancelBuildJob(buildId: string)`: Cancel a running build
- `getBuildLogs(buildId: string)`: Retrieve build logs

### Build Configuration Interface

```typescript
interface RPMBuildConfig {
  name: string;
  version: string;
  description: string;
  sourceType: 'upload' | 'git';
  gitRepository?: string;
  gitBranch?: string;
  files?: FileData[];
  targetOS: string;
  architecture: string;
  dependencies: string[];
  buildOptions: string[];
  specFile?: string;
}
```

## Troubleshooting

### Common Issues

1. **Build Fails to Start**:
   - Check that Tekton Pipelines is installed
   - Verify RBAC permissions
   - Ensure the `rpm-builder` namespace exists

2. **File Upload Issues**:
   - Check file size limits
   - Verify ConfigMap creation permissions
   - Ensure files are valid source code

3. **Build Failures**:
   - Review build logs in the Console
   - Check spec file syntax
   - Verify all dependencies are available

### Debugging

Enable debug logging:

```bash
kubectl set env deployment/rpm-builder-plugin LOG_LEVEL=debug
```

View pipeline logs:

```bash
# List pipeline runs
kubectl get pipelinerun -n rpm-builder

# Get logs for a specific run
kubectl logs -f -n rpm-builder <pipelinerun-name>
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## Related Projects

- [konflux-ci/rpmbuild-pipeline](https://github.com/konflux-ci/rpmbuild-pipeline) - Reference RPM build pipeline architecture
- [OpenShift Console Plugin Template](https://github.com/openshift/console-plugin-template) - Base template for OpenShift Console plugins
- [OpenShift Pipelines](https://docs.openshift.com/container-platform/latest/cicd/pipelines/understanding-openshift-pipelines.html) - Tekton integration for OpenShift