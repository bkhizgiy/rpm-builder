# Quick Start - Local Development

**TL;DR** - Get up and running in 3 steps:

## 1. Deploy Backend to Cluster

```bash
# Make sure you're connected to your cluster and in the right namespace
oc login <your-cluster-url>
oc project <your-namespace>

# Deploy Tekton pipelines and RBAC
./deploy-local-dev.sh
```

## 2. Start Local Development

**Terminal 1** - Plugin Dev Server:
```bash
npm install  # first time only
npm start    # starts on http://localhost:9001
```

**Terminal 2** - Console Bridge:
```bash
./start-console.sh  # starts on http://localhost:9000
```

## 3. Access & Test

Open browser to: **http://localhost:9000**

Navigate to: **Builds** → **RPM Builder**

## Cleanup When Done

```bash
./cleanup-local-dev.sh
```

---

## What Gets Deployed to Cluster?

✅ Tekton Pipeline (`rpm-build-pipeline`)  
✅ 6 Tekton Tasks (prepare, fetch, install, generate, build, publish)  
✅ ServiceAccount (`rpm-builder-sa`)  
✅ RBAC (Role, RoleBinding, ClusterRole, ClusterRoleBinding)

**All resources are labeled with:**
- `rpm-builder.io/dev-mode: true`
- `rpm-builder.io/developer: <your-username>`

## What Runs Locally?

🖥️ **Plugin Dev Server** (port 9001) - Your React UI code  
🖥️ **Console Bridge** (port 9000) - OpenShift Console in a container

## Architecture Diagram

```
┌─────────────────────────────────────────────────────┐
│ Your Machine                                        │
│                                                     │
│  ┌──────────────┐         ┌──────────────┐        │
│  │   Browser    │────────▶│   Console    │        │
│  │ localhost:   │         │   Bridge     │        │
│  │    9000      │         │ (container)  │        │
│  └──────────────┘         └──────┬───────┘        │
│                                   │                 │
│                                   │                 │
│                            ┌──────▼───────┐        │
│                            │   Plugin     │        │
│                            │  Dev Server  │        │
│                            │  (webpack)   │        │
│                            │   :9001      │        │
│                            └──────┬───────┘        │
└────────────────────────────────────┼───────────────┘
                                     │
                                     │ API calls via k8s proxy
                                     │
                        ┌────────────▼──────────────┐
                        │  OpenShift Cluster        │
                        │                           │
                        │  ┌─────────────────────┐ │
                        │  │ Your Namespace      │ │
                        │  │                     │ │
                        │  │ • Tekton Pipelines │ │
                        │  │ • PipelineRuns     │ │
                        │  │ • ServiceAccount   │ │
                        │  │ • RBAC             │ │
                        │  └─────────────────────┘ │
                        └───────────────────────────┘
```

## FAQ

**Q: Will I interfere with others on the same cluster?**  
A: No, as long as you use your own namespace. All builds run in your namespace only.

**Q: Do I need to deploy the plugin to the cluster?**  
A: No! For local development, only the backend (pipelines) needs to be deployed. The UI runs locally.

**Q: Can I test actual RPM builds?**  
A: Yes! When you submit a build through the UI, it creates a real PipelineRun in your cluster namespace.

**Q: How do I see build logs?**  
A: Through the UI, or via CLI:
```bash
oc get pipelineruns
oc logs -f <pipelinerun-pod-name>
```

**Q: What if I need to update the pipeline?**  
A: Edit `k8s/tekton-pipeline.yaml` and run `./deploy-local-dev.sh` again.

**Q: How do I stop everything?**  
A: 
- Stop webpack dev server: `Ctrl+C` in Terminal 1
- Stop console bridge: `Ctrl+C` in Terminal 2
- Clean up cluster resources: `./cleanup-local-dev.sh`

## Resource Usage

Typical resource usage per build:
- **PVC**: ~1-1.5 GB (2 PVCs per build: source + output)
- **CPU**: Varies by build complexity
- **Memory**: ~500MB - 2GB depending on build

Monitor your usage:
```bash
oc get pvc
oc describe resourcequota
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Pipeline not found" | Run `oc get pipeline rpm-build-pipeline` to verify deployment |
| "Insufficient permissions" | Check RBAC: `oc auth can-i create pipelineruns` |
| Console can't connect | Verify webpack dev server is on port 9001 |
| Build fails to start | Check Tekton is installed: `oc get operators \| grep tekton` |
| Port already in use | Kill process: `lsof -ti:9001 \| xargs kill -9` |

## More Help

📖 Full guide: [LOCAL_DEVELOPMENT.md](LOCAL_DEVELOPMENT.md)  
📖 Usage guide: [USAGE.md](USAGE.md)  
📖 Project docs: [README.md](README.md)

---

**Ready to start?** Run `./deploy-local-dev.sh` 🚀

