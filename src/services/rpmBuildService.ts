import { k8sCreate, k8sGet, k8sList, k8sUpdate } from '@openshift-console/dynamic-plugin-sdk';

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
    namespace: string;
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
   */
  private createK8sModel(kind: string, plural: string, apiVersion: string) {
    return {
      apiVersion,
      kind,
      plural,
      abbr: kind.charAt(0).toUpperCase(),
      label: kind,
      labelPlural: plural,
    };
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
    
    // Check environment variable
    const envNamespace = process.env.RPM_BUILDER_NAMESPACE;
    if (envNamespace) {
      return envNamespace;
    }
    
    // Fall back to default
    return this.DEFAULT_NAMESPACE;
  }

  /**
   * Create a new RPM build job using Tekton Pipelines
   */
  async createBuildJob(config: RPMBuildConfig, namespace?: string): Promise<RPMBuildJob> {
    const buildId = this.generateBuildId();
    const ns = namespace || this.getCurrentNamespace();
    
    try {
      // First, create a ConfigMap for the build configuration
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
        model: this.createK8sModel('PipelineRun', 'pipelineruns', 'tekton.dev/v1beta1'),
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
        model: this.createK8sModel('PipelineRun', 'pipelineruns', 'tekton.dev/v1beta1'),
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
        model: this.createK8sModel('PipelineRun', 'pipelineruns', 'tekton.dev/v1beta1'),
        name: `rpm-build-${buildId}`,
        ns,
      }) as TektonPipelineRun;
      
      // Update the PipelineRun to cancel it
      pipelineRun.spec.status = 'PipelineRunCancelled';
      
      await k8sUpdate({
        model: this.createK8sModel('PipelineRun', 'pipelineruns', 'tekton.dev/v1beta1'),
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

  private async createBuildConfigMap(buildId: string, config: RPMBuildConfig, namespace: string): Promise<void> {
    const configMap = {
      apiVersion: 'v1',
      kind: 'ConfigMap',
      metadata: {
        name: `rpm-build-config-${buildId}`,
        namespace,
        labels: {
          'rpm-builder.io/build-id': buildId,
          'app': 'rpm-builder',
          'component': 'build-config',
          'app.kubernetes.io/name': 'rpm-builder',
          'app.kubernetes.io/component': 'configmap',
          'app.kubernetes.io/part-of': 'rpm-builder-plugin'
        },
      },
      data: {
        'build-config.json': JSON.stringify(config, null, 2),
        'spec-file': config.specFile || this.generateDefaultSpecFile(config),
      },
    };

    await k8sCreate({
      model: this.createK8sModel('ConfigMap', 'configmaps', 'v1'),
      data: configMap,
    });
  }

  private async createFilesConfigMaps(buildId: string, files: FileData[], namespace: string): Promise<void> {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const configMap = {
        apiVersion: 'v1',
        kind: 'ConfigMap',
        metadata: {
          name: `rpm-build-files-${buildId}-${i}`,
          namespace,
          labels: {
            'rpm-builder.io/build-id': buildId,
            'rpm-builder.io/file-index': i.toString(),
            'app': 'rpm-builder',
            'component': 'source-files',
            'app.kubernetes.io/name': 'rpm-builder',
            'app.kubernetes.io/component': 'configmap',
            'app.kubernetes.io/part-of': 'rpm-builder-plugin'
          },
        },
        binaryData: {
          [file.name]: file.content, // base64 encoded content
        },
      };

      await k8sCreate({
        model: this.createK8sModel('ConfigMap', 'configmaps', 'v1'),
        data: configMap,
      });
    }
  }

  private async createPipelineRun(buildId: string, config: RPMBuildConfig, namespace: string): Promise<TektonPipelineRun> {
    const pipelineRun: TektonPipelineRun = {
      apiVersion: 'tekton.dev/v1beta1',
      kind: 'PipelineRun',
      metadata: {
        name: `rpm-build-${buildId}`,
        namespace,
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
          { name: 'target-os', value: config.targetOS },
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

    return await k8sCreate({
      model: this.createK8sModel('PipelineRun', 'pipelineruns', 'tekton.dev/v1beta1'),
      data: pipelineRun,
    }) as TektonPipelineRun;
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
