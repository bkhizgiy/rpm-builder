import * as React from 'react';
import Helmet from 'react-helmet';
// import { useTranslation } from 'react-i18next';
import { rpmBuildService, RPMBuildConfig, RPMBuildJob, FileData } from '../services/rpmBuildService';
import { ResourceLink, useActiveNamespace } from '@openshift-console/dynamic-plugin-sdk';
import {
  PageSection,
  Title,
  Card,
  CardTitle,
  CardBody,
  Form,
  FormGroup,
  FormHelperText,
  HelperText,
  HelperTextItem,
  TextInput,
  TextArea,
  FormSelect,
  FormSelectOption,
  FileUpload,
  Button,
  Tabs,
  Tab,
  TabTitleText,
  Grid,
  GridItem,
  Alert,
  AlertVariant,
  Spinner,
  Progress,
  ProgressSize,
  List,
  ListItem,
} from '@patternfly/react-core';
import {
  CodeBranchIcon,
  UploadIcon,
  CogIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
} from '@patternfly/react-icons';
import './rpm-builder.css';

type BuildConfig = Omit<RPMBuildConfig, 'files'> & { files: File[] };

const supportedOSOptions = [
  // Automotive OS
  { value: 'rhivos', label: 'Red Hat In-Vehicle OS (RHIVOS)' },
  { value: 'agl', label: 'Automotive Grade Linux (AGL)' },
  { value: 'ubuntu-core', label: 'Ubuntu Core (Automotive)' },
  
  // Red Hat Enterprise Linux
  { value: 'rhel-9', label: 'Red Hat Enterprise Linux 9' },
  { value: 'rhel-8', label: 'Red Hat Enterprise Linux 8' },
  { value: 'rhel-7', label: 'Red Hat Enterprise Linux 7' },
  
  // CentOS Stream (RHEL upstream)
  { value: 'centos-stream-10', label: 'CentOS Stream 10' },
  { value: 'centos-stream-9', label: 'CentOS Stream 9' },
  { value: 'centos-stream-8', label: 'CentOS Stream 8' },
  
  // CentOS Linux (legacy)
  { value: 'centos-7', label: 'CentOS Linux 7' },
  
  // Fedora (RHEL upstream)
  { value: 'fedora-40', label: 'Fedora 40' },
  { value: 'fedora-39', label: 'Fedora 39' },
  { value: 'fedora-38', label: 'Fedora 38' },
  
  // Fedora CoreOS / Automotive
  { value: 'fedora-coreos', label: 'Fedora CoreOS' },
  { value: 'fedora-iot', label: 'Fedora IoT' },
];

const architectureOptions = [
  { value: 'aarch64', label: 'aarch64 (ARM 64-bit)' },
  { value: 'x86_64', label: 'x86_64 (64-bit)' },
];

const calculateDuration = (startTime: string, endTime: string): string => {
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  const durationMs = end - start;
  
  const minutes = Math.floor(durationMs / 60000);
  const seconds = Math.floor((durationMs % 60000) / 1000);
  
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
};

