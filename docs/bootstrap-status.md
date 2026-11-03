# Manual Action Bootstrap status

Authority: [nibfin-act #1](https://github.com/taco3064/nibfin-act/issues/1).
This records manual implementation, not protected Nibfin delivery or acceptance.

| Workstream | Implementation | Remaining acceptance |
| --- | --- | --- |
| B0 | Reviewed seed, PR #4 CI foundation and enforced app-bound required `verify`; zero human Required Approvals. | Every subsequent change needs independent Agent review and current CI. |
| A01 | One pinned Node/npm root, lockfile, metadata and shipped source; no runtime dependencies. | Final source/CI read-back. |
| A02 | Fixed candidate source pin; Core CLI source verification followed by stage invocation; typed locators and native-context allowlist; truthful completed/denied/Pending results. | Rebind and verify the actual released producer before publication. |
| A03 | Metadata, output, credential boundary and negative contract tests; real candidate package/install/verify and actual Action-to-CLI denial in CI; administrator-adopted caller example. | Released-Core compatibility. Live protected host execution is separate evidence, excluded from this Issue's external E2E requirement. |
| A04 | Immutable pin and release verification procedure documented. | Actual Core Release, final reviewed binding/CI, formal Action/Marketplace publication and source/publisher read-back. |

Development uses the exact candidate in `core-source.json`, independently checked
against Core CI run 41681863006 and its producer artifact. This is not a formal
Core Release. The GitHub Releases API returned no Core releases when the adapter
was bound. No Action release, tag or Marketplace listing is created from that
candidate. The absent Release does not prevent development integration.

Before publication:

1. Read the actual Core Release, publisher, immutable source tag, asset digests
   and producing CI. Verify the source manifest independently.
2. Update the single producer pin through a protected, independently reviewed PR;
   recheck CLI/input/output compatibility and current-head CI against that pin.
3. Publish the reviewed Action commit through a native tag/Release and complete
   GitHub's Marketplace publication process. Never move a released immutable tag.
4. Read back tag object/commit, Release identity/publisher, `action.yml`, producer
   pin and downloadable assets/digests if present. Record actual native URLs.

No labels or native dependencies are changed. The manual Issue stays open for
Owner acceptance. Core #1 is not reopened or modified by this work.
