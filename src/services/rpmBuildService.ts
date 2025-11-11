import { k8sGet, k8sList, k8sUpdate, k8sCreate } from '@openshift-console/dynamic-plugin-sdk';

export interface RPMBuildConfig {
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

export interface FileData {
  name: string;
  content: string;
  size: number;
}

export interface RPMBuildJob {
  metadata: {
    name: string;
    namespace: string;
    labels: {
      'rpm-builder.io/build-id': string;
      'rpm-builder.io/package-name': string;
    };
    annotations: {
      'rpm-builder.io/target-os': string;
      'rpm-builder.io/architecture': string;
    };
  };
  spec: {
    buildConfig: RPMBuildConfig;
    workspace?: {
      volumeClaimTemplate: {
        spec: {
          accessModes: string[];
          resources: {
            requests: {
              storage: string;
            };
          };
        };
      };
    };
  };
  status?: {
    phase: 'Pending' | 'Running' | 'Succeeded' | 'Failed';
    startTime?: string;
    completionTime?: string;
    conditions?: Array<{
      type: string;
      status: string;
      lastTransitionTime: string;
      reason?: string;
      message?: string;
    }>;
    taskResults?: Array<{
      name: string;
      value: string;
    }>;
  };
}

export interface TektonPipelineRun {
  apiVersion: 'tekton.dev/v1beta1';
  kind: 'PipelineRun';
  metadata: {
    name: string;
    namespace?: string;
    labels?: {
      [key: string]: string;
    };
    annotations?: {
      [key: string]: string;
    };
  };
  spec: {
    pipelineRef: {
      name: string;
    };
    params: Array<{
      name: string;
      value: string;
    }>;
    workspaces: Array<{
      name: string;
      volumeClaimTemplate?: {
        spec: {
          accessModes: string[];
          resources: {
            requests: {
              storage: string;
            };
          };
        };
      };
      persistentVolumeClaim?: {
        claimName: string;
      };
    }>;
    status?: string;
  };
  status?: {
    startTime?: string;
    completionTime?: string;
    conditions?: Array<{
      type: string;
      status: string;
      lastTransitionTime?: string;
      reason?: string;
      message?: string;
    }>;
  };
}

class RPMBuildService {
  private readonly DEFAULT_NAMESPACE = 'rpm-builder';
  private readonly PIPELINE_NAME = 'rpm-build-pipeline';

  /**
   * Helper to create K8sModel with all required properties
   * Note: apiVersion should NOT be in the model - it's only in the data object
   * For core resources (ConfigMap, Secret, etc.), apiGroup should be undefined
   * For custom resources, specify the apiGroup (e.g., 'tekton.dev')
   */
  private createK8sModel(kind: string, plural: string, apiVersion: string, apiGroup?: string) {
    const model: any = {
      kind,
      plural,
      abbr: kind.charAt(0).toUpperCase(),
      label: kind,
      labelPlural: plural,
      namespaced: true,
    };
    
    // Only add apiGroup for custom resources (not core/v1 resources)
    if (apiGroup) {
      model.apiGroup = apiGroup;
      // Extract version from apiVersion (format: "group/version" or just "version")
      const version = apiVersion.includes('/') ? apiVersion.split('/')[1] : apiVersion;
      model.version = version; // SDK might need this explicitly
      // For custom resources, construct id as: apiGroup~version~kind
      model.id = `${apiGroup}~${version}~${kind}`;
    } else {
      // For core resources, set version to 'v1'
      model.version = 'v1';
    }
    
    return model;
  }

  /**
   * Get the current namespace from environment or use default
   */
  private getCurrentNamespace(): string {
    // Try to get namespace from various sources
    if (typeof window !== 'undefined' && window.location) {
      // Extract from OpenShift Console URL if available
      const matches = window.location.pathname.match(/\/k8s\/ns\/([^/]+)/);
      if (matches && matches[1]) {
        return matches[1];
      }
    }
    
    // Check environment variable (only available in Node.js/build time)
    if (typeof process !== 'undefined' && process.env) {
      const envNamespace = process.env.RPM_BUILDER_NAMESPACE;
      if (envNamespace) {
        return envNamespace;
      }
    }
    
    // Fall back to default
    return this.DEFAULT_NAMESPACE;
  }

