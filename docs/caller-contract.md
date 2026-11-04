# Caller and permission contract

This step adapter does not schedule Runners or resolve Issue wakeups. A direct
`workflow_dispatch` caller is supported by the pinned Core CLI when independently
adopted by the host administrator. Core's `resolve-wake` reusable-workflow path is
a different entry; do not claim this adapter implements its automatic fanout.

Before use, the administrator must adopt the exact workflow source, job, Runner,
member, Issue, Core source, installation and isolation configuration according to
the pinned Core host-launcher contract. The native direct-workflow/OIDC identity
must match that adoption. A workflow input or Runner label does not grant access.
Do not attach this privileged Runner to untrusted PR/fork jobs or execute a
candidate checkout before the trusted Action. GitHub-hosted CI in this repository
uses no adopted host, production credentials or administrative token.

Illustrative caller (replace every placeholder through reviewed configuration;
this is not an operational deployment or a released Action reference):

```yaml
name: Adopted Nibfin stage
on:
  workflow_dispatch:
    inputs:
      issue-number:
        required: true
        type: string
      stage:
        required: true
        type: string
permissions:
  contents: read
  id-token: write
jobs:
  adopted-stage:
    runs-on: [self-hosted, nibfin-user-REPLACE_WITH_ADOPTED_MEMBER_ID]
    steps:
      - uses: taco3064/nibfin-act@REPLACE_WITH_REVIEWED_40_HEX_ACTION_COMMIT
        with:
          issue-number: ${{ inputs.issue-number }}
          stage: ${{ inputs.stage }}
```

No checkout of Issue/PR-controlled code is needed. Pin the Action to the reviewed
40-hex commit, not `main` or a movable version alias. Adopt the caller's exact
source before dispatch; a stale revision must be refused by Core. Do not turn the
example into `pull_request_target`, or use fork-controlled workflow/checkout code
on the trusted host. See GitHub's [Runner security guidance](https://docs.github.com/en/actions/how-tos/manage-runners/self-hosted-runners/add-runners).

The Action passes only native repository/run/attempt/event/Runner identity hints
and OIDC request URL/token to Core stage execution. Core reads GitHub and verifies
the signed identity itself; hints do not authenticate anything. Source verification
receives none of those credentials. `GITHUB_TOKEN`, `NODE_OPTIONS`, model logins,
Docker variables and arbitrary environment overrides are not forwarded. Core's
administrator-controlled token and model authorization remain in its trusted host
boundary; never put them in inputs or Action outputs.

Missing OIDC permission, wrong member/repository/workflow/Runner, stale source,
unadopted Issue, unresolved execution or insufficient isolation must fail in Core.
The adapter preserves a valid denied/Pending outcome and never retries. Controlled
tests exercise this forwarding. Installed-Core contract tests additionally use
Core's pinned synthetic provider/caller/isolation fixtures and a synthetic Agent
to exercise permitted Shape, changed Scope, revoked permission, foreign repository,
fork, stale caller and unknown execution. No native authorization or host adoption
is established by those fixtures. The actual CI denial demonstrates the real CLI
boundary without creating host authority configuration.

Status/code/receipt outputs follow GitHub's [Action metadata contract](https://docs.github.com/en/actions/reference/workflows-and-actions/metadata-syntax).
Only bounded diagnostic fields and a validated receipt hash can reach them.
