# Nibfin Action

Thin GitHub Action adapter for the Nibfin Core.

Manual [Bootstrap #1](https://github.com/taco3064/nibfin-act/issues/1) is in
progress. This repository is not a released or operational delivery Action.

## Current implementation

- One Node 24 JavaScript Action project. No Docker action, container job,
  Linux workstation requirement or OS installer is introduced.
- `action.yml` resolves the shipped `src/main.mjs`; no runtime npm dependencies
  or generated bundle are needed. The YAML parser is a pinned dev dependency.
- The internal forwarding seam passes a stage request unchanged to Core's
  existing v1 `runStageInput(input, executor)` transport. Core owns request
  interpretation and all live native authorization. Fixtures test this seam;
  they do not establish released-Core compatibility.
- Completed, denied and Pending results map to exit codes 0, 1 and 2. A completed
  stage is not a completed Issue. Exceptions or invalid outcomes cannot become
  success, are not automatically retried, and do not disclose raw error text.

**Core has no verified public Release available at this implementation step.**
The actual Action entry therefore returns `denied` / `CORE_RELEASE_UNAVAILABLE`
and fails. It does not load an input-selected Core, fetch current main, accept
token/module/socket overrides or bind a candidate as a released producer.
There is intentionally no successful production usage example yet.

## Development

Use Node `24.22.1` and npm `11.9.0`:

```sh
npm ci --ignore-scripts
npm run build
npm test
```

`npm run verify` checks pinned configuration, metadata, source syntax, the
90-character/1,000-line source limits, entrypoint presence and tests.
Tests cover the actual unreleased-entry refusal and fixture-only forwarding,
Core denials, malformed results, exceptions and no blind retries.

## Inputs, outputs and trust boundary

The provisional `request` string follows the current Core v1 stage transport:
`{"schemaVersion":1,"stage":"shape"}`. It supplies no authorization. The actual
released contract must be rechecked before binding a producer. Outputs are
`status` and bounded diagnostic `code`; no credentials or exception text are
written to Action outputs.

Actions context, Issue content and Runner labels do not grant permission.
Protected workflow/source adoption, native identity, credentials, original
Scope, dependencies, roles, Candidate, CI, Merge and recovery remain Core-owned.
The Action does not reconstruct an authority record from an event. A future
verified installed Core must read the actual native context itself.

GitHub owns events and Runner scheduling. This step cannot schedule a new
Runner job or replace the Core reusable workflow. The JS packaging format does
not establish Windows/macOS/Linux protected execution support.

## Remaining work

See [the Bootstrap status](docs/bootstrap-status.md). A02's real producer binding
and A03's released-Core compatibility remain incomplete. A04 publication requires
an actual verified Core release, reviewed Action binding, current-source CI,
and native tag/source/publisher read-back. No Action release or Marketplace
listing has been published; fixture tests and CI do not prove external E2E.