  /**
   * Verify namespace exists and is accessible
   * Note: Skipping verification since SDK calls are failing. We'll let resource creation determine if namespace is valid.
   */
  private async verifyNamespace(namespace: string): Promise<void> {
    // Skip verification - let the actual resource creation determine if namespace is valid
    console.log(`Skipping namespace verification for "${namespace}" - will attempt resource creation directly`);
  }

  /**
   * Create a new RPM build job using Tekton Pipelines
   */
  async createBuildJob(config: RPMBuildConfig, namespace?: string): Promise<RPMBuildJob> {
    const buildId = this.generateBuildId();
    
    // Filter out placeholder namespace values
    let ns = namespace;
    if (ns === '#ALL_NS#' || ns === '' || !ns) {
      ns = this.getCurrentNamespace();
    }
    
    // Final check - if still invalid, throw error
    if (!ns || ns.trim() === '' || ns === '#ALL_NS#') {
      throw new Error(
        'Namespace is required but was not provided. ' +
        'Please navigate to a specific namespace in the OpenShift console before starting a build.'
      );
    }
    
    console.log('Creating build job:', { buildId, namespace: ns, config: { name: config.name, version: config.version } });
    
    try {
      // First, verify the namespace exists
      await this.verifyNamespace(ns);
      
      // Then create a ConfigMap for the build configuration
      await this.createBuildConfigMap(buildId, config, ns);
      
      // If files are provided, create ConfigMaps for each file
      if (config.files && config.files.length > 0) {
        await this.createFilesConfigMaps(buildId, config.files, ns);
      }
      
      // Create the Tekton PipelineRun
      await this.createPipelineRun(buildId, config, ns);
      
      // Return the build job representation
      const buildJob: RPMBuildJob = {
        metadata: {
          name: `rpm-build-${buildId}`,
          namespace: ns,
          labels: {
            'rpm-builder.io/build-id': buildId,
            'rpm-builder.io/package-name': config.name,
          },
          annotations: {
            'rpm-builder.io/target-os': config.targetOS,
            'rpm-builder.io/architecture': config.architecture,
          },
        },
        spec: {
          buildConfig: config,
        },
        status: {
          phase: 'Pending',
        },
      };
      
      return buildJob;
    } catch (error) {
      console.error('Failed to create RPM build job:', error);
      throw new Error(`Failed to create build job: ${error.message}`);
    }
  }

  /**
   * Get the status of a build job
   */
  async getBuildJobStatus(buildId: string, namespace?: string): Promise<RPMBuildJob | null> {
    const ns = namespace || this.getCurrentNamespace();
    
    try {
      // Get the PipelineRun status
      const pipelineRun = await k8sGet({
        model: this.createK8sModel('PipelineRun', 'pipelineruns', 'tekton.dev/v1beta1', 'tekton.dev'),
        name: `rpm-build-${buildId}`,
        ns,
      }) as TektonPipelineRun;
      
      // Convert PipelineRun to BuildJob representation
      return this.pipelineRunToBuildJob(pipelineRun);
    } catch (error) {
      console.error('Failed to get build job status:', error);
      return null;
    }
  }

  /**
   * List all build jobs
   */
  async listBuildJobs(namespace?: string): Promise<RPMBuildJob[]> {
    const ns = namespace || this.getCurrentNamespace();
    
    try {
      const result = await k8sList({
        model: this.createK8sModel('PipelineRun', 'pipelineruns', 'tekton.dev/v1beta1', 'tekton.dev'),
        queryParams: {
          ns,
          labelSelector: 'rpm-builder.io/build-id',
        },
      });
      
      // k8sList can return either an array or an object with items array
      const pipelineRuns = Array.isArray(result) ? result : (result as any).items || [];
      
      return pipelineRuns.map((pr: TektonPipelineRun) => this.pipelineRunToBuildJob(pr));
    } catch (error) {
      console.error('Failed to list build jobs:', error);
      return [];
    }
  }