export default function RPMBuilderPage() {
  // const { t } = useTranslation('plugin__rpm-builder-plugin');
  const [activeNamespace] = useActiveNamespace();
  const [activeTabKey, setActiveTabKey] = React.useState<string | number>(0);
  const [buildConfig, setBuildConfig] = React.useState<BuildConfig>({
    name: '',
    version: '1.0.0',
    description: '',
    sourceType: 'upload',
    files: [],
    targetOS: 'rhivos',
    architecture: 'aarch64',
    dependencies: [],
    buildOptions: [],
  });
  // Mock build history data for demonstration
  const mockBuildHistory: RPMBuildJob[] = [
    {
      metadata: {
        name: 'rpm-build-1730123456789-abc123',
        namespace: 'bella', // Your namespace
        labels: {
          'rpm-builder.io/build-id': '1730123456789-abc123',
          'rpm-builder.io/package-name': 'vehicle-diagnostics',
        },
        annotations: {
          'rpm-builder.io/target-os': 'rhivos',
          'rpm-builder.io/architecture': 'aarch64',
        },
      },
      spec: {
        buildConfig: {
          name: 'vehicle-diagnostics',
          version: '2.1.0',
          description: 'Vehicle diagnostics and monitoring service for RHIVOS',
          sourceType: 'upload',
          targetOS: 'rhivos',
          architecture: 'aarch64',
          dependencies: ['systemd', 'dbus', 'can-utils'],
          buildOptions: ['--enable-monitoring', '--with-canbus'],
        },
      },
      status: {
        phase: 'Succeeded',
        startTime: '2024-11-04T10:30:00Z',
        completionTime: '2024-11-04T10:35:45Z',
      },
    },
    {
      metadata: {
        name: 'rpm-build-1730098765432-def456',
        namespace: 'bella', // Your namespace
        labels: {
          'rpm-builder.io/build-id': '1730098765432-def456',
          'rpm-builder.io/package-name': 'automotive-gateway',
        },
        annotations: {
          'rpm-builder.io/target-os': 'rhivos',
          'rpm-builder.io/architecture': 'aarch64',
        },
      },
      spec: {
        buildConfig: {
          name: 'automotive-gateway',
          version: '1.5.2',
          description: 'Network gateway service for vehicle ECU communication',
          sourceType: 'git',
          gitRepository: 'https://github.com/automotive/gateway-service.git',
          gitBranch: 'release-1.5',
          targetOS: 'rhivos',
          architecture: 'aarch64',
          dependencies: ['libnetfilter', 'iptables', 'ethtool'],
          buildOptions: ['--with-security', '--enable-tls'],
        },
      },
      status: {
        phase: 'Succeeded',
        startTime: '2024-11-03T15:20:00Z',
        completionTime: '2024-11-03T15:28:30Z',
      },
    },
    {
      metadata: {
        name: 'rpm-build-1729987654321-ghi789',
        namespace: 'bella', // Your namespace
        labels: {
          'rpm-builder.io/build-id': '1729987654321-ghi789',
          'rpm-builder.io/package-name': 'ota-updater',
        },
        annotations: {
          'rpm-builder.io/target-os': 'rhivos',
          'rpm-builder.io/architecture': 'aarch64',
        },
      },
      spec: {
        buildConfig: {
          name: 'ota-updater',
          version: '3.0.1',
          description: 'Over-the-air update client for RHIVOS systems',
          sourceType: 'git',
          gitRepository: 'https://github.com/redhat/ota-client.git',
          gitBranch: 'main',
          targetOS: 'rhivos',
          architecture: 'aarch64',
          dependencies: ['ostree', 'libcurl', 'openssl'],
          buildOptions: ['--with-attestation'],
        },
      },
      status: {
        phase: 'Failed',
        startTime: '2024-11-02T09:15:00Z',
        completionTime: '2024-11-02T09:18:45Z',
      },
    },
  ];

  const [buildJobs, setBuildJobs] = React.useState<RPMBuildJob[]>(mockBuildHistory);
  const [isBuilding, setIsBuilding] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [dependencyInput, setDependencyInput] = React.useState('');
  const [buildOptionInput, setBuildOptionInput] = React.useState('');

  const handleTabClick = (
    event: React.MouseEvent<any> | React.KeyboardEvent | MouseEvent,
    tabIndex: string | number,
  ) => {
    setActiveTabKey(tabIndex);
  };

  const handleFileUpload = (
    event: React.ChangeEvent<HTMLInputElement> | React.DragEvent<HTMLElement>,
    files: File[],
  ) => {
    // Filter out duplicate files by name
    const existingFileNames = new Set(buildConfig.files.map(f => f.name));
    const newFiles = files.filter(f => !existingFileNames.has(f.name));
    
    setBuildConfig((prev) => ({
      ...prev,
      files: [...prev.files, ...newFiles],
    }));
  };

  const removeFile = (index: number) => {
    setBuildConfig((prev) => ({
      ...prev,
      files: prev.files.filter((_, i) => i !== index),
    }));
  };

  const addDependency = () => {
    if (dependencyInput.trim()) {
      setBuildConfig((prev) => ({
        ...prev,
        dependencies: [...prev.dependencies, dependencyInput.trim()],
      }));
      setDependencyInput('');
    }
  };

  const removeDependency = (index: number) => {
    setBuildConfig((prev) => ({
      ...prev,
      dependencies: prev.dependencies.filter((_, i) => i !== index),
    }));
  };

  const addBuildOption = () => {
    if (buildOptionInput.trim()) {
      setBuildConfig((prev) => ({
        ...prev,
        buildOptions: [...prev.buildOptions, buildOptionInput.trim()],
      }));
      setBuildOptionInput('');
    }
  };

  const removeBuildOption = (index: number) => {
    setBuildConfig((prev) => ({
      ...prev,
      buildOptions: prev.buildOptions.filter((_, i) => i !== index),
    }));
  };

  const validateBuildConfig = (): string | null => {
    if (!buildConfig.name.trim()) {
      return 'Package name is required';
    }
    if (!buildConfig.version.trim()) {
      return 'Package version is required';
    }
    if (buildConfig.sourceType === 'upload' && buildConfig.files.length === 0) {
      return 'At least one file must be uploaded';
    }
    if (buildConfig.sourceType === 'git' && !buildConfig.gitRepository?.trim()) {
      return 'Git repository URL is required';
    }
    return null;
  };

  const convertFilesToFileData = async (files: File[]): Promise<FileData[]> => {
    const fileDataArray: FileData[] = [];
    
    for (const file of files) {
      const content = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // Convert to base64 for storage in ConfigMap
          const base64 = btoa(result);
          resolve(base64);
        };
        reader.readAsBinaryString(file);
      });
      
      fileDataArray.push({
        name: file.name,
        content,
        size: file.size,
      });
    }
    
    return fileDataArray;
  };

  const startBuild = async () => {
    const validationError = validateBuildConfig();
    if (validationError) {
      setError(validationError);
      return;
    }

    // Check if a valid namespace is selected from the OpenShift console namespace selector
    if (!activeNamespace || activeNamespace === '#ALL_NS#' || activeNamespace.trim() === '') {
      setError('Please select a namespace/project from the OpenShift console namespace selector (top navigation bar) before starting a build.');
      return;
    }

    setIsBuilding(true);
    setError(null);

    try {
      // Convert File objects to FileData
      const fileData = await convertFilesToFileData(buildConfig.files);
      
      // Prepare build config for service
      const serviceConfig: RPMBuildConfig = {
        ...buildConfig,
        files: fileData,
      };

      // Create build job using the service with the namespace from OpenShift console selector
      const newJob = await rpmBuildService.createBuildJob(serviceConfig, activeNamespace);
      
      setBuildJobs((prev) => [newJob, ...prev]);
      
      // Poll for status updates
      pollBuildStatus(newJob.metadata.labels['rpm-builder.io/build-id']);
    } catch (err) {
      setError('Build failed: ' + (err as Error).message);
    } finally {
      setIsBuilding(false);
    }
  };

  const pollBuildStatus = React.useCallback(async (buildId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const updatedJob = await rpmBuildService.getBuildJobStatus(buildId);
        if (updatedJob) {
          setBuildJobs((prev) =>
            prev.map((job) =>
              job.metadata.labels['rpm-builder.io/build-id'] === buildId ? updatedJob : job,
            ),
          );
          
          // Stop polling if build is complete
          if (updatedJob.status?.phase === 'Succeeded' || updatedJob.status?.phase === 'Failed') {
            clearInterval(pollInterval);
          }
        }
      } catch (error) {
        console.error('Failed to poll build status:', error);
        clearInterval(pollInterval);
      }
    }, 5000);

    return () => clearInterval(pollInterval);
  }, []);

  // Load existing build jobs on component mount
  React.useEffect(() => {
    const loadBuildJobs = async () => {
      try {
        const jobs = await rpmBuildService.listBuildJobs();
        setBuildJobs(jobs);
      } catch (error) {
        console.error('Failed to load build jobs:', error);
      }
    };

    loadBuildJobs();
  }, []);


  const getStatusIcon = (status: RPMBuildJob['status']['phase']) => {
    switch (status) {
      case 'Succeeded':
        return <CheckCircleIcon color="var(--pf-global--success-color--100)" />;
      case 'Failed':
        return <ExclamationTriangleIcon color="var(--pf-global--danger-color--100)" />;
      case 'Running':
        return <Spinner size="sm" />;
      default:
        return <CogIcon />;
    }
  };

  return (
    <>
      <Helmet>
        <title>RPM Builder - OpenShift Console</title>
      </Helmet>
      
      <PageSection>
        <Title headingLevel="h1" size="2xl">
          RPM Package Builder
        </Title>
        <p className="pf-u-mt-sm pf-u-mb-lg">
          Build custom ASIL RPM packages from source files or Git repositories for RHIVOS.
        </p>
      </PageSection>

      <PageSection>
        <Tabs activeKey={activeTabKey} onSelect={handleTabClick} aria-label="RPM Builder tabs">
          <Tab eventKey={0} title={<TabTitleText>Build Configuration</TabTitleText>} aria-label="Build Configuration">
            <div className="pf-u-mt-lg">
              <Grid hasGutter>
                <GridItem span={8}>
                  <Card>
                    <CardTitle>Package Information</CardTitle>
                    <CardBody>
                      <Form>
                        <FormGroup label="Package Name" isRequired fieldId="package-name">
                          <TextInput
                            isRequired
                            type="text"
                            id="package-name"
                            value={buildConfig.name}
                            onChange={(_event, value) => setBuildConfig((prev) => ({ ...prev, name: value }))}
                            placeholder="my-awesome-package"
                          />
                        </FormGroup>
                        
                        <FormGroup label="Version" isRequired fieldId="package-version">
                          <TextInput
                            isRequired
                            type="text"
                            id="package-version"
                            value={buildConfig.version}
                            onChange={(_event, value) => setBuildConfig((prev) => ({ ...prev, version: value }))}
                            placeholder="1.0.0"
                          />
                        </FormGroup>
                        
                        <FormGroup label="Description" fieldId="package-description">
                          <TextArea
                            id="package-description"
                            value={buildConfig.description}
                            onChange={(_event, value) => setBuildConfig((prev) => ({ ...prev, description: value }))}
                            placeholder="A brief description of your package..."
                            rows={3}
                          />
                        </FormGroup>
                      </Form>
                    </CardBody>
                  </Card>

                  <Card>
                    <CardTitle>Source Configuration</CardTitle>
                    <CardBody>
                      <Form>
                        <FormGroup label="Source Type" fieldId="source-type">
                          <div className="pf-u-mb-md">
                            <Button
                              variant={buildConfig.sourceType === 'upload' ? 'primary' : 'secondary'}
                              onClick={() => setBuildConfig((prev) => ({ ...prev, sourceType: 'upload' }))}
                              icon={<UploadIcon />}
                              className="pf-u-mr-sm"
                            >
                              File Upload
                            </Button>
                            <Button
                              variant={buildConfig.sourceType === 'git' ? 'primary' : 'secondary'}
                              onClick={() => setBuildConfig((prev) => ({ ...prev, sourceType: 'git' }))}
                              icon={<CodeBranchIcon />}
                            >
                              Git Repository
                            </Button>
                          </div>
                        </FormGroup>

                        {buildConfig.sourceType === 'upload' && (
                          <FormGroup label="Source Files" fieldId="source-files">
                            <FileUpload
                              id="source-files"
                              type="dataURL"
                              value=""
                              filename=""
                              filenamePlaceholder="Drag and drop files here or browse to upload"
                              onFileInputChange={(_event: any, file: File) => handleFileUpload(_event as any, [file])}
                              onDataChange={() => {}}
                              onTextChange={() => {}}
                              onReadStarted={() => {}}
                              onReadFinished={() => {}}
                              allowEditingUploadedText={false}
                              browseButtonText="Browse..."
                              multiple
                            />
                            {buildConfig.files.length > 0 && (
                              <div className="pf-u-mt-sm">
                                <List>
                                  {buildConfig.files.map((file, index) => (
                                    <ListItem key={index}>
                                      {file.name} ({(file.size / 1024).toFixed(1)} KB)
                                      <Button
                                        variant="link"
                                        onClick={() => removeFile(index)}
                                        className="pf-u-ml-sm pf-u-p-0"
                                      >
                                        Remove
                                      </Button>
                                    </ListItem>
                                  ))}
                                </List>
                              </div>
                            )}
                          </FormGroup>
                        )}

                        {buildConfig.sourceType === 'git' && (
                          <>
                            <FormGroup label="Git Repository URL" isRequired fieldId="git-repo">
                              <TextInput
                                isRequired
                                type="url"
                                id="git-repo"
                                value={buildConfig.gitRepository || ''}
                                onChange={(_event, value) => setBuildConfig((prev) => ({ ...prev, gitRepository: value }))}
                                placeholder="https://github.com/username/repository.git"
                              />
                            </FormGroup>
                            
                            <FormGroup label="Branch" fieldId="git-branch">
                              <TextInput
                                type="text"
                                id="git-branch"
                                value={buildConfig.gitBranch || ''}
                                onChange={(_event, value) => setBuildConfig((prev) => ({ ...prev, gitBranch: value }))}
                                placeholder="main"
                              />
                              <FormHelperText>
                                <HelperText>
                                  <HelperTextItem>Leave empty to use the default branch</HelperTextItem>
                                </HelperText>
                              </FormHelperText>
                            </FormGroup>
                          </>
                        )}

                        <FormGroup label="Custom RPM Spec File (Optional)" fieldId="spec-file">
                          <TextArea
                            id="spec-file"
                            value={buildConfig.specFile || ''}
                            onChange={(_event, value) => setBuildConfig((prev) => ({ ...prev, specFile: value }))}
                            placeholder={`Name: %{name}
Version: %{version}
Release: 1%{?dist}
Summary: %{summary}

%description
%{description}

%prep
%setup -q

%build
make %{?_smp_mflags}

%install
make install DESTDIR=%{buildroot}

%files
%{_bindir}/*

%changelog`}
                            rows={10}
                          />
                          <FormHelperText>
                            <HelperText>
                              <HelperTextItem>
                                Leave empty to auto-generate a basic spec file based on your configuration
                              </HelperTextItem>
                            </HelperText>
                          </FormHelperText>
                        </FormGroup>
                      </Form>
                    </CardBody>
                  </Card>
                </GridItem>

                <GridItem span={4}>
                  <Card>
                    <CardTitle>Target System</CardTitle>
                    <CardBody>
                      <Form>
                        <FormGroup label="Operating System" isRequired fieldId="target-os">
                          <FormSelect
                            value={buildConfig.targetOS}
                            onChange={(_event, value) => setBuildConfig((prev) => ({ ...prev, targetOS: value }))}
                            aria-label="Select Operating System"
                          >
                            {supportedOSOptions.map((option) => (
                              <FormSelectOption key={option.value} value={option.value} label={option.label} />
                            ))}
                          </FormSelect>
                        </FormGroup>

                        <FormGroup label="Architecture" isRequired fieldId="target-arch">
                          <FormSelect
                            value={buildConfig.architecture}
                            onChange={(_event, value) => setBuildConfig((prev) => ({ ...prev, architecture: value }))}
                            aria-label="Select Architecture"
                          >
                            {architectureOptions.map((option) => (
                              <FormSelectOption key={option.value} value={option.value} label={option.label} />
                            ))}
                          </FormSelect>
                        </FormGroup>
                      </Form>
                    </CardBody>
                  </Card>

                  <Card>
                    <CardTitle>Dependencies</CardTitle>
                    <CardBody>
                      <Form>
                        <FormGroup label="Add Package Dependencies" fieldId="dependencies">
                          <div className="pf-u-display-flex pf-u-align-items-center">
                            <TextInput
                              type="text"
                              id="dependency-input"
                              value={dependencyInput}
                              onChange={(_event, value) => setDependencyInput(value)}
                              placeholder="package-name"
                              className="pf-u-flex-1 pf-u-mr-sm"
                              onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  addDependency();
                                }
                              }}
                            />
                            <Button variant="secondary" onClick={addDependency}>
                              Add
                            </Button>
                          </div>
                          {buildConfig.dependencies.length > 0 && (
                            <div className="pf-u-mt-sm">
                              <List>
                                {buildConfig.dependencies.map((dep, index) => (
                                  <ListItem key={index}>
                                    {dep}
                                    <Button
                                      variant="link"
                                      onClick={() => removeDependency(index)}
                                      className="pf-u-ml-sm pf-u-p-0"
                                    >
                                      Remove
                                    </Button>
                                  </ListItem>
                                ))}
                              </List>
                            </div>
                          )}
                        </FormGroup>
                      </Form>
                    </CardBody>
                  </Card>

                  <Card>
                    <CardTitle>Build Options</CardTitle>
                    <CardBody>
                      <Form>
                        <FormGroup label="Additional Build Flags" fieldId="build-options">
                          <div className="pf-u-display-flex pf-u-align-items-center">
                            <TextInput
                              type="text"
                              id="build-option-input"
                              value={buildOptionInput}
                              onChange={(_event, value) => setBuildOptionInput(value)}
                              placeholder="--enable-feature"
                              className="pf-u-flex-1 pf-u-mr-sm"
                              onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  addBuildOption();
                                }
                              }}
                            />
                            <Button variant="secondary" onClick={addBuildOption}>
                              Add
                            </Button>
                          </div>
                          {buildConfig.buildOptions.length > 0 && (
                            <div className="pf-u-mt-sm">
                              <List>
                                {buildConfig.buildOptions.map((option, index) => (
                                  <ListItem key={index}>
                                    {option}
                                    <Button
                                      variant="link"
                                      onClick={() => removeBuildOption(index)}
                                      className="pf-u-ml-sm pf-u-p-0"
                                    >
                                      Remove
                                    </Button>
                                  </ListItem>
                                ))}
                              </List>
                            </div>
                          )}
                        </FormGroup>
                      </Form>
                    </CardBody>
                  </Card>

                  {error && (
                    <Alert variant={AlertVariant.danger} title="Build Error" className="pf-u-mt-md">
                      {error}
                    </Alert>
                  )}

                  <div className="pf-u-mt-md">
                    <Button
                      variant="primary"
                      onClick={startBuild}
                      isDisabled={isBuilding}
                      isLoading={isBuilding}
                      size="lg"
                      className="pf-u-w-100"
                    >
                      {isBuilding ? 'Building...' : 'Start Build'}
                    </Button>
                  </div>
                </GridItem>
              </Grid>
            </div>
          </Tab>

          <Tab eventKey={1} title={<TabTitleText>Build History</TabTitleText>} aria-label="Build History">
            <div className="pf-u-mt-lg">
              <Card>
                <CardTitle>Recent Builds</CardTitle>
                <CardBody>
                  {buildJobs.length === 0 ? (
                    <div className="pf-u-text-align-center pf-u-py-xl">
                      <p>No builds yet. Create your first RPM package using the Build Configuration tab.</p>
                    </div>
                  ) : (
                    <div>
                      {buildJobs.map((job) => (
                        <Card key={job.metadata.name} className="pf-u-mb-md">
                          <CardBody>
                            <div className="pf-u-display-flex pf-u-justify-content-space-between pf-u-align-items-center">
                              <div className="pf-u-flex-1">
                                <div className="pf-u-display-flex pf-u-align-items-center pf-u-mb-sm">
                                  {getStatusIcon(job.status?.phase)}
                                  <Title headingLevel="h4" size="md" className="pf-u-ml-sm">
                                    {job.metadata.labels['rpm-builder.io/package-name']}
                                  </Title>
                                  <span className="pf-u-ml-sm pf-u-font-size-sm pf-u-color-400">
                                    v{job.spec.buildConfig?.version || 'unknown'}
                                  </span>
                                </div>
                                <div className="pf-u-font-size-sm pf-u-color-400 pf-u-mb-xs">
                                  <strong>PipelineRun:</strong>{' '}
                                  <ResourceLink
                                    groupVersionKind={{
                                      group: 'tekton.dev',
                                      version: 'v1beta1',
                                      kind: 'PipelineRun',
                                    }}
                                    name={job.metadata.name}
                                    namespace={job.metadata.namespace}
                                  />
                                </div>
                                <div className="pf-u-font-size-sm pf-u-color-400 pf-u-mb-xs">
                                  <strong>Target:</strong> {job.metadata.annotations?.['rpm-builder.io/target-os']} ({job.metadata.annotations?.['rpm-builder.io/architecture']})
                                </div>
                                <div className="pf-u-font-size-sm pf-u-color-400 pf-u-mb-xs">
                                  <strong>Source:</strong> {job.spec.buildConfig?.sourceType === 'git' ? (
                                    <>Git: {job.spec.buildConfig?.gitRepository || 'unknown'}</>
                                  ) : (
                                    'Uploaded files'
                                  )}
                                </div>
                                <div className="pf-u-font-size-sm pf-u-color-400">
                                  {job.status?.startTime && (
                                    <>
                                      <strong>Started:</strong> {new Date(job.status.startTime).toLocaleString()}
                                      {job.status?.completionTime && (
                                        <> • <strong>Duration:</strong> {calculateDuration(job.status.startTime, job.status.completionTime)}</>
                                      )}
                                    </>
                                  )}
                                </div>
                              </div>
                              <div className="pf-u-text-align-right pf-u-ml-md">
                                <div className="pf-u-font-size-sm pf-u-mb-sm">
                                  <strong>Status:</strong> {job.status?.phase || 'Pending'}
                                </div>
                                {job.status?.phase === 'Running' && (
                                  <div className="pf-u-mb-md">
                                    <Progress value={50} size={ProgressSize.sm} />
                                  </div>
                                )}
                                <div className="pf-u-display-flex pf-u-flex-direction-column" style={{ gap: '0.5rem' }}>
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    component="a"
                                    href={`/k8s/ns/${job.metadata.namespace}/tekton.dev~v1beta1~PipelineRun/${job.metadata.name}/logs`}
                                    target="_blank"
                                  >
                                    View Logs
                                  </Button>
                                  <Button
                                    variant="link"
                                    size="sm"
                                    component="a"
                                    href={`/k8s/ns/${job.metadata.namespace}/tekton.dev~v1beta1~PipelineRun/${job.metadata.name}`}
                                    target="_blank"
                                  >
                                    View Details
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </CardBody>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardBody>
              </Card>
            </div>
          </Tab>
        </Tabs>
      </PageSection>
    </>
  );
}
