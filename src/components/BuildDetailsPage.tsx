import * as React from 'react';
import Helmet from 'react-helmet';
import { useParams, useHistory, useLocation } from 'react-router-dom';
import { rpmBuildService, RPMBuildJob } from '../services/rpmBuildService';
import { ResourceLink, useActiveNamespace } from '@openshift-console/dynamic-plugin-sdk';
import {
  PageSection,
  Title,
  Card,
  CardTitle,
  CardBody,
  Grid,
  GridItem,
  Alert,
  AlertVariant,
  Spinner,
  Progress,
  ProgressSize,
  DescriptionList,
  DescriptionListGroup,
  DescriptionListTerm,
  DescriptionListDescription,
  List,
  ListItem,
  Button,
  Badge,
  Divider,
} from '@patternfly/react-core';
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  CogIcon,
  CodeBranchIcon,
  UploadIcon,
} from '@patternfly/react-icons';
import './rpm-builder.css';

const calculateDuration = (startTime: string, endTime?: string): string => {
  const start = new Date(startTime).getTime();
  const end = endTime ? new Date(endTime).getTime() : Date.now();
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

const getStatusBadge = (status: RPMBuildJob['status']['phase']) => {
  switch (status) {
    case 'Succeeded':
      return <Badge isRead>{status}</Badge>;
    case 'Failed':
      return <Badge isRead>{status}</Badge>;
    case 'Running':
      return <Badge>{status}</Badge>;
    default:
      return <Badge isRead>{status || 'Pending'}</Badge>;
  }
};

export default function BuildDetailsPage() {
  const { buildId } = useParams<{ buildId: string }>();
  const history = useHistory();
  const location = useLocation();
  const [activeNamespace] = useActiveNamespace();
  const [buildJob, setBuildJob] = React.useState<RPMBuildJob | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Try to get buildId from multiple sources
  const getBuildId = React.useCallback(() => {
    // First try route params
    if (buildId) {
      return buildId;
    }
    
    // Try query params
    const searchParams = new URLSearchParams(location.search);
    const queryBuildId = searchParams.get('buildId');
    if (queryBuildId) {
      return queryBuildId;
    }
    
    // Try location state (if navigated with state)
    const state = (location.state as any);
    if (state?.buildId) {
      return state.buildId;
    }
    
    // Try to extract from pathname
    const pathMatch = location.pathname.match(/\/build\/([^\/]+)/);
    if (pathMatch && pathMatch[1]) {
      return pathMatch[1];
    }
    
    return null;
  }, [buildId, location]);

  // Load build job details
  React.useEffect(() => {
    const actualBuildId = getBuildId();
    
    // Check if buildJob was passed in state (faster, no need to fetch)
    const state = (location.state as any);
    if (state?.buildJob) {
      console.log('Using build job from navigation state');
      setBuildJob(state.buildJob);
      setError(null);
      setLoading(false);
      return;
    }
    
    if (!actualBuildId) {
      setError(`Build ID is required. Path: ${location.pathname}, Search: ${location.search}`);
      setLoading(false);
      return;
    }

    const loadBuildJob = async () => {
      try {
        console.log('Loading build job with ID:', actualBuildId);
        const job = await rpmBuildService.getBuildJobStatus(actualBuildId);
        if (job) {
          console.log('Build job loaded:', job);
          setBuildJob(job);
          setError(null);
        } else {
          setError(`Build not found for ID: ${actualBuildId}`);
        }
      } catch (err) {
        console.error('Error loading build job:', err);
        setError('Failed to load build details: ' + (err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    loadBuildJob();
  }, [getBuildId, location]);

  // Poll for status updates if build is running
  React.useEffect(() => {
    const actualBuildId = getBuildId();
    if (!actualBuildId || !buildJob) {
      return;
    }

    const status = buildJob.status?.phase;
    if (status === 'Succeeded' || status === 'Failed') {
      return; // Stop polling if build is complete
    }

    const pollInterval = setInterval(async () => {
      try {
        const updatedJob = await rpmBuildService.getBuildJobStatus(actualBuildId);
        if (updatedJob) {
          setBuildJob(updatedJob);
        }
      } catch (err) {
        console.error('Failed to poll build status:', err);
      }
    }, 5000);

    return () => clearInterval(pollInterval);
  }, [getBuildId, buildJob]);

  if (loading) {
    return (
      <>
        <Helmet>
          <title>Build Details - RPM Builder</title>
        </Helmet>
        <PageSection>
          <div className="pf-u-text-align-center pf-u-py-xl">
            <Spinner size="xl" />
            <p className="pf-u-mt-md">Loading build details...</p>
          </div>
        </PageSection>
      </>
    );
  }

  if (error || (!buildJob && !loading)) {
    const actualBuildId = getBuildId();
    return (
      <>
        <Helmet>
          <title>Build Details - RPM Builder</title>
        </Helmet>
        <PageSection>
          <Alert variant={AlertVariant.danger} title="Error">
            <div>
              <p>{error || 'Build not found'}</p>
              {actualBuildId && (
                <div className="pf-u-mt-md">
                  <p><strong>Build ID:</strong> {actualBuildId}</p>
                </div>
              )}
              <div className="pf-u-mt-md pf-u-font-size-sm pf-u-color-400">
                <p><strong>Path:</strong> {location.pathname}</p>
                <p><strong>Search:</strong> {location.search || '(none)'}</p>
                <p><strong>State:</strong> {location.state ? JSON.stringify(location.state) : '(none)'}</p>
              </div>
            </div>
          </Alert>
          <div className="pf-u-mt-md">
            <Button variant="primary" icon={<ArrowLeftIcon />} onClick={() => history.push('/rpm-builder')}>
              Back to RPM Builder
            </Button>
          </div>
        </PageSection>
      </>
    );
  }

  const buildConfig = buildJob.spec.buildConfig;
  const status = buildJob.status?.phase || 'Pending';
  const startTime = buildJob.status?.startTime;
  const completionTime = buildJob.status?.completionTime;

  return (
    <>
      <Helmet>
        <title>Build Details - {buildConfig?.name || 'RPM Builder'}</title>
      </Helmet>

      <PageSection>
        <div className="pf-u-display-flex pf-u-align-items-center pf-u-mb-lg">
          <Button
            variant="plain"
            icon={<ArrowLeftIcon />}
            onClick={() => history.push('/rpm-builder')}
            className="pf-u-mr-md"
          >
            Back
          </Button>
          <Title headingLevel="h1" size="2xl">
            Build Details
          </Title>
        </div>

        {status === 'Running' && (
          <Alert variant={AlertVariant.info} title="Build in Progress" className="pf-u-mb-lg">
            <div className="pf-u-mt-sm">
              <Progress value={undefined} size={ProgressSize.sm} />
            </div>
          </Alert>
        )}

        <Grid hasGutter>
          <GridItem span={8}>
            {/* Build Status Card */}
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
                      {getStatusBadge(status)}
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
                  <DescriptionListGroup>
                    <DescriptionListTerm>Build ID</DescriptionListTerm>
                    <DescriptionListDescription>
                      {buildJob.metadata.labels['rpm-builder.io/build-id']}
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

            {/* Package Information Card */}
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

            {/* Source Configuration Card */}
            <Card className="pf-u-mb-md">
              <CardTitle>
                <div className="pf-u-display-flex pf-u-align-items-center">
                  {buildConfig?.sourceType === 'git' ? (
                    <CodeBranchIcon className="pf-u-mr-sm" />
                  ) : (
                    <UploadIcon className="pf-u-mr-sm" />
                  )}
                  Source Configuration
                </div>
              </CardTitle>
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

            {/* Target System Card */}
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
          </GridItem>

          <GridItem span={4}>
            {/* Dependencies Card */}
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

            {/* Build Options Card */}
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

            {/* Actions Card */}
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
                  <Divider className="pf-u-my-sm" />
                  <Button
                    variant="primary"
                    icon={<ArrowLeftIcon />}
                    onClick={() => history.push('/rpm-builder')}
                  >
                    Back to RPM Builder
                  </Button>
                </div>
              </CardBody>
            </Card>
          </GridItem>
        </Grid>
      </PageSection>
    </>
  );
}