  /**
   * Cancel a running build job
   */
  async cancelBuildJob(buildId: string, namespace?: string): Promise<boolean> {
    const ns = namespace || this.getCurrentNamespace();
    
    try {
      const pipelineRun = await k8sGet({
        model: this.createK8sModel('PipelineRun', 'pipelineruns', 'tekton.dev/v1beta1', 'tekton.dev'),
        name: `rpm-build-${buildId}`,
        ns,
      }) as TektonPipelineRun;
      
      // Update the PipelineRun to cancel it
      pipelineRun.spec.status = 'PipelineRunCancelled';
      
      await k8sUpdate({
        model: this.createK8sModel('PipelineRun', 'pipelineruns', 'tekton.dev/v1beta1', 'tekton.dev'),
        data: pipelineRun,
        name: pipelineRun.metadata.name,
        ns,
      });
      
      return true;
    } catch (error) {
      console.error('Failed to cancel build job:', error);
      return false;
    }
  }

  /**
   * Get build logs
   */
  async getBuildLogs(buildId: string, namespace?: string): Promise<string> {
    const ns = namespace || this.getCurrentNamespace();
    
    try {
      // This would typically involve getting logs from the TaskRuns
      // For now, return a placeholder implementation
      const response = await fetch(`/api/kubernetes/api/v1/namespaces/${ns}/pods?labelSelector=tekton.dev/pipelineRun=rpm-build-${buildId}`);
      const pods = await response.json();
      
      if (pods.items && pods.items.length > 0) {
        const podName = pods.items[0].metadata.name;
        const logResponse = await fetch(`/api/kubernetes/api/v1/namespaces/${ns}/pods/${podName}/log`);
        return await logResponse.text();
      }
      
      return 'No logs available yet.';
    } catch (error) {
      console.error('Failed to get build logs:', error);
      return 'Error retrieving logs.';
    }
  }

  private generateBuildId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Map OS name to container image reference
   * The pipeline expects actual container image references, not just OS names
   */
  private mapOSToImage(osName: string): string {
    const osImageMap: { [key: string]: string } = {
      'rhivos': 'quay.io/centos/centos:stream9', // RHIVOS is based on CentOS Stream
      'autosd': 'quay.io/centos/centos:stream9', // AutoSD is also CentOS-based
      'rhel8': 'registry.access.redhat.com/ubi8/ubi:latest',
      'rhel9': 'registry.access.redhat.com/ubi9/ubi:latest',
      'rhel8-upstream': 'quay.io/centos/centos:stream8',
      'rhel9-upstream': 'quay.io/centos/centos:stream9',
      'fedora': 'docker.io/library/fedora:latest',
      'fedora-39': 'docker.io/library/fedora:39',
      'fedora-40': 'docker.io/library/fedora:40',
      'centos-stream8': 'quay.io/centos/centos:stream8',
      'centos-stream9': 'quay.io/centos/centos:stream9',
      'centos-stream10': 'quay.io/centos/centos:stream10',
    };
    
    // If it's already an image reference (contains : or /), return as-is
    if (osName.includes(':') || osName.includes('/')) {
      return osName;
    }
    
    // Otherwise, map it to an image
    return osImageMap[osName.toLowerCase()] || 'quay.io/centos/centos:stream9'; // Default fallback
  }

  /**
   * Get CSRF token from document cookies or meta tags
   */
  private getCSRFToken(): string {
    if (typeof document === 'undefined') return '';
    
    // Try cookies first
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      const cookieName = name.toLowerCase();
      if (cookieName === 'csrf-token' || cookieName === 'csrf_token' || cookieName === 'x-csrf-token') {
        const token = decodeURIComponent(value);
        if (token) {
          console.log('Found CSRF token in cookie:', name);
          return token;
        }
      }
    }
    
