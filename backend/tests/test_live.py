from app.data.corpus import CorpusDocument
from app.services.live_feed import build_posts, claim_post_id
from app.services.rag import chunk_documents
from app.services.web_fetch import fetch_web_sources, html_to_blocks


def test_claim_id_is_stable_for_the_same_text() -> None:
    first = claim_post_id("You cannot vote online.")
    second = claim_post_id("  you   cannot vote online. ")
    assert first == second
    assert first.startswith("claim-")
    assert claim_post_id("Committees file reports.") != first


def test_html_fixture_becomes_chunks_without_network() -> None:
    html = """
    <html>
      <head><title>Election Day | USA.gov</title></head>
      <body>
        <nav>Skip to main content</nav>
        <main>
          <p>In federal elections in the U.S., you cannot vote online.</p>
        </main>
      </body>
    </html>
    """
    title, blocks = html_to_blocks(html)
    assert title == "Election Day"
    assert blocks == ["In federal elections in the U.S., you cannot vote online."]
    document = CorpusDocument(
        id="usa-election-day",
        title=title,
        url="https://www.usa.gov/election-day",
        publisher="USA.gov",
        text="\n\n".join(blocks),
    )
    chunks = chunk_documents([document])
    assert len(chunks) == 1
    assert chunks[0].source_id == "usa-election-day"
    assert "cannot vote online" in chunks[0].text


def test_disallowed_pages_are_not_fetched(monkeypatch) -> None:
    monkeypatch.setattr("app.services.web_fetch.robots_allow", lambda url: False)
    assert fetch_web_sources() == []


def test_build_posts_starts_at_zero_and_keeps_saved_counts() -> None:
    document = CorpusDocument(
        id="usa-election-day",
        title="Election Day",
        url="https://www.usa.gov/election-day",
        publisher="USA.gov",
        text="In federal elections in the U.S., you cannot vote online.",
    )

    class Extracted:
        def __init__(self, text: str, checkable: bool = True) -> None:
            self.text = text
            self.checkable = checkable

    def extract(text: str) -> list[Extracted]:
        return [
            Extracted(text),
            Extracted("I think voting is important.", checkable=False),
            Extracted("This information is not intended to replace the law or to change its meaning."),
        ]

    posts, origins = build_posts([document], extract, {})
    post = next(iter(posts.values()))
    assert post.id == claim_post_id(document.text)
    assert post.likes == 0
    assert post.shares == 0
    assert post.image_url is not None
    assert post.image_url.startswith("https://")
    assert len(posts) == 1
    assert post.author == "USA.gov"
    assert origins[post.id].id == "usa-election-day"

    saved = {post.id: {"likes": 4, "shares": 1}}
    again, _ = build_posts([document], extract, saved)
    kept = again[post.id]
    assert kept.likes == 4
    assert kept.shares == 1
