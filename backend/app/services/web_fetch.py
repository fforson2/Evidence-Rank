"""Fetch allowlisted public pages into corpus documents.

robots.txt is checked before a request. Page text stays in memory.
"""

from html.parser import HTMLParser
from urllib.error import URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen
from urllib.robotparser import RobotFileParser

from app.data.corpus import CorpusDocument
from app.data.web_sources import WEB_SOURCES, WebSource

USER_AGENT = "EvidenceRank/0.1 (local research; public-domain government pages)"
_MAX_BYTES = 400_000
_MAX_BLOCKS = 12
_MIN_BLOCK = 40
_SKIP_TAGS = {"script", "style", "noscript", "svg", "nav", "footer", "header"}
_BLOCK_TAGS = {"p", "li", "h1", "h2", "h3"}
_BOILERPLATE = (
    "an official website of the united states government",
    "here's how you know",
    "official websites use .gov",
    "secure .gov websites use https",
)


class PageFetchError(Exception):
    """One page could not be read. The caller decides whether that is fatal."""


def fetch_web_sources(sources: list[WebSource] | None = None) -> list[CorpusDocument]:
    documents: list[CorpusDocument] = []
    for source in sources or WEB_SOURCES:
        if not robots_allow(source.url):
            continue
        try:
            document = fetch_source(source)
        except PageFetchError:
            continue
        if document is not None:
            documents.append(document)
    return documents


def robots_allow(url: str) -> bool:
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return False
    parser = RobotFileParser()
    parser.set_url(f"{parsed.scheme}://{parsed.netloc}/robots.txt")
    try:
        parser.read()
    except (URLError, TimeoutError, OSError):
        return False
    return parser.can_fetch(USER_AGENT, url)


def fetch_source(source: WebSource) -> CorpusDocument | None:
    request = Request(source.url, headers={"User-Agent": USER_AGENT, "Accept": "text/html"})
    try:
        with urlopen(request, timeout=20) as response:
            raw = response.read(_MAX_BYTES)
            content_type = response.headers.get("Content-Type", "")
    except (URLError, TimeoutError, OSError) as exc:
        raise PageFetchError(source.url) from exc
    if "html" not in content_type.lower() and not raw.lstrip().startswith(b"<"):
        return None
    title, blocks = html_to_blocks(raw.decode("utf-8", "replace"))
    if not blocks:
        return None
    return CorpusDocument(
        id=source.id,
        title=title or source.publisher,
        url=source.url,
        publisher=source.publisher,
        text="\n\n".join(blocks),
    )


def html_to_blocks(html: str) -> tuple[str, list[str]]:
    title, blocks = _parse(html, require_main=True)
    if not blocks:
        title, blocks = _parse(html, require_main=False)
    return title, blocks[:_MAX_BLOCKS]


def _parse(html: str, *, require_main: bool) -> tuple[str, list[str]]:
    parser = _Extractor(require_main=require_main)
    parser.feed(html)
    parser.close()
    title = " ".join("".join(parser.title_parts).split())
    title = title.split("|")[0].strip()
    return title, parser.blocks


class _Extractor(HTMLParser):
    def __init__(self, *, require_main: bool) -> None:
        super().__init__(convert_charrefs=True)
        self.require_main = require_main
        self.skip_depth = 0
        self.main_depth = 0
        self.capture: list[str] | None = None
        self.blocks: list[str] = []
        self.title_parts: list[str] = []
        self.in_title = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in _SKIP_TAGS:
            self.skip_depth += 1
        if tag == "main":
            self.main_depth += 1
        if tag == "title":
            self.in_title = True
        if tag in _BLOCK_TAGS and self._in_content() and self.skip_depth == 0:
            self.capture = []

    def handle_endtag(self, tag: str) -> None:
        if tag in _BLOCK_TAGS and self.capture is not None:
            text = " ".join("".join(self.capture).split())
            self.capture = None
            if len(text) >= _MIN_BLOCK and not _boilerplate(text):
                self.blocks.append(text)
        if tag == "main" and self.main_depth:
            self.main_depth -= 1
        if tag == "title":
            self.in_title = False
        if tag in _SKIP_TAGS and self.skip_depth:
            self.skip_depth -= 1

    def handle_data(self, data: str) -> None:
        if self.in_title:
            self.title_parts.append(data)
        if self.capture is not None and self.skip_depth == 0:
            self.capture.append(data)

    def _in_content(self) -> bool:
        return self.main_depth > 0 or not self.require_main


def _boilerplate(text: str) -> bool:
    lowered = text.casefold()
    return any(phrase in lowered for phrase in _BOILERPLATE)
