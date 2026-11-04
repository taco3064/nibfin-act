# Manual Action Bootstrap status

Authority: [nibfin-act #1](https://github.com/taco3064/nibfin-act/issues/1).
This records manual implementation, not protected Nibfin delivery or acceptance.

| Workstream | Implementation | Remaining acceptance |
| --- | --- | --- |
| B0 | Reviewed seed, PR #4 CI foundation and enforced app-bound required `verify`; zero human Required Approvals. | Every subsequent change needs independent Agent review and current CI. |
| A01 | One pinned Node/npm root, lockfile, metadata and shipped source; no runtime dependencies; PR #6 reviewed and main CI 41740330838 passed. | Later changes need current CI and review. |
| A02 | Fixed candidate source pin; Core CLI source verification followed by stage invocation; typed locators and native-context allowlist; truthful completed/denied/Pending results. | Rebind and verify the actual released producer before publication. |
| A03 | Metadata/output/credential tests; installed Core admission contracts with synthetic provider/Agent fixtures; real candidate package/install/verify and Action-to-CLI denial; adopted caller example. | Native host/Agent authorization and full external E2E remain separate evidence. Released compatibility is checked after E2E. |
| A04 | Immutable pin and release verification procedure documented. | First external protected E2E, Owner publication authorization, compatible Core Release, reviewed binding/CI, Action/Marketplace publication and source/publisher read-back. |

Development uses the exact candidate in `core-source.json`, independently checked
against Core CI run 41817107961 and its producer artifact. This is not a formal
Core Release. The GitHub Releases API returned no Core releases when the adapter
was bound. No Action release, tag or Marketplace listing is created from that
candidate. The absent Release does not prevent candidate integration, installation
or the first authorized external E2E. These are prerequisites to formal Release,
not consumers that must wait for it.

Before publication:

1. Complete the separately owned first external protected E2E using the reviewed,
   independently installed full-commit Core/Action/CLI candidates. Preserve its
   source identity and actual provider results. Obtain Owner publication authority.
2. Read the actual Core Release, publisher, immutable source tag, asset digests
   and producing CI. Verify the source manifest independently.
3. Update the single producer pin through a protected, independently reviewed PR;
   recheck CLI/input/output compatibility and current-head CI against that pin.
   A matching pin needs no artificial change; material source/contract differences
   require corresponding integration/security revalidation.
4. Publish the reviewed Action commit through a native tag/Release and complete
   GitHub's Marketplace publication process. Never move a released immutable tag.
5. Read back tag object/commit, Release identity/publisher, `action.yml`, producer
   pin and downloadable assets/digests if present. Record actual native URLs.
   Independently clean-install the formal sources and compare them to the tested
   candidates when later distribution is authorized. Owner-approved Phase 1 may
   use the validated immutable candidates after actual external E2E and cutover.

No labels or native dependencies are changed. The manual Issue stays open for
Owner acceptance. Core #1 is not reopened or modified by this work.