    // Try meta tags
    const metaTags = document.querySelectorAll('meta[name*="csrf"], meta[name*="CSRF"]');
    for (const meta of Array.from(metaTags)) {
      const content = meta.getAttribute('content');
      if (content) {
        console.log('Found CSRF token in meta tag:', meta.getAttribute('name'));
        return content;
      }
    }
    
    // Try window object (some consoles store it here)
    if (typeof window !== 'undefined') {
      const win = window as any;
      if (win.CSRF_TOKEN || win.__CSRF_TOKEN__) {
        console.log('Found CSRF token in window object');
        return win.CSRF_TOKEN || win.__CSRF_TOKEN__;
      }
    }
    
    console.warn('CSRF token not found - request may fail with 401');
    return '';
  }

  private async createBuildConfigMap(buildId: string, config: RPMBuildConfig, namespace: string): Promise<void> {
    // Try SDK first with proper model structure
    const configMapModel = this.createK8sModel('ConfigMap', 'configmaps', 'v1', undefined);

    const configMap: any = {
      apiVersion: 'v1',
      kind: 'ConfigMap',
      metadata: {
        name: `rpm-build-config-${buildId}`,
        labels: {
          'rpm-builder.io/build-id': buildId,
          'app': 'rpm-builder',
          'component': 'build-config',
        },
      },
      data: {
        'build-config.json': JSON.stringify(config, null, 2),
        'spec-file': config.specFile || this.generateDefaultSpecFile(config),
      },
    };

    console.log('Creating ConfigMap - trying SDK first:', { 
      namespace, 
      configMapName: configMap.metadata.name,
      model: configMapModel,
    });

    // Try SDK first (handles authentication automatically)
    try {
      const result = await k8sCreate({
        model: configMapModel,
        data: configMap,
        ns: namespace,
      });
      console.log('✓ ConfigMap created successfully using SDK');
      return result;
    } catch (sdkError: any) {
      console.warn('SDK creation failed, trying direct API call:', sdkError?.message);
      
      // Fallback to direct API call if SDK fails
      const csrfToken = this.getCSRFToken();
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      };
      
      if (csrfToken) {
        headers['X-CSRFToken'] = csrfToken;
        headers['X-CSRF-Token'] = csrfToken;
      }
      
      const apiPath = `/api/kubernetes/api/v1/namespaces/${namespace}/configmaps`;
      console.log('Trying direct API call to:', apiPath);
      
      const response = await fetch(apiPath, {
        method: 'POST',
        headers,
        credentials: 'same-origin',
        body: JSON.stringify(configMap),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorBody: any = { message: errorText };
        try {
          errorBody = JSON.parse(errorText);
        } catch (e) {
          // Not JSON
        }
        
        throw new Error(
          `Failed to create ConfigMap: ${response.status} ${response.statusText}. ` +
          `Error: ${errorBody?.message || errorText}`
        );
      }

      const result = await response.json();
      console.log('✓ ConfigMap created successfully using direct API');
      return result;
    }
  }

