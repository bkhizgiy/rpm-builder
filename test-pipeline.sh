#!/bin/bash
set -e

# RPM Builder Pipeline Test Script
# This script creates a test PipelineRun to verify ASIL compliance features

echo "========================================"
echo "RPM Builder - Pipeline Test"
echo "========================================"
echo ""

# Get current namespace
NAMESPACE=$(oc project -q)
echo "Testing in namespace: $NAMESPACE"
echo ""

# Generate unique build ID
BUILD_ID="test-$(date +%s)"
echo "Build ID: $BUILD_ID"
echo ""

# Create a simple test source file
echo "Creating test source files..."
mkdir -p /tmp/rpm-test-${BUILD_ID}

cat > /tmp/rpm-test-${BUILD_ID}/hello.c << 'EOF'
#include <stdio.h>
#include <stdlib.h>

/* Simple test program for ASIL RPM build */
int main(int argc, char *argv[]) {
    printf("Hello from ASIL RPM Builder!\n");
    printf("This is a test package.\n");
    return 0;
}
EOF

cat > /tmp/rpm-test-${BUILD_ID}/Makefile << 'EOF'
CC=gcc
CFLAGS=-Wall -Wextra
PREFIX=/usr

all: hello

hello: hello.c
	$(CC) $(CFLAGS) -o hello hello.c

install: hello
	mkdir -p $(DESTDIR)$(PREFIX)/bin
	install -m 0755 hello $(DESTDIR)$(PREFIX)/bin/

clean:
	rm -f hello

test:
	@echo "Running tests..."
	./hello
	@echo "Tests passed!"

.PHONY: all install clean test
EOF

echo "✓ Test source files created"
echo ""

# Create ConfigMap with source files
echo "Creating ConfigMap with source files..."

oc create configmap rpm-build-files-${BUILD_ID}-0 \
  --from-file=hello.c=/tmp/rpm-test-${BUILD_ID}/hello.c \
  --from-file=Makefile=/tmp/rpm-test-${BUILD_ID}/Makefile \
  --dry-run=client -o yaml | oc apply -f -

echo "✓ ConfigMap created"
echo ""

# Create empty build config ConfigMap (no custom spec file)
echo "Creating build config ConfigMap..."

oc create configmap rpm-build-config-${BUILD_ID} \
  --from-literal=placeholder=empty \
  --dry-run=client -o yaml | oc apply -f -

echo "✓ Build config ConfigMap created"
echo ""

# Create the PipelineRun
echo "Creating PipelineRun..."
echo ""

cat <<EOF | oc create -f -
apiVersion: tekton.dev/v1beta1
kind: PipelineRun
metadata:
  generateName: rpm-build-test-
  labels:
    rpm-builder.io/test: "true"
    rpm-builder.io/build-id: "${BUILD_ID}"
spec:
  pipelineRef:
    name: rpm-build-pipeline
  params:
    - name: package-name
      value: "hello-asil"
    - name: package-version
      value: "1.0.0"
    - name: target-os
      value: "quay.io/centos-sig-automotive/autosd:latest"
    - name: architecture
      value: "x86_64"
    - name: build-id
      value: "${BUILD_ID}"
    - name: source-type
      value: "upload"
    - name: git-repository
      value: ""
    - name: git-branch
      value: "main"
    - name: dependencies
      value: "gcc,make"
    - name: build-options
      value: ""
    - name: asil-level
      value: "uncertified"
    - name: safety-partition
      value: "non-safety"
    - name: enable-static-analysis
      value: "false"
    - name: enable-unit-tests
      value: "false"
  serviceAccountName: rpm-builder-sa
  workspaces:
    - name: source-workspace
      volumeClaimTemplate:
        spec:
          accessModes:
            - ReadWriteOnce
          resources:
            requests:
              storage: 1Gi
EOF

echo ""
echo "✓ PipelineRun created!"
echo ""

# Get the PipelineRun name
sleep 2
PIPELINERUN=$(oc get pipelinerun -l rpm-builder.io/build-id=${BUILD_ID} -o jsonpath='{.items[0].metadata.name}')

echo "========================================"
echo "Pipeline Test Started"
echo "========================================"
echo ""
echo "PipelineRun Name: $PIPELINERUN"
echo "Build ID: $BUILD_ID"
echo ""
echo "Monitor the pipeline with:"
echo "  oc get pipelinerun $PIPELINERUN -w"
echo ""
echo "View logs with:"
echo "  tkn pipelinerun logs $PIPELINERUN -f"
echo ""
echo "Or in the OpenShift Console:"
echo "  http://localhost:9000/k8s/ns/${NAMESPACE}/tekton.dev~v1beta1~PipelineRun/${PIPELINERUN}"
echo ""
echo "========================================"
echo ""

# Watch the pipeline
echo "Watching pipeline execution (Ctrl+C to stop watching)..."
echo ""
oc get pipelinerun $PIPELINERUN -w

