###### This is coming from our common.mk in the FramerStudio repo
# Path of this file, includes trailing slash
# NOTE: Should not be used in files that import this one, use BASE_DIR instead.
__DIR__ := $(dir $(lastword $(MAKEFILE_LIST)))


# Root path of the repository, absolute (no slash suffix)
BASE_DIR := $(abspath $(__DIR__))


# Include node modules in the path
PATH := $(CURDIR)/node_modules/.bin:$(PATH)

# Use a modern shell
SHELL := /bin/bash

# Default target is build
default: build

# Cleaning removes build dir and node_modules. Use double colon so it can be extended.
clean::
	rm -rf build
	find . -name 'node_modules' -type d -prune -exec rm -rf '{}' +
	git clean -fdX .

# Use a mutex file so multiple Source dirs can be built in parallel.
WORKTREE_NODE_MODULES := $(BASE_DIR)/node_modules/.yarn-state.yml
WORKSPACE_NODE_MODULES := node_modules

# Update node modules if package.json is newer than node_modules or yarn lockfile
$(WORKTREE_NODE_MODULES) $(WORKSPACE_NODE_MODULES): $(BASE_DIR)/yarn.lock package.json packages/framer-motion/package.json
	yarn install
	touch $@

# Install requirements, this should usually be the first dependency of build.
# Only install the worktree (root) node_modules by default. If a package has it‘s own
# node_modules, include a rule that says `bootstrap:: $(WORKSPACE_NODE_MODULES)` in the
# Makefile
bootstrap:: $(WORKTREE_NODE_MODULES)

######

# The location to gather test reports
TEST_REPORT_PATH := $(if $(CIRCLE_TEST_REPORTS),$(CIRCLE_TEST_REPORTS),$(CURDIR)/test_reports)

build: bootstrap
	yarn build

watch: bootstrap
	cd packages/framer-motion && yarn watch

check-status:
	@BUILD_STATUS=$(shell gh api repos/motiondivision/motion/commits/$(shell git rev-parse HEAD)/status | jq -r .state); \
	echo "Build $$BUILD_STATUS"; \
	if [ "$$BUILD_STATUS" != "success" ]; then \
	 BUILD_URL=$(shell gh api repos/motiondivision/motion/commits/$(shell git rev-parse HEAD)/status | jq -r .statuses[0].target_url); \
	 echo "Build URL: $$BUILD_URL"; exit 1; \
	fi;


test-watch: bootstrap
	if test -f coverage/lcov-report/index.html; then \
	 open coverage/lcov-report/index.html; \
	fi;
	yarn test-watch

bump:
	npm version patch

test: bootstrap
	yarn test

test-mkdir:
	mkdir -p $(TEST_REPORT_PATH)

test-jest: export JEST_JUNIT_OUTPUT ?= test_reports/framer-motion.xml
test-jest: bootstrap test-mkdir
	echo $(JEST_JUNIT_OUTPUT)
	yarn test

test-react: build test-mkdir
	yarn start-server-and-test "yarn dev-server" http://localhost:9990 "cd packages/framer-motion && cypress run --headless $(if $(CI), --spec $(shell cd packages/framer-motion && circleci tests glob "cypress/integration/*.ts" | circleci tests split), --reporter spec)"

test-react-19: build test-mkdir
	yarn start-server-and-test "yarn dev-server" http://localhost:9991 "cd packages/framer-motion && cypress run --config-file=cypress.react-19.json --headless $(if $(CI), --spec $(shell cd packages/framer-motion && circleci tests glob "cypress/integration/*.ts" | circleci tests split), --reporter spec)"

test-html: build test-mkdir
	node dev/inc/collect-html-tests.js
	yarn start-server-and-test "yarn dev-server" http://localhost:8000 "cd packages/framer-motion && cypress run --config-file=cypress.html.json $(if $(CI), --config video=false, --reporter spec)"

test-nextjs: build test-mkdir
	yarn start-server-and-test "yarn dev-server || true" http://localhost:3000 "cd packages/framer-motion && cypress run --headless --config-file=cypress.rsc.json $(if $(CI), --config video=false, --reporter spec)"

test-e2e: test-nextjs test-html test-react test-react-19
	yarn test-playwright

test-single: build test-mkdir
	yarn start-server-and-test "yarn dev-server" http://localhost:9990 "cd packages/framer-motion && cypress run --headless --spec cypress/integration/drag.ts"


lint: bootstrap
	yarn lint

pretty: bootstrap
	prettier --write */**/*.tsx */**/*.ts

.PHONY: dev lint test-e2e