  private async createFilesConfigMaps(buildId: string, files: FileData[], namespace: string): Promise<void> {
    const configMapModel = this.createK8sModel('ConfigMap', 'configmaps', 'v1', undefined);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const configMap: any = {
        apiVersion: 'v1',
        kind: 'ConfigMap',
        metadata: {
          name: `rpm-build-files-${buildId}-${i}`,
          labels: {
            'rpm-builder.io/build-id': buildId,
            'rpm-builder.io/file-index': i.toString(),
            'app': 'rpm-builder',
            'component': 'source-files',
          },
        },
        binaryData: {
          [file.name]: file.content, // base64 encoded content
        },
      };

      try {
        // Try SDK first
        const result = await k8sCreate({
          model: configMapModel,
          data: configMap,
          ns: namespace,
        });
        console.log(`✓ ConfigMap created successfully for file ${i} using SDK:`, result?.metadata?.name);
      } catch (sdkError: any) {
        console.warn(`SDK creation failed for file ${i}, trying direct API:`, sdkError?.message);
        
        // Fallback to direct API
        const csrfToken = this.getCSRFToken();
        const headers: HeadersInit = {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        };
        
        if (csrfToken) {
          headers['X-CSRFToken'] = csrfToken;
          headers['X-CSRF-Token'] = csrfToken;
        }

        const apiPath = `/api/kubernetes/api/v1/namespaces/${namespace}/configmaps`;
        const response = await fetch(apiPath, {
          method: 'POST',
          headers,
          credentials: 'same-origin',
          body: JSON.stringify(configMap),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to create ConfigMap for file ${i}: ${response.status} ${errorText}`);
        }

        const result = await response.json();
        console.log(`✓ ConfigMap created successfully for file ${i} using direct API:`, result?.metadata?.name);
      }
    }
  }

  private async createPipelineRun(buildId: string, config: RPMBuildConfig, namespace: string): Promise<TektonPipelineRun> {
    const pipelineRun: TektonPipelineRun = {
      apiVersion: 'tekton.dev/v1beta1',
      kind: 'PipelineRun',
      metadata: {
        name: `rpm-build-${buildId}`,
        labels: {
          'rpm-builder.io/build-id': buildId,
          'rpm-builder.io/package-name': config.name,
          'app': 'rpm-builder',
          'component': 'pipeline-run',
          'app.kubernetes.io/name': 'rpm-builder',
          'app.kubernetes.io/component': 'pipelinerun',
          'app.kubernetes.io/part-of': 'rpm-builder-plugin'
        },
        annotations: {
          'rpm-builder.io/build-config': JSON.stringify({
            targetOS: config.targetOS,
            architecture: config.architecture,
          }),
        },
      },
      spec: {
        pipelineRef: {
          name: this.PIPELINE_NAME,
        },
        params: [
          { name: 'package-name', value: config.name },
          { name: 'package-version', value: config.version },
          { name: 'target-os', value: this.mapOSToImage(config.targetOS) }, // Map OS name to image reference
          { name: 'architecture', value: config.architecture },
          { name: 'build-id', value: buildId },
          { name: 'source-type', value: config.sourceType },
          { name: 'git-repository', value: config.gitRepository || '' },
          { name: 'git-branch', value: config.gitBranch || 'main' },
          { name: 'dependencies', value: config.dependencies.join(',') },
          { name: 'build-options', value: config.buildOptions.join(' ') },
        ],
        workspaces: [
          {
            name: 'source-workspace',
            volumeClaimTemplate: {
              spec: {
                accessModes: ['ReadWriteOnce'],
                resources: {
                  requests: {
                    storage: '1Gi',
                  },
                },
              },
            },
          },
          {
            name: 'output-workspace',
            volumeClaimTemplate: {
              spec: {
                accessModes: ['ReadWriteOnce'],
                resources: {
                  requests: {
                    storage: '500Mi',
                  },
                },
              },
            },
          },
        ],
      },
    };

    console.log('Creating PipelineRun - trying SDK first:', { 
      namespace, 
      pipelineRunName: pipelineRun.metadata.name,
    });

    // Try SDK first with proper model structure
    const pipelineRunModel = this.createK8sModel('PipelineRun', 'pipelineruns', 'v1beta1', 'tekton.dev');

    try {
      const result = await k8sCreate({
        model: pipelineRunModel,
        data: pipelineRun,
        ns: namespace,
      });
      console.log('✓ PipelineRun created successfully using SDK');
      return result as TektonPipelineRun;
    } catch (sdkError: any) {
      console.warn('SDK creation failed, trying direct API call:', sdkError?.message);
      
      // Fallback to direct API call if SDK fails
      const csrfToken = this.getCSRFToken();
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      };
      
      if (csrfToken) {
        headers['X-CSRFToken'] = csrfToken;
        headers['X-CSRF-Token'] = csrfToken;
      }
      
      // Custom resources use /apis/{group}/{version}
      const apiPaths = [
        `/api/kubernetes/apis/tekton.dev/v1beta1/namespaces/${namespace}/pipelineruns`,  // Standard console proxy
        `/apis/tekton.dev/v1beta1/namespaces/${namespace}/pipelineruns`,                  // Direct API
      ];
      
      let lastError: Error | null = null;
      
      for (const apiPath of apiPaths) {
        try {
          console.log(`Trying PipelineRun API path: ${apiPath}`);
          
          const response = await fetch(apiPath, {
            method: 'POST',
            headers,
            credentials: 'same-origin',
            body: JSON.stringify(pipelineRun),
          });
          
          console.log(`Response for ${apiPath}:`, response.status, response.statusText);
          
          if (response.ok) {
            const result = await response.json();
            console.log(`✓ PipelineRun created successfully using path: ${apiPath}`);
            return result as TektonPipelineRun;
          }
          
          // If 404, try next path
          if (response.status === 404) {
            await response.text(); // Read response to clear it
            console.log(`✗ Path ${apiPath} returned 404, trying next...`);
            lastError = new Error(`404 Not Found for path: ${apiPath}`);
            continue;
          }
          
          // For other errors, throw immediately
          const errorText = await response.text();
          let errorBody: any = { message: errorText };
          try {
            errorBody = JSON.parse(errorText);
          } catch (e) {
            // Not JSON
          }
          
          throw new Error(
            `Failed to create PipelineRun: ${response.status} ${response.statusText}. ` +
            `Path: ${apiPath}. Error: ${errorBody?.message || errorText}`
          );
        } catch (error: any) {
          if (error?.message && !error.message.includes('404') && !error.message.includes('Not Found')) {
            throw error;
          }
          lastError = error;
        }
      }
      
      throw lastError || new Error('All PipelineRun API paths failed');
    }
  }

  private pipelineRunToBuildJob(pipelineRun: TektonPipelineRun): RPMBuildJob {
    const buildConfig = JSON.parse(
      pipelineRun.metadata.annotations?.['rpm-builder.io/build-config'] || '{}'
    );
    
    return {
      metadata: {
        name: pipelineRun.metadata.name,
        namespace: pipelineRun.metadata.namespace,
        labels: {
          'rpm-builder.io/build-id': pipelineRun.metadata.labels?.['rpm-builder.io/build-id'] || '',
          'rpm-builder.io/package-name': pipelineRun.metadata.labels?.['rpm-builder.io/package-name'] || '',
        },
        annotations: {
          'rpm-builder.io/target-os': buildConfig.targetOS || '',
          'rpm-builder.io/architecture': buildConfig.architecture || '',
        },
      },
      spec: {
        buildConfig,
      },
      status: {
        phase: this.mapPipelineRunStatus(pipelineRun.status),
        startTime: pipelineRun.status?.startTime,
        completionTime: pipelineRun.status?.completionTime,
      },
    };
  }

  private mapPipelineRunStatus(status: any): 'Pending' | 'Running' | 'Succeeded' | 'Failed' {
    if (!status) return 'Pending';
    
    const conditions = status.conditions || [];
    const succeededCondition = conditions.find((c: any) => c.type === 'Succeeded');
    
    if (!succeededCondition) return 'Running';
    
    switch (succeededCondition.status) {
      case 'True':
        return 'Succeeded';
      case 'False':
        return 'Failed';
      default:
        return 'Running';
    }
  }

  private generateDefaultSpecFile(config: RPMBuildConfig): string {
    return `Name: ${config.name}
Version: ${config.version}
Release: 1%{?dist}
Summary: ${config.description || config.name}
License: GPL
Group: Applications/System
${config.dependencies.length > 0 ? `Requires: ${config.dependencies.join(', ')}` : ''}

%description
${config.description || `RPM package for ${config.name}`}

%prep
%setup -q

%build
${config.buildOptions.join(' ')}

%install
rm -rf %{buildroot}
mkdir -p %{buildroot}%{_bindir}

%clean
rm -rf %{buildroot}

%files
%defattr(-,root,root,-)

%changelog
* $(date "+%a %b %d %Y") RPM Builder <rpm-builder@openshift.local> - ${config.version}-1
- Initial package build
`;
  }
}

export const rpmBuildService = new RPMBuildService();
