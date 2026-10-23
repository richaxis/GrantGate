"""Direct-mode tests for GrantGate. Run: python -m pytest tests/direct -v (needs gltest)."""
import ast
import json

ONE = 10**18
FUNDER = bytes.fromhex("11" * 20)
GRANTEE = bytes.fromhex("22" * 20)
OTHER = bytes.fromhex("33" * 20)
SDK = "v0.3.0"
H = 3600
DELIVERY, EVIDENCE, REVIEW = 30 * 24 * H, 14 * 24 * H, 14 * 24 * H
T0 = "2026-10-01T00:00:00Z"
BODY_A = "A public demo with a working API and documentation is live here."
BODY_B = "A different revision of the page that validators fetched with other bytes."


def hexaddr(b): return "0x" + b.hex()
def deploy(direct_deploy): return direct_deploy("contracts/grantgate.py", DELIVERY, EVIDENCE, REVIEW, sdk_version=SDK)
def snap(c): return json.loads(c.snapshot())
def ms(c, i=0): return snap(c)["milestones"][i]
def milestones(*amounts): return json.dumps([{"title": f"M{i+1}", "criteria": "Public demo with a working API", "amount": str(a)} for i, a in enumerate(amounts)])


def create(c, vm, *amounts):
    vm.warp(T0); vm.value = sum(amounts)
    with vm.prank(FUNDER): gid = c.create_grant("Open data grant", "Build it", hexaddr(GRANTEE), milestones(*amounts))
    vm.value = 0
    return gid


def mock_verdict(vm, outcome, pct, body=BODY_A):
    vm.clear_mocks()
    vm.mock_web(r"https://example\.com", {"status": 200, "body": body})
    vm.mock_llm(r"GrantGate's milestone adjudicator", json.dumps({"outcome": outcome, "payout_pct": pct, "reasoning": "ok"}))


def submit(c, vm, mid=1):
    with vm.prank(GRANTEE): c.submit_milestone(mid, "https://example.com/proof", "done")


def reclaim(c, vm, mid=1, who=FUNDER):
    with vm.prank(who): c.reclaim_expired(mid)


# ---------------------------------------------------------------- basics
def test_create_requires_exact_funding(direct_vm, direct_deploy):
    c = deploy(direct_deploy); direct_vm.warp(T0); direct_vm.value = ONE
    with direct_vm.expect_revert("amounts must equal"):
        with direct_vm.prank(FUNDER): c.create_grant("t", "s", hexaddr(GRANTEE), milestones(ONE - 1))


def test_create_sets_deadlines_and_windows(direct_vm, direct_deploy):
    c = deploy(direct_deploy); create(c, direct_vm, ONE, 2 * ONE)
    s = snap(c)
    assert s["grants"][0]["total"] == str(3 * ONE) and len(s["milestones"]) == 2
    assert all(m["deadline"] > 0 for m in s["milestones"]) and s["windows"]["review"] == REVIEW


def test_constructor_rejects_tiny_windows(direct_vm, direct_deploy):
    with direct_vm.expect_revert("between 1 hour and 365 days"):
        direct_deploy("contracts/grantgate.py", 10, EVIDENCE, REVIEW, sdk_version=SDK)


def test_only_grantee_can_submit(direct_vm, direct_deploy):
    c = deploy(direct_deploy); create(c, direct_vm, ONE)
    with direct_vm.expect_revert("grantee only"):
        with direct_vm.prank(OTHER): c.submit_milestone(1, "https://example.com/x", "")


# ------------------------------------------------------- payouts and bands
def test_met_pays_grantee_in_full_and_logs_history(direct_vm, direct_deploy):
    c = deploy(direct_deploy); create(c, direct_vm, ONE); submit(c, direct_vm); mock_verdict(direct_vm, "MET", 100)
    assert c.review_milestone(1) == "RELEASED"
    m = ms(c); assert m["paid"] == str(ONE) and snap(c)["grants"][0]["status"] == "COMPLETED"
    assert len(m["history"]) == 1 and m["history"][0]["outcome"] == "MET" and m["history"][0]["payout_pct"] == 100


def test_partial_band_splits_exactly(direct_vm, direct_deploy):
    c = deploy(direct_deploy); create(c, direct_vm, 10 * ONE); submit(c, direct_vm); mock_verdict(direct_vm, "PARTIALLY_MET", 50)
    assert c.review_milestone(1) == "PARTIAL"
    m = ms(c); assert m["paid"] == str(5 * ONE) and m["refunded"] == str(5 * ONE) and m["payout_pct"] == 50


def test_off_band_or_inconsistent_output_reverts_and_moves_nothing(direct_vm, direct_deploy):
    c = deploy(direct_deploy); create(c, direct_vm, ONE); submit(c, direct_vm)
    for outcome, pct in (("PARTIALLY_MET", 62), ("MET", 60), ("NOT_MET", 25)):
        mock_verdict(direct_vm, outcome, pct)
        with direct_vm.expect_revert("TRANSIENT"): c.review_milestone(1)
    assert ms(c)["status"] == "IN_REVIEW" and ms(c)["paid"] == "0"


