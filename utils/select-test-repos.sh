#!/usr/bin/env bash

# Usage:
#   ./select-test-repos.sh
#       Lists all "ubiquity-os-demo-" repos (dry run by default).
#
#   ./select-test-repos.sh --run gh repo delete --yes
#       Actually executes "gh repo delete --yes <repoName>" on each matching repo.
#
#     - You can put whatever you want after --run. For example:
#       ./select-test-repos.sh --run gh repo archive
#       ./select-test-repos.sh --run echo "Removing repo:"
#
# The script scans for any repo whose name starts with "ubiquity-os-demo-".

set -euo pipefail

DRY_RUN=true
COMMAND=()

# Check if the first argument is `--run`, then treat everything after that as the command to run.
if [[ $# -gt 0 && "$1" == "--run" ]]; then
  DRY_RUN=false
  shift
  # Everything after --run becomes our command array.
  COMMAND=("$@")
fi

# Get all repos whose names start with 'test-repo-'.
# -L 200: up to 200 repos in the result; tweak if needed
repos=$(gh repo list -L 200 --json name,visibility,description \
  | jq -r '.[] | select(.name | startswith("ubiquity-os-demo-"))
              | "\(.name)\t\(.visibility)\t\(.description)"')

if [ -z "$repos" ]; then
  echo "No test repos found."
  exit 0
fi

echo "Found test repos:"
echo "$repos"
echo

if [ "$DRY_RUN" = true ]; then
  echo "Dry run: no command executed."
else
  while IFS=$'\t' read -r repoName repoVis repoDesc; do
    echo "Running command on $repoName..."
    # If COMMAND is something like: ["gh", "repo", "delete", "--yes"]
    # This will effectively run: gh repo delete --yes test-repo-foo
    "${COMMAND[@]}" "$repoName"
  done <<< "$repos"
fi
