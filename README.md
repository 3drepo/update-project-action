# Any issue labeller
A javascript action that takes in an issue number and a label and does the labelling on demand

## Inputs

### `github-token`

**Required** The repository token, i.e. `secrets.GITHUB_TOKEN`

### `label`

**Required** The label name to apply to an issue

### `issue-number`

**Required** The issue number to apply the label to


### Example Workflow
```
on:
  push:
    branches:
      - master

jobs:
  applyLabel:
    runs-on: ubuntu-latest
    name: A job to apply label onto an issue
    steps:
      - uses: carmenfan/any-issue-labeller@v1.0
        with:
          issue-number: 10
          label: "invalid"
          github-token: ${{ secrets.GITHUB_TOKEN }}

```
