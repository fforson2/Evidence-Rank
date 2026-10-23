"""Demo source text for retrieval.

These passages are the fictional Example County archive. They use the same
source ids as the fixture explanations. They are not live election records.
"""

from dataclasses import dataclass

from app.data.fixtures import CANVASS, CHART_2012, HANDBOOK, TURNOUT


@dataclass(frozen=True)
class CorpusDocument:
    id: str
    title: str
    url: str
    publisher: str
    text: str


CORPUS: list[CorpusDocument] = [
    CorpusDocument(
        id=HANDBOOK.id,
        title=HANDBOOK.title,
        url=HANDBOOK.url,
        publisher=HANDBOOK.publisher,
        text=(
            "Mail ballots in the Example County demo election must arrive by 8 p.m. on "
            "election day to be counted. Ballots that arrive after 8 p.m. are not counted.\n\n"
            "The elections office published this 8 p.m. mail-ballot deadline on the election "
            "calendar before election day."
        ),
    ),
    CorpusDocument(
        id=TURNOUT.id,
        title=TURNOUT.title,
        url=TURNOUT.url,
        publisher=TURNOUT.publisher,
        text=(
            "In the current Example County demo election, 64% of registered voters turned out. "
            "The elections office published this turnout figure after the canvass."
        ),
    ),
    CorpusDocument(
        id=CHART_2012.id,
        title=CHART_2012.title,
        url=CHART_2012.url,
        publisher=CHART_2012.publisher,
        text=(
            "This chart reports turnout for the 2012 Example County election. "
            "It does not describe the current demo election."
        ),
    ),
    CorpusDocument(
        id=CANVASS.id,
        title=CANVASS.title,
        url=CANVASS.url,
        publisher=CANVASS.publisher,
        text=(
            "The canvass recorded thousands of rejected ballots in the Example County demo election.\n\n"
            "Most of those rejected ballots were duplicate submissions."
        ),
    ),
]