def test_not_met_gets_two_evidence_rounds_then_refund(direct_vm, direct_deploy):
    c = deploy(direct_deploy); create(c, direct_vm, ONE); mock_verdict(direct_vm, "NOT_MET", 0)
    for expected in ("NEEDS_EVIDENCE", "NEEDS_EVIDENCE", "REJECTED"):
        submit(c, direct_vm); assert c.review_milestone(1) == expected
    assert ms(c)["refunded"] == str(ONE) and len(ms(c)["history"]) == 3


def test_commit_pinned_github_evidence_is_fetched_at_the_commit(direct_vm, direct_deploy):
    c = deploy(direct_deploy); create(c, direct_vm, ONE)
    sha = "a" * 40
    with direct_vm.prank(GRANTEE): c.submit_milestone(1, f"https://github.com/acme/geo/commit/{sha}", "")
    direct_vm.clear_mocks()
    direct_vm.mock_web(rf"https://raw\.githubusercontent\.com/acme/geo/{sha}/README\.md", {"status": 200, "body": BODY_A})
    direct_vm.mock_llm(r"GrantGate's milestone adjudicator", json.dumps({"outcome": "MET", "payout_pct": 100, "reasoning": "ok"}))
    assert c.review_milestone(1) == "RELEASED" and ms(c)["history"][0]["ref"] == sha


# ------------------------------------------------ escrow recovery (no lock)
def test_reclaim_before_deadline_reverts(direct_vm, direct_deploy):
    c = deploy(direct_deploy); create(c, direct_vm, ONE)
    direct_vm.warp("2026-10-15T00:00:00Z")
    with direct_vm.expect_revert("grace period is still running"): reclaim(c, direct_vm)


def test_only_funder_can_reclaim(direct_vm, direct_deploy):
    c = deploy(direct_deploy); create(c, direct_vm, ONE); direct_vm.warp("2026-12-31T00:00:00Z")
    with direct_vm.expect_revert("funder only"): reclaim(c, direct_vm, who=OTHER)


def test_abandoned_unstarted_milestone_is_refunded_after_delivery_window(direct_vm, direct_deploy):
    c = deploy(direct_deploy); create(c, direct_vm, ONE); direct_vm.warp("2026-11-05T00:00:00Z")
    reclaim(c, direct_vm)
    m = ms(c); assert m["status"] == "EXPIRED" and m["refunded"] == str(ONE) and snap(c)["grants"][0]["status"] == "COMPLETED"
    with direct_vm.expect_revert("already settled"): reclaim(c, direct_vm)


def test_grantee_cannot_submit_after_deadline(direct_vm, direct_deploy):
    c = deploy(direct_deploy); create(c, direct_vm, ONE); direct_vm.warp("2026-11-05T00:00:00Z")
    with direct_vm.expect_revert("deadline passed"): submit(c, direct_vm)


def test_missing_evidence_then_abandonment_is_refunded(direct_vm, direct_deploy):
    c = deploy(direct_deploy); create(c, direct_vm, ONE); submit(c, direct_vm); mock_verdict(direct_vm, "NEEDS_EVIDENCE", 0)
    assert c.review_milestone(1) == "NEEDS_EVIDENCE"
    direct_vm.warp("2026-10-10T00:00:00Z")
    with direct_vm.expect_revert("grace period is still running"): reclaim(c, direct_vm)
    direct_vm.warp("2026-10-20T00:00:00Z")      # grantee has not answered within the evidence window
    reclaim(c, direct_vm)
    assert ms(c)["status"] == "EXPIRED" and ms(c)["refunded"] == str(ONE)


def test_stalled_review_cannot_lock_funds(direct_vm, direct_deploy):
    c = deploy(direct_deploy); create(c, direct_vm, ONE); submit(c, direct_vm)
    direct_vm.clear_mocks()                      # no mocks: every review attempt hits a fetch failure
    with direct_vm.expect_revert("TRANSIENT"): c.review_milestone(1)
    assert ms(c)["status"] == "IN_REVIEW"
    direct_vm.warp("2026-10-10T00:00:00Z")
    with direct_vm.expect_revert("grace period is still running"): reclaim(c, direct_vm)
    direct_vm.warp("2026-10-20T00:00:00Z")       # review window passed with no successful review
    reclaim(c, direct_vm)
    assert ms(c)["status"] == "EXPIRED" and ms(c)["refunded"] == str(ONE)


# --------------------------------------- validators must agree on the payout
def parse_answer(text):
    try: return json.loads(text)
    except Exception: pass
    try:
        v = ast.literal_eval(text)
        return json.loads(bytes(v).decode("utf-8")) if isinstance(v, (bytes, bytearray)) else json.loads(str(v))
    except Exception: return None


