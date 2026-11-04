# Nibfin Action

Thin Node 24 GitHub Action that verifies and invokes an administrator-installed
Nibfin Core. Core owns lifecycle, authorization, isolation and delivery policy.

This is development integration for manual [Bootstrap #1](https://github.com/taco3064/nibfin-act/issues/1),
not a published Action release. `core-source.json` pins one candidate's repository,
commit, archive and source manifest. Its provenance is Core
[CI run 41836353049](https://github.com/taco3064/nibfin-core/actions/runs/41836353049).
A candidate can be tested before publication; formal Action publication still
requires the actual verified Core Release specified by the Issue.

## Invocation

Inputs `issue-number` (positive safe integer string) and `stage` (bounded lowercase
name) are locators, never grants. Core validates the actual stage and authority.
Outputs are `status`, diagnostic `code`, and `receipt-hash` for a completed stage.
Completed, denied and Pending map to process exits 0, 1 and 2. A completed stage
does not mean a completed Issue. Unknown execution stays Pending without retry.

The adapter uses the absolute executable of GitHub's Node 24 Action runtime,
not a host-global Node installation. It invokes only the fixed
`/opt/nibfin/core/bin/nibfin-core.mjs` entry, without a shell, with these arguments:

```text
verify <installation> <action-pin>
stage <issue-number> <stage>
```

Core's own verifier checks the installed manifest and file contents before stage
execution. The second command runs only after successful verification. No input,
Issue field or environment option can select an executable, installation, module,
Docker endpoint, credential file or policy. Raw Core output is not logged.
After verification, stage transport uses Core's public bounded `command` helper
at that fixed installation, with only its native 0/1/2 exits accepted for decoding.
Timeouts and retained cross-identity pipes remain Pending; caller exit never
proves privileged Writer termination. Verification itself stays read-only and
uses no native context or credentials.

The current binding consumes Core's existing `single-host-linux-v1` backend:
fixed root-owned installation and `/etc/nibfin/host.json`, administrator adoption,
an unprivileged dedicated Runner account, and all Core isolation requirements.
The Action does not install that backend or grant authority. Daily development
can use any OS; protected Windows/macOS Docker backends are not verified here.
See [the caller contract and example](docs/caller-contract.md).

## Development and evidence

Use Node `24.22.1` and npm `11.9.0`:

```sh
npm ci --ignore-scripts
npm run build
npm test
```

No runtime npm dependency or generated bundle is needed. `action.yml` points to
shipped source. Checks enforce metadata, syntax and the 90-character/1,000-line
source limits. Tests exercise accepted result forwarding, native-context
filtering, denied calls, stale sources, missing installation, malformed results,
exceptions and no retries, with controlled process fixtures.

CI additionally builds the exact Core candidate, checks both producer artifact
digests, installs through Core's real API, rejects tampering and invokes the real
Action/CLI on a disposable GitHub-hosted VM. Contract tests use the installed
Core's real stage executor with its pinned provider/caller/isolation fixtures and
a synthetic Agent. They exercise permitted Shape, rejected authority changes and
Pending, then check Action result forwarding. These are controlled contracts,
not live GitHub authorization, real Agent execution or external delivery E2E.

Under the current Issue and Proposal, reviewed full-commit candidates are used
for the first authorized external E2E. Only after it succeeds may the Owner
authorize matching Core/Action/CLI Releases and Marketplace publication, followed
by independent clean installation/read-back. No Release is needed to integrate
or run that first E2E; publication cannot replace the E2E.

See [Bootstrap status](docs/bootstrap-status.md) for publication prerequisites.
