# Manual Action Bootstrap status

Authority for this implementation is the current
[nibfin-act #1](https://github.com/taco3064/nibfin-act/issues/1).
This document does not amend Scope or claim protected Nibfin delivery.

| Workstream | Implemented evidence | Still incomplete |
| --- | --- | --- |
| B0 | Independently reviewed README seed `13156f9d4872a053d268ef82e8904f8f28554782`; PR #4 establishes real read-only CI and app-bound required verify under enforce-admins PR protection, zero human Approvals. | Later changes still require current CI and independent review. |
| A01 | One pinned Node/npm root, lockfile, JS Action metadata and shipped source entry, build/source checks and negative metadata tests. | No operational Core capability follows from packaging. |
| A02 | Fixture-tested internal forwarding to the existing Core v1 transport; exact request and actual completed/denied/Pending results; no alternative caller, command or policy implementation. | No released producer is bound; actual context/installation integration must use the released C14/C16 contract. |
| A03 | Entrypoint/metadata validation, no runtime npm dependency, denial/unknown-result tests and credential-safe refusal of the unbound entry. | Real released-Core provenance/permission compatibility and final workflow examples. |
| A04 | No release action is attempted while its required producer is missing. | Verified Core release, reviewed binding, source/CI, formal Action/Marketplace publication and native read-back. |

The actual GitHub Core Releases API returned no published releases when this
work began. Current Core source describes interface v1 and is reference evidence
for the fixture seam only. A source commit, candidate version string or manually
closed Bootstrap cannot substitute for the verified producer release required
by this Issue. Action implementation does not reopen or alter Core #1.

The real Action entry is deliberately non-operational and fails with
`CORE_RELEASE_UNAVAILABLE`. There is no user configuration that can turn the
fixture dependency into a production Core. The test seam accepts dependencies
only as trusted in-process code, never from Action JSON or environment paths.

Before publication, replace this temporary non-operational entry through a
reviewed implementation that binds the actual released Core. Verify the real
public artifact, declared input/output compatibility and native publisher/source
identity. Do not publish this candidate merely to satisfy a release checklist.

No labels or native dependencies are changed. This manual tracker remains open
for Owner acceptance; source tests, protected CI and publication are distinct
evidence levels, and none alone proves protected delivery or external E2E.