def install_hook(vm):
    """Deterministic stand-in for the comparative judge: the financially binding fields must match exactly."""
    calls = []
    def hook(ctx, request):
        p = request.get("ExecPromptTemplate", {})
        if p.get("template") != "EqComparative": return None
        a, b = parse_answer(p.get("leader_answer", "")), parse_answer(p.get("validator_answer", ""))
        same = (isinstance(a, dict) and isinstance(b, dict) and a.get("ok") is True and b.get("ok") is True
                and all(a.get(k) == b.get(k) for k in ("outcome", "payout_pct", "payout_wei", "digest")))
        calls.append((a, b, bool(same)))
        return {"ok": bool(same)}
    vm._gl_call_hook = hook
    return calls


def settled_at_50(vm, direct_deploy):
    c = deploy(direct_deploy); create(c, vm, 10 * ONE); submit(c, vm); mock_verdict(vm, "PARTIALLY_MET", 50); c.review_milestone(1)
    return c


def test_validator_agrees_on_identical_band(direct_vm, direct_deploy):
    c = settled_at_50(direct_vm, direct_deploy); calls = install_hook(direct_vm)
    try: assert direct_vm.run_validator() is True
    finally: direct_vm._gl_call_hook = None
    assert calls[0][2] is True


def test_validator_rejects_a_different_payout_band_with_the_same_outcome(direct_vm, direct_deploy):
    """Both validators say PARTIALLY_MET, but 50% vs 75% would transfer different amounts. Consensus must fail."""
    c = settled_at_50(direct_vm, direct_deploy)
    mock_verdict(direct_vm, "PARTIALLY_MET", 75)
    calls = install_hook(direct_vm)
    try: assert direct_vm.run_validator() is False
    finally: direct_vm._gl_call_hook = None
    leader, follower, _ = calls[0]
    assert leader["payout_pct"] == 50 and follower["payout_pct"] == 75 and leader["payout_wei"] != follower["payout_wei"]
    assert ms(c)["paid"] == str(5 * ONE)          # the settled payout is untouched by the re-run


def test_validator_rejects_divergent_evidence_bytes(direct_vm, direct_deploy):
    c = settled_at_50(direct_vm, direct_deploy)
    mock_verdict(direct_vm, "PARTIALLY_MET", 50, body=BODY_B)
    calls = install_hook(direct_vm)
    try: assert direct_vm.run_validator() is False
    finally: direct_vm._gl_call_hook = None
    assert calls[0][0]["digest"] != calls[0][1]["digest"]


# ------------------------------------------ evidence URLs and stable digests
def submit_url_and_review(c, vm, url, pattern, body=BODY_A):
    with vm.prank(GRANTEE): c.submit_milestone(1, url, "")
    vm.clear_mocks()
    vm.mock_web(pattern, {"status": 200, "body": body})
    vm.mock_llm(r"GrantGate's milestone adjudicator", json.dumps({"outcome": "MET", "payout_pct": 100, "reasoning": "ok"}))
    return c.review_milestone(1)


def test_plain_branch_blob_and_git_urls_resolve_to_raw_files(direct_vm, direct_deploy):
    cases = [
        ("https://github.com/acme/geo", r"raw\.githubusercontent\.com/acme/geo/HEAD/README\.md"),
        ("https://github.com/acme/geo.git", r"raw\.githubusercontent\.com/acme/geo/HEAD/README\.md"),
        ("https://github.com/acme/geo/tree/main/", r"raw\.githubusercontent\.com/acme/geo/main/README\.md"),
        ("https://github.com/acme/geo/blob/main/docs/API.md?plain=1", r"raw\.githubusercontent\.com/acme/geo/main/docs/API\.md"),
        ("https://github.com/acme/geo?tab=readme-ov-file", r"raw\.githubusercontent\.com/acme/geo/HEAD/README\.md"),
    ]
    for url, pattern in cases:
        c = deploy(direct_deploy); create(c, direct_vm, ONE)
        assert submit_url_and_review(c, direct_vm, url, pattern) == "RELEASED", url


def test_html_noise_does_not_split_validator_digests(direct_vm, direct_deploy):
    """Per-request nonces inside scripts and attributes must not change the evidence digest."""
    page = "<html><head><script nonce='%s'>var t='%s';</script></head><body><p>A public demo with a working API and documentation is live here.</p></body></html>"
    c = deploy(direct_deploy); create(c, direct_vm, 10 * ONE); submit(c, direct_vm)
    mock_verdict(direct_vm, "PARTIALLY_MET", 50, body=page % ("aaa", "111")); c.review_milestone(1)
    mock_verdict(direct_vm, "PARTIALLY_MET", 50, body=page % ("zzz", "999"))
    calls = install_hook(direct_vm)
    try: assert direct_vm.run_validator() is True
    finally: direct_vm._gl_call_hook = None
    assert calls[0][0]["digest"] == calls[0][1]["digest"]
