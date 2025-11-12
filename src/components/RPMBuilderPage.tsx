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
  Alert,
  AlertVariant,
  Spinner,
  Progress,
  ProgressSize,
  List,
  ListItem,
  DescriptionList,
  DescriptionListGroup,
  DescriptionListTerm,
  DescriptionListDescription,
  Badge,
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

export default function RPMBuilderPage() {
  // const { t } = useTranslation('plugin__rpm-builder-plugin');
  const [activeNamespace] = useActiveNamespace();
  const [activeTabKey, setActiveTabKey] = React.useState<string | number>(0);
  const [selectedBuildId, setSelectedBuildId] = React.useState<string | null>(null);
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

  const handleFileUpload = React.useCallback((
    event: React.ChangeEvent<HTMLInputElement> | React.DragEvent<HTMLElement> | Event,
    file: File | FileList | File[] | null,
  ) => {
    // Extract files from different event types
    let filesToAdd: File[] = [];
    
    if (Array.isArray(file)) {
      filesToAdd = file;
    } else if (file instanceof File) {
      filesToAdd = [file];
    } else if (file instanceof FileList) {
      filesToAdd = Array.from(file);
    } else if (event && 'target' in event && event.target && 'files' in event.target) {
      // Handle file input change event
      const input = event.target as HTMLInputElement;
      if (input.files) {
        filesToAdd = Array.from(input.files);
      }
    } else if (event && 'dataTransfer' in event && event.dataTransfer?.files) {
      // Handle drag and drop event
      filesToAdd = Array.from(event.dataTransfer.files);
    }
    
    if (filesToAdd.length === 0) {
      return;
    }
    
    // Filter out duplicate files by name, size, and lastModified timestamp
    // This ensures we don't add the same file twice even if selected multiple times
    setBuildConfig((prev) => {
      const existingFiles = new Map(
        prev.files.map(f => [`${f.name}-${f.size}-${f.lastModified}`, f])
      );
      
      const newFiles = filesToAdd.filter(f => {
        const key = `${f.name}-${f.size}-${f.lastModified}`;
        return !existingFiles.has(key);
      });
      
      if (newFiles.length === 0) {
        return prev; // No new files to add
      }
      
      return {
      ...prev,
        files: [...prev.files, ...newFiles],
      };
    });
    
    // Reset the file input to allow selecting the same file again if needed
    // Use setTimeout to ensure the state update happens first
    setTimeout(() => {
      if (event && 'target' in event && event.target && 'value' in event.target) {
        (event.target as HTMLInputElement).value = '';
      }
    }, 0);
  }, []);

  const removeFile = (index: number) => {
    setBuildConfig((prev) => ({
      ...prev,
      files: prev.files.filter((_, i) => i !== index),
    }));
  };

  const addDependency = () => {
    const input = dependencyInput.trim();
    if (input) {
      // Split by comma and process each dependency
      const newDependencies = input
        .split(',')
        .map(dep => dep.trim())
        .filter(dep => dep.length > 0); // Remove empty strings
      
      if (newDependencies.length > 0) {
        setBuildConfig((prev) => {
          // Filter out duplicates (case-insensitive)
          const existingDeps = new Set(prev.dependencies.map(d => d.toLowerCase()));
          const uniqueNewDeps = newDependencies.filter(dep => !existingDeps.has(dep.toLowerCase()));
          
          return {
        ...prev,
            dependencies: [...prev.dependencies, ...uniqueNewDeps],
          };
        });
      setDependencyInput('');
      }
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
      
      const buildId = newJob.metadata.labels['rpm-builder.io/build-id'];
      
      // Show build details view instead of navigating
      setSelectedBuildId(buildId);
      setActiveTabKey(1); // Switch to build details tab
      
      // Poll for status updates
      pollBuildStatus(buildId);
    } catch (err) {
      setError('Build failed: ' + (err as Error).message);
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

  // Attach native change listener to file input for proper multi-file support
  React.useEffect(() => {
    if (buildConfig.sourceType !== 'upload') {
      return;
    }

    // Find the file input element inside the FileUpload component
    const findFileInput = (): HTMLInputElement | null => {
      // Try multiple selectors to find the input
      const selectors = [
        '#source-files input[type="file"]',
        'input[type="file"][id*="source-files"]',
        'input[type="file"]',
      ];
      
      for (const selector of selectors) {
        const input = document.querySelector(selector) as HTMLInputElement;
        if (input) {
          return input;
        }
      }
      
      // Also try finding by container
      const container = document.getElementById('source-files');
      if (container) {
        const input = container.querySelector('input[type="file"]') as HTMLInputElement;
        if (input) {
          return input;
        }
      }
      
      return null;
    };

    // Use MutationObserver to watch for when the input is added to DOM
    // Only observe the specific container to avoid performance issues
    const container = document.getElementById('source-files') || document.body;
    const observer = new MutationObserver(() => {
      const input = findFileInput();
      if (input && !input.hasAttribute('data-multi-file-listener')) {
        attachListener(input);
      }
    });

    // Start observing only the container (or body as fallback)
    observer.observe(container, {
      childList: true,
      subtree: true,
    });

    // Try to find immediately
    const input = findFileInput();
    if (input) {
      attachListener(input);
    }

    // Also try after a delay
    const timeoutId = setTimeout(() => {
      const delayedInput = findFileInput();
      if (delayedInput && !delayedInput.hasAttribute('data-multi-file-listener')) {
        attachListener(delayedInput);
      }
    }, 200);

    function attachListener(inputElement: HTMLInputElement) {
      // Mark as having listener to avoid duplicates
      inputElement.setAttribute('data-multi-file-listener', 'true');
      inputElement.setAttribute('multiple', 'multiple'); // Ensure multiple attribute is set

      const handleNativeChange = (e: Event) => {
        const target = e.target as HTMLInputElement;
        if (target.files && target.files.length > 0) {
          // Create a synthetic event for handleFileUpload
          const syntheticEvent = {
            target: target,
            preventDefault: () => {},
            stopPropagation: () => {},
          };
          handleFileUpload(syntheticEvent as any, target.files);
        }
      };

      inputElement.addEventListener('change', handleNativeChange);

      return () => {
        inputElement.removeEventListener('change', handleNativeChange);
        inputElement.removeAttribute('data-multi-file-listener');
      };
    }

    return () => {
      observer.disconnect();
      clearTimeout(timeoutId);
    };
  }, [buildConfig.sourceType, handleFileUpload]);

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
              {/* Package Information */}
              <Card className="pf-u-mb-md">
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

              {/* Source Configuration */}
              <Card className="pf-u-mb-md">
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
                          onFileInputChange={(event: any, file: File | FileList | null) => {
                            // Try to get files from the actual input element first
                            let filesToProcess: FileList | null = null;
                            
                            // Check event target first (most reliable)
                            if (event?.target?.files && event.target.files.length > 0) {
                              filesToProcess = event.target.files;
                            }
                            // Check if file parameter is a FileList
                            else if (file instanceof FileList) {
                              filesToProcess = file;
                            }
                            // Check if we can find the input element
                            else {
                              const inputElement = document.querySelector('#source-files input[type="file"]') as HTMLInputElement;
                              if (inputElement?.files && inputElement.files.length > 0) {
                                filesToProcess = inputElement.files;
                              }
                            }
                            
                            if (filesToProcess && filesToProcess.length > 0) {
                              handleFileUpload(event, filesToProcess);
                            } else if (file instanceof File) {
                              // Fallback: single file - convert to array
                              handleFileUpload(event, [file] as File[]);
                            }
                          }}
                          onDataChange={() => {}}
                          onTextChange={() => {}}
                          onReadStarted={() => {}}
                          onReadFinished={() => {}}
                          onClearClick={() => {
                            setBuildConfig((prev) => ({ ...prev, files: [] }));
                          }}
                          onDrop={(event: React.DragEvent<HTMLElement>) => {
                            event.preventDefault();
                            if (event.dataTransfer?.files) {
                              handleFileUpload(event as React.DragEvent<HTMLElement>, event.dataTransfer.files);
                            }
                          }}
                          allowEditingUploadedText={false}
                          browseButtonText="Browse..."
                          multiple
                        />
                        {buildConfig.files.length > 0 && (
                          <div className="pf-u-mt-sm">
                            <List>
                              {buildConfig.files.map((file, index) => (
                                <ListItem key={`${file.name}-${file.size}-${file.lastModified}-${index}`}>
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

              {/* Target System */}
              <Card className="pf-u-mb-md">
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

              {/* Dependencies */}
              <Card className="pf-u-mb-md">
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
                          placeholder="package-name or package1, package2, package3"
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
                      <FormHelperText>
                        <HelperText>
                          <HelperTextItem>
                            You can add multiple packages at once by separating them with commas (e.g., "make, gcc, cmake")
                          </HelperTextItem>
                        </HelperText>
                      </FormHelperText>
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

              {/* Build Options */}
              <Card className="pf-u-mb-md">
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
                <Alert variant={AlertVariant.danger} title="Build Error" className="pf-u-mb-md">
                  {error}
                </Alert>
              )}

              {/* Start Build Button - at the very end */}
              <div>
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
            </div>
          </Tab>

          <Tab eventKey={1} title={<TabTitleText>Build Details</TabTitleText>} aria-label="Build Details">
            <div className="pf-u-mt-lg">
              {selectedBuildId ? (
                <BuildDetailsView buildId={selectedBuildId} buildJobs={buildJobs} onBack={() => setActiveTabKey(2)} />
              ) : (
                <Card>
                  <CardBody>
                    <div className="pf-u-text-align-center pf-u-py-xl">
                      <p>No build selected. Select a build from the Build History tab to view details.</p>
                      <Button variant="primary" onClick={() => setActiveTabKey(2)} className="pf-u-mt-md">
                        View Build History
                      </Button>
                    </div>
                  </CardBody>
                </Card>
              )}
            </div>
          </Tab>

          <Tab eventKey={2} title={<TabTitleText>Build History</TabTitleText>} aria-label="Build History">
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
                                    variant="primary"
                                    size="sm"
                                    onClick={() => {
                                      const buildId = job.metadata.labels['rpm-builder.io/build-id'];
                                      if (buildId) {
                                        setSelectedBuildId(buildId);
                                        setActiveTabKey(1); // Switch to build details tab
                                      }
                                    }}
                                  >
                                    View Build Details
                                  </Button>
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
                                    View PipelineRun
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

// Build Details View Component (embedded in main page)
function BuildDetailsView({ buildId, buildJobs, onBack }: { buildId: string; buildJobs: RPMBuildJob[]; onBack: () => void }) {
  const [buildJob, setBuildJob] = React.useState<RPMBuildJob | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Find build in existing jobs first
  React.useEffect(() => {
    const existingJob = buildJobs.find(job => job.metadata.labels['rpm-builder.io/build-id'] === buildId);
    if (existingJob) {
      setBuildJob(existingJob);
      setLoading(false);
      return;
    }

    // If not found, fetch it
    const loadBuildJob = async () => {
      try {
        const job = await rpmBuildService.getBuildJobStatus(buildId);
        if (job) {
          setBuildJob(job);
          setError(null);
        } else {
          setError('Build not found');
        }
      } catch (err) {
        setError('Failed to load build details: ' + (err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    loadBuildJob();
  }, [buildId, buildJobs]);

  // Poll for status updates if build is running
  React.useEffect(() => {
    if (!buildJob) return;

    const status = buildJob.status?.phase;
    if (status === 'Succeeded' || status === 'Failed') {
      return;
    }

    const pollInterval = setInterval(async () => {
      try {
        const updatedJob = await rpmBuildService.getBuildJobStatus(buildId);
        if (updatedJob) {
          setBuildJob(updatedJob);
        }
      } catch (err) {
        console.error('Failed to poll build status:', err);
      }
    }, 5000);

    return () => clearInterval(pollInterval);
  }, [buildId, buildJob]);

  if (loading) {
    return (
      <Card>
        <CardBody>
          <div className="pf-u-text-align-center pf-u-py-xl">
            <Spinner size="xl" />
            <p className="pf-u-mt-md">Loading build details...</p>
          </div>
        </CardBody>
      </Card>
    );
  }

  if (error || !buildJob) {
    return (
      <Card>
        <CardBody>
          <Alert variant={AlertVariant.danger} title="Error">
            {error || 'Build not found'}
          </Alert>
          <div className="pf-u-mt-md">
            <Button variant="primary" onClick={onBack}>
              Back to Build History
            </Button>
          </div>
        </CardBody>
      </Card>
    );
  }

  const buildConfig = buildJob.spec.buildConfig;
  const status = buildJob.status?.phase || 'Pending';
  const startTime = buildJob.status?.startTime;
  const completionTime = buildJob.status?.completionTime;

  return (
    <div>
      <div className="pf-u-mb-md pf-u-display-flex pf-u-justify-content-space-between pf-u-align-items-center">
        <Title headingLevel="h2" size="xl">
          Build Details
        </Title>
        <Button variant="link" onClick={onBack}>
          Back to History
        </Button>
      </div>

      {/* Package Information */}
      <Card className="pf-u-mb-md">
        <CardTitle>Package Information</CardTitle>
        <CardBody>
          <DescriptionList isHorizontal>
            <DescriptionListGroup>
              <DescriptionListTerm>Package Name</DescriptionListTerm>
              <DescriptionListDescription>{buildConfig?.name || 'N/A'}</DescriptionListDescription>
            </DescriptionListGroup>
            <DescriptionListGroup>
              <DescriptionListTerm>Version</DescriptionListTerm>
              <DescriptionListDescription>{buildConfig?.version || 'N/A'}</DescriptionListDescription>
            </DescriptionListGroup>
            <DescriptionListGroup>
              <DescriptionListTerm>Description</DescriptionListTerm>
              <DescriptionListDescription>
                {buildConfig?.description || 'No description provided'}
              </DescriptionListDescription>
            </DescriptionListGroup>
          </DescriptionList>
        </CardBody>
      </Card>

      {/* Source Configuration */}
      <Card className="pf-u-mb-md">
        <CardTitle>Source Configuration</CardTitle>
        <CardBody>
          <DescriptionList isHorizontal>
            <DescriptionListGroup>
              <DescriptionListTerm>Source Type</DescriptionListTerm>
              <DescriptionListDescription>
                {buildConfig?.sourceType === 'git' ? 'Git Repository' : 'File Upload'}
              </DescriptionListDescription>
            </DescriptionListGroup>
            {buildConfig?.sourceType === 'git' ? (
              <>
                <DescriptionListGroup>
                  <DescriptionListTerm>Repository</DescriptionListTerm>
                  <DescriptionListDescription>
                    <a href={buildConfig?.gitRepository} target="_blank" rel="noopener noreferrer">
                      {buildConfig?.gitRepository || 'N/A'}
                    </a>
                  </DescriptionListDescription>
                </DescriptionListGroup>
                <DescriptionListGroup>
                  <DescriptionListTerm>Branch</DescriptionListTerm>
                  <DescriptionListDescription>
                    {buildConfig?.gitBranch || 'main'}
                  </DescriptionListDescription>
                </DescriptionListGroup>
              </>
            ) : (
              <DescriptionListGroup>
                <DescriptionListTerm>Files</DescriptionListTerm>
                <DescriptionListDescription>
                  {buildConfig?.files && buildConfig.files.length > 0
                    ? `${buildConfig.files.length} file(s) uploaded`
                    : 'No files uploaded'}
                </DescriptionListDescription>
              </DescriptionListGroup>
            )}
          </DescriptionList>
        </CardBody>
      </Card>

      {/* Target System */}
      <Card className="pf-u-mb-md">
        <CardTitle>Target System</CardTitle>
        <CardBody>
          <DescriptionList isHorizontal>
            <DescriptionListGroup>
              <DescriptionListTerm>Operating System</DescriptionListTerm>
              <DescriptionListDescription>
                {buildJob.metadata.annotations?.['rpm-builder.io/target-os'] || buildConfig?.targetOS || 'N/A'}
              </DescriptionListDescription>
            </DescriptionListGroup>
            <DescriptionListGroup>
              <DescriptionListTerm>Architecture</DescriptionListTerm>
              <DescriptionListDescription>
                {buildJob.metadata.annotations?.['rpm-builder.io/architecture'] || buildConfig?.architecture || 'N/A'}
              </DescriptionListDescription>
            </DescriptionListGroup>
          </DescriptionList>
        </CardBody>
      </Card>

      {/* Dependencies */}
      <Card className="pf-u-mb-md">
        <CardTitle>Dependencies</CardTitle>
        <CardBody>
          {buildConfig?.dependencies && buildConfig.dependencies.length > 0 ? (
            <List>
              {buildConfig.dependencies.map((dep, index) => (
                <ListItem key={index}>{dep}</ListItem>
              ))}
            </List>
          ) : (
            <p className="pf-u-color-400">No dependencies specified</p>
          )}
        </CardBody>
      </Card>

      {/* Build Options */}
      <Card className="pf-u-mb-md">
        <CardTitle>Build Options</CardTitle>
        <CardBody>
          {buildConfig?.buildOptions && buildConfig.buildOptions.length > 0 ? (
            <List>
              {buildConfig.buildOptions.map((option, index) => (
                <ListItem key={index}>
                  <code>{option}</code>
                </ListItem>
              ))}
            </List>
          ) : (
            <p className="pf-u-color-400">No build options specified</p>
          )}
        </CardBody>
      </Card>

      {/* Build Status */}
      <Card className="pf-u-mb-md">
        <CardTitle>
          <div className="pf-u-display-flex pf-u-align-items-center">
            {getStatusIcon(status)}
            <span className="pf-u-ml-sm">Build Status</span>
          </div>
        </CardTitle>
        <CardBody>
          <DescriptionList isHorizontal>
            <DescriptionListGroup>
              <DescriptionListTerm>Status</DescriptionListTerm>
              <DescriptionListDescription>
                <Badge isRead={status !== 'Running'}>{status}</Badge>
              </DescriptionListDescription>
            </DescriptionListGroup>
            <DescriptionListGroup>
              <DescriptionListTerm>PipelineRun</DescriptionListTerm>
              <DescriptionListDescription>
                <ResourceLink
                  groupVersionKind={{
                    group: 'tekton.dev',
                    version: 'v1beta1',
                    kind: 'PipelineRun',
                  }}
                  name={buildJob.metadata.name}
                  namespace={buildJob.metadata.namespace}
                />
              </DescriptionListDescription>
            </DescriptionListGroup>
            {startTime && (
              <DescriptionListGroup>
                <DescriptionListTerm>Started</DescriptionListTerm>
                <DescriptionListDescription>
                  {new Date(startTime).toLocaleString()}
                </DescriptionListDescription>
              </DescriptionListGroup>
            )}
            {completionTime && (
              <DescriptionListGroup>
                <DescriptionListTerm>Completed</DescriptionListTerm>
                <DescriptionListDescription>
                  {new Date(completionTime).toLocaleString()}
                </DescriptionListDescription>
              </DescriptionListGroup>
            )}
            {startTime && (
              <DescriptionListGroup>
                <DescriptionListTerm>Duration</DescriptionListTerm>
                <DescriptionListDescription>
                  {calculateDuration(startTime, completionTime)}
                </DescriptionListDescription>
              </DescriptionListGroup>
            )}
          </DescriptionList>
        </CardBody>
      </Card>

      {/* Actions - at the very end */}
      <Card>
        <CardTitle>Actions</CardTitle>
        <CardBody>
          <div className="pf-u-display-flex pf-u-flex-direction-column" style={{ gap: '0.5rem' }}>
            <Button
              variant="secondary"
              size="sm"
              component="a"
              href={`/k8s/ns/${buildJob.metadata.namespace}/tekton.dev~v1beta1~PipelineRun/${buildJob.metadata.name}/logs`}
              target="_blank"
            >
              View Logs
            </Button>
            <Button
              variant="secondary"
              size="sm"
              component="a"
              href={`/k8s/ns/${buildJob.metadata.namespace}/tekton.dev~v1beta1~PipelineRun/${buildJob.metadata.name}`}
              target="_blank"
            >
              View PipelineRun Details
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
